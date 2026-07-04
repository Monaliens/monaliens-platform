const { ethers } = require("ethers");
const config = require("../config");
const {
  getHttpProvider,
  getAuctionContract,
  getSettlementWallet,
} = require("../config/blockchain");
const { Auction } = require("../models");

class SettlementService {
  constructor(io) {
    this.io = io;
    this.isRunning = false;
    this.intervalId = null;
    this.wallet = null;
    this.processingAuctions = new Set();
  }

  async start() {
    if (!config.settlement.privateKey) {
      console.log(" Settlement private key not configured, auto-settlement disabled");
      return;
    }

    try {
      this.wallet = getSettlementWallet();
      const address = await this.wallet.getAddress();
      const balance = await getHttpProvider().getBalance(address);

      console.log(" Settlement Service starting...");
      console.log(`   Wallet: ${address}`);
      console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);

      this.isRunning = true;
      this.intervalId = setInterval(() => this.processAuctions(), config.settlement.intervalMs);

      // Run immediately
      await this.processAuctions();

      console.log(` Settlement Service started (interval: ${config.settlement.intervalMs}ms)`);

    } catch (error) {
      console.error(" Failed to start Settlement Service:", error.message);
    }
  }

  async processAuctions() {
    if (!this.isRunning) return;

    try {
      // 1. End auctions that have passed their end time
      await this.endExpiredAuctions();

      // 2. Settle ended auctions
      await this.settleEndedAuctions();

      // 3. Complete raffles
      await this.completeRaffles();

    } catch (error) {
      console.error(" Settlement Service error:", error.message);
    }
  }

  async endExpiredAuctions() {
    const expiredAuctions = await Auction.find({
      ended: false,
      endTime: { $lte: new Date() },
    }).limit(10);

    for (const auction of expiredAuctions) {
      if (this.processingAuctions.has(auction.contractAddress)) continue;
      this.processingAuctions.add(auction.contractAddress);

      try {
        console.log(`\n Ending auction #${auction.auctionId}...`);

        const auctionContract = getAuctionContract(auction.contractAddress, this.wallet);

        // Check if already ended on-chain
        const info = await auctionContract.getAuctionInfo();
        if (info.ended) {
          // Just update DB
          await Auction.updateOne(
            { _id: auction._id },
            { ended: true, status: "ended" }
          );
          console.log(`   Already ended on-chain, DB updated`);
        } else {
          // End on-chain
          const tx = await auctionContract.endAuction();
          await tx.wait();

          await Auction.updateOne(
            { _id: auction._id },
            { ended: true, status: "ended", endTxHash: tx.hash }
          );

          console.log(`    Auction #${auction.auctionId} ended (tx: ${tx.hash.slice(0, 10)}...)`);

          this.broadcast("auction:ended", { auctionId: auction.auctionId });
        }

      } catch (error) {
        console.error(`    Failed to end auction #${auction.auctionId}:`, error.message);
      } finally {
        this.processingAuctions.delete(auction.contractAddress);
      }
    }
  }

  async settleEndedAuctions() {
    const unsettledAuctions = await Auction.find({
      ended: true,
      settled: false,
    }).limit(10);

    for (const auction of unsettledAuctions) {
      if (this.processingAuctions.has(auction.contractAddress)) continue;
      this.processingAuctions.add(auction.contractAddress);

      try {
        console.log(`\n Settling auction #${auction.auctionId}...`);

        const auctionContract = getAuctionContract(auction.contractAddress, this.wallet);

        // Check if already settled on-chain
        const info = await auctionContract.getAuctionInfo();
        if (info.settled) {
          await Auction.updateOne(
            { _id: auction._id },
            { settled: true, status: "settled" }
          );
          console.log(`   Already settled on-chain, DB updated`);
        } else {
          // Settle on-chain
          const tx = await auctionContract.settleAuction();
          await tx.wait();

          await Auction.updateOne(
            { _id: auction._id },
            { settled: true, status: "settled", settlementTxHash: tx.hash }
          );

          console.log(`    Auction #${auction.auctionId} settled (tx: ${tx.hash.slice(0, 10)}...)`);

          this.broadcast("auction:settled", { auctionId: auction.auctionId });
        }

      } catch (error) {
        console.error(`    Failed to settle auction #${auction.auctionId}:`, error.message);
      } finally {
        this.processingAuctions.delete(auction.contractAddress);
      }
    }
  }

  async completeRaffles() {
    const raffleReadyAuctions = await Auction.find({
      ended: true,
      settled: true,
      raffleCompleted: false,
      rafflePool: { $ne: "0" },
      bidCount: { $gt: 0 },
    }).limit(10);

    for (const auction of raffleReadyAuctions) {
      if (this.processingAuctions.has(auction.contractAddress)) continue;
      this.processingAuctions.add(auction.contractAddress);

      try {
        console.log(`\n Processing raffle for auction #${auction.auctionId}...`);

        const auctionContract = getAuctionContract(auction.contractAddress, this.wallet);

        // Check if already completed on-chain
        const info = await auctionContract.getAuctionInfo();
        if (info.raffleCompleted) {
          await Auction.updateOne(
            { _id: auction._id },
            {
              raffleCompleted: true,
              raffleWinner: info.raffleWinner.toLowerCase(),
              rafflePool: "0",
            }
          );
          console.log(`   Already completed on-chain, DB updated`);
          continue;
        }

        // Check if can request raffle
        const canRequest = await auctionContract.canRequestRaffle();
        if (!canRequest) {
          console.log(`   Raffle delay not passed yet`);
          continue;
        }

        // Request raffle if not already requested
        // With Pyth Entropy, the callback will automatically complete the raffle
        if (!auction.raffleRequestId) {
          console.log(`   Requesting randomness from Pyth Entropy...`);

          // Get entropy fee
          const entropyFee = await auctionContract.getEntropyFee();
          console.log(`   Entropy fee: ${ethers.formatEther(entropyFee)} ETH`);

          // Request raffle with entropy fee
          const requestTx = await auctionContract.requestRaffle({ value: entropyFee });
          const receipt = await requestTx.wait();

          // Get request ID from event
          const event = receipt.logs.find((log) => {
            try {
              const parsed = auctionContract.interface.parseLog(log);
              return parsed?.name === "RaffleRequested";
            } catch {
              return false;
            }
          });

          if (event) {
            const parsed = auctionContract.interface.parseLog(event);
            const requestId = Number(parsed.args.requestId);
            await Auction.updateOne(
              { _id: auction._id },
              { raffleRequestId: requestId, raffleRequestTxHash: requestTx.hash }
            );
            console.log(`    Raffle requested! Sequence: ${requestId} (tx: ${requestTx.hash.slice(0, 10)}...)`);
            console.log(`    Waiting for Pyth Entropy callback...`);
          }
        } else {
          console.log(`    Raffle already requested (ID: ${auction.raffleRequestId}), waiting for callback...`);
        }

        // Note: With Pyth Entropy, the raffle is completed automatically via callback
        // The RaffleCompleted event will be picked up by the event listener

      } catch (error) {
        console.error(`    Failed to process raffle for auction #${auction.auctionId}:`, error.message);
      } finally {
        this.processingAuctions.delete(auction.contractAddress);
      }
    }
  }

  broadcast(event, data) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMs: config.settlement.intervalMs,
      processingCount: this.processingAuctions.size,
      walletConfigured: !!config.settlement.privateKey,
    };
  }

  stop() {
    console.log(" Stopping Settlement Service...");
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

module.exports = SettlementService;
