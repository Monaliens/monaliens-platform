const { ethers } = require("ethers");
const config = require("../config");
const {
  getHttpProvider,
  getAuctionFactoryContract,
  getAuctionContract,
  getNFTCollectionFactoryContract,
  getNFTCollectionContract,
  getERC721Contract,
  getUserRegistryContract,
} = require("../config/blockchain");
const { Auction, Bid, User, Collection } = require("../models");
const ipfsService = require("./ipfsService");

/**
 * Sync Service
 * Synchronizes database with blockchain state
 */

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.lastSyncedBlock = 0;
  }

  async syncAll() {
    if (this.isSyncing) {
      console.log(" Sync already in progress");
      return;
    }

    this.isSyncing = true;
    console.log("\n Starting full sync...");

    try {
      await this.syncAuctions();
      await this.syncCollections();
      await this.syncUsers();
      await this.fetchMissingMetadata();

      console.log(" Sync completed\n");
    } catch (error) {
      console.error(" Sync failed:", error.message);
    } finally {
      this.isSyncing = false;
    }
  }

  async syncAuctions() {
    const factory = getAuctionFactoryContract();
    if (!factory) {
      console.log("    AuctionFactory not configured");
      return;
    }

    console.log("   Syncing auctions...");

    try {
      const auctionCount = await factory.getAuctionCount();
      console.log(`   Found ${auctionCount} auctions on-chain`);

      // Get all auction addresses
      const auctionAddresses = await factory.getAllAuctions();

      for (let i = 0; i < auctionAddresses.length; i++) {
        const address = auctionAddresses[i];
        await this.syncAuction(address, i + 1);
      }

    } catch (error) {
      console.error("    Failed to sync auctions:", error.message);
    }
  }

  async syncAuction(address, auctionId) {
    try {
      const auctionContract = getAuctionContract(address);
      const info = await auctionContract.getAuctionInfo();
      const bidders = await auctionContract.getBidders();

      // Get tokenURI from NFT contract - try custom ABI first, then standard ERC-721
      let tokenURI = "";
      try {
        const nftContract = getNFTCollectionContract(info.nftContract);
        tokenURI = await nftContract.tokenURI(info.tokenId);
      } catch (e) {
        // Try standard ERC-721 ABI for external contracts
        try {
          const erc721Contract = getERC721Contract(info.nftContract);
          tokenURI = await erc721Contract.tokenURI(info.tokenId);
          console.log(`    Fetched tokenURI via ERC-721 for external NFT ${info.nftContract}`);
        } catch (e2) {
          console.log(`    Could not fetch tokenURI for NFT ${info.nftContract} token ${info.tokenId}: ${e2.message}`);
        }
      }

      // Parse metadata from tokenURI if it's inline JSON
      let metadata = {};
      let metadataFetched = false;
      if (tokenURI) {
        console.log(`    TokenURI for auction #${auctionId}: ${tokenURI.substring(0, 100)}${tokenURI.length > 100 ? '...' : ''}`);
        if (tokenURI.startsWith('{')) {
          try {
            metadata = JSON.parse(tokenURI);
            metadataFetched = true;
          } catch (e) {
            console.log(`    Failed to parse inline JSON tokenURI: ${e.message}`);
          }
        } else if (tokenURI.startsWith('data:application/json')) {
          try {
            const base64Data = tokenURI.split(',')[1];
            metadata = JSON.parse(Buffer.from(base64Data, 'base64').toString());
            metadataFetched = true;
          } catch (e) {
            console.log(`    Failed to parse base64 tokenURI: ${e.message}`);
          }
        }
      } else {
        console.log(`    No tokenURI for auction #${auctionId} (NFT: ${info.nftContract} token: ${info.tokenId})`);
      }

      const updateData = {
        auctionId,
        contractAddress: address.toLowerCase(),
        seller: info.seller.toLowerCase(),
        nftContract: info.nftContract.toLowerCase(),
        tokenId: Number(info.tokenId),
        tokenURI,
        startingBid: info.startingBid.toString(),
        highestBid: info.highestBid.toString(),
        highestBidder: info.highestBidder === ethers.ZeroAddress ? null : info.highestBidder.toLowerCase(),
        totalBidAmount: info.totalBidAmount.toString(),
        endTime: new Date(Number(info.endTime) * 1000),
        ended: info.ended,
        settled: info.settled,
        status: info.settled ? "settled" : info.ended ? "ended" : "active",
        rafflePool: info.rafflePool.toString(),
        raffleCompleted: info.raffleCompleted,
        raffleWinner: info.raffleWinner === ethers.ZeroAddress ? null : info.raffleWinner.toLowerCase(),
        bidders: bidders.map((b) => b.toLowerCase()),
        bidCount: bidders.length,
      };

      // Only update metadata if we parsed it successfully
      if (metadataFetched) {
        updateData.metadata = {
          name: metadata.name,
          description: metadata.description,
          image: metadata.image,
          attributes: metadata.attributes || [],
        };
        updateData.metadataFetched = true;
      }

      await Auction.findOneAndUpdate(
        { contractAddress: address.toLowerCase() },
        updateData,
        { upsert: true }
      );

    } catch (error) {
      console.error(`    Failed to sync auction ${address}:`, error.message);
    }
  }

  async syncCollections() {
    const factory = getNFTCollectionFactoryContract();
    if (!factory) {
      console.log("    NFTCollectionFactory not configured");
      return;
    }

    console.log("   Syncing collections...");

    try {
      const collectionAddresses = await factory.getAllCollections();
      console.log(`   Found ${collectionAddresses.length} collections on-chain`);

      for (const address of collectionAddresses) {
        await this.syncCollection(address);
      }

    } catch (error) {
      console.error("    Failed to sync collections:", error.message);
    }
  }

  async syncCollection(address) {
    try {
      const collectionContract = getNFTCollectionContract(address);
      const info = await collectionContract.getCollectionInfo();

      // Parse metadata from collectionURI if it's inline JSON
      let metadata = null;
      let metadataFetched = false;
      const collectionURI = info.collectionURI;

      if (collectionURI) {
        if (collectionURI.startsWith('{')) {
          try {
            metadata = JSON.parse(collectionURI);
            metadataFetched = true;
          } catch (e) {}
        } else if (collectionURI.startsWith('data:application/json')) {
          try {
            const base64Data = collectionURI.split(',')[1];
            metadata = JSON.parse(Buffer.from(base64Data, 'base64').toString());
            metadataFetched = true;
          } catch (e) {}
        }
      }

      const updateData = {
        address: address.toLowerCase(),
        name: info.name,
        symbol: info.symbol,
        collectionURI: info.collectionURI,
        creator: info.creator.toLowerCase(),
        createdAt: new Date(Number(info.createdAt) * 1000),
        totalMinted: Number(info.totalMinted),
      };

      // Add parsed metadata if available
      if (metadataFetched && metadata) {
        updateData.metadata = {
          description: metadata.description,
          image: metadata.image,
          banner: metadata.banner,
          externalUrl: metadata.external_url,
          twitter: metadata.twitter || metadata.social_links?.twitter,
          discord: metadata.discord || metadata.social_links?.discord,
        };
        updateData.metadataFetched = true;
      }

      await Collection.findOneAndUpdate(
        { address: address.toLowerCase() },
        updateData,
        { upsert: true }
      );

    } catch (error) {
      console.error(`    Failed to sync collection ${address}:`, error.message);
    }
  }

  async syncUsers() {
    const registry = getUserRegistryContract();
    if (!registry) {
      console.log("    UserRegistry not configured");
      return;
    }

    console.log("   Syncing users from auctions and collections...");

    try {
      // Get unique addresses from auctions and collections
      const auctions = await Auction.find({}, "seller bidders");
      const collections = await Collection.find({}, "creator");

      const addresses = new Set();

      auctions.forEach((a) => {
        addresses.add(a.seller);
        a.bidders?.forEach((b) => addresses.add(b));
      });

      collections.forEach((c) => addresses.add(c.creator));

      console.log(`   Found ${addresses.size} unique addresses`);

      for (const address of addresses) {
        await this.syncUser(address);
      }

    } catch (error) {
      console.error("    Failed to sync users:", error.message);
    }
  }

  async syncUser(address) {
    try {
      const registry = getUserRegistryContract();
      if (!registry) return;

      const isRegistered = await registry.isRegistered(address);
      if (!isRegistered) return;

      const profile = await registry.getProfile(address);

      await User.findOneAndUpdate(
        { address: address.toLowerCase() },
        {
          username: profile.username,
          profileURI: profile.profileURI,
          registeredAt: new Date(Number(profile.registeredAt) * 1000),
          isVerified: profile.isVerified,
        },
        { upsert: true }
      );

    } catch (error) {
      console.error(`    Failed to sync user ${address}:`, error.message);
    }
  }

  async fetchMissingMetadata() {
    console.log("   Fetching missing metadata...");

    // Fetch NFT metadata for auctions
    const auctionsWithoutMetadata = await Auction.find({
      metadataFetched: false,
      tokenURI: { $exists: true, $ne: "" },
    }).limit(50);

    for (const auction of auctionsWithoutMetadata) {
      try {
        let metadata = null;
        const tokenURI = auction.tokenURI;

        // Handle inline JSON tokenURI
        if (tokenURI.startsWith('{')) {
          try {
            metadata = JSON.parse(tokenURI);
            console.log(`    Parsed inline JSON for auction #${auction.auctionId}`);
          } catch (parseError) {
            console.log(`    Failed to parse inline JSON for auction #${auction.auctionId}`);
          }
        }
        // Handle base64 encoded JSON
        else if (tokenURI.startsWith('data:application/json')) {
          try {
            const base64Data = tokenURI.split(',')[1];
            metadata = JSON.parse(Buffer.from(base64Data, 'base64').toString());
            console.log(`    Parsed base64 JSON for auction #${auction.auctionId}`);
          } catch (parseError) {
            console.log(`    Failed to parse base64 JSON for auction #${auction.auctionId}`);
          }
        }
        // Handle IPFS or HTTP URLs
        else {
          console.log(`    Fetching metadata from URL: ${tokenURI}`);
          metadata = await ipfsService.get(tokenURI);
          if (metadata) {
            console.log(`    Fetched metadata: ${metadata.name || 'Untitled'}`);
          } else {
            console.log(`    Failed to fetch metadata from URL`);
          }
        }

        if (metadata) {
          await Auction.updateOne(
            { _id: auction._id },
            {
              metadata: {
                name: metadata.name,
                description: metadata.description,
                image: metadata.image,
                attributes: metadata.attributes || [],
              },
              metadataFetched: true,
            }
          );
          console.log(`    Updated metadata for auction #${auction.auctionId}: ${metadata.name || 'Untitled'}`);
        }
      } catch (error) {
        console.log(`    Error fetching metadata for auction #${auction.auctionId}:`, error.message);
      }
    }

    // Fetch collection metadata
    const collectionsWithoutMetadata = await Collection.find({
      metadataFetched: false,
      collectionURI: { $exists: true, $ne: "" },
    }).limit(50);

    for (const collection of collectionsWithoutMetadata) {
      try {
        let metadata = null;
        const collectionURI = collection.collectionURI;

        // Handle inline JSON collectionURI
        if (collectionURI.startsWith('{')) {
          try {
            metadata = JSON.parse(collectionURI);
            console.log(`    Parsed inline JSON for collection ${collection.name || collection.address.slice(0, 10)}`);
          } catch (parseError) {
            console.log(`    Failed to parse inline JSON for collection ${collection.address.slice(0, 10)}`);
          }
        }
        // Handle base64 encoded JSON
        else if (collectionURI.startsWith('data:application/json')) {
          try {
            const base64Data = collectionURI.split(',')[1];
            metadata = JSON.parse(Buffer.from(base64Data, 'base64').toString());
            console.log(`    Parsed base64 JSON for collection ${collection.name || collection.address.slice(0, 10)}`);
          } catch (parseError) {
            console.log(`    Failed to parse base64 JSON for collection ${collection.address.slice(0, 10)}`);
          }
        }
        // Handle IPFS or HTTP URLs
        else {
          metadata = await ipfsService.get(collectionURI);
        }

        if (metadata) {
          await Collection.updateOne(
            { _id: collection._id },
            {
              metadata: {
                description: metadata.description,
                image: metadata.image,
                banner: metadata.banner,
                externalUrl: metadata.external_url,
                twitter: metadata.twitter || metadata.social_links?.twitter,
                discord: metadata.discord || metadata.social_links?.discord,
              },
              metadataFetched: true,
            }
          );
          console.log(`    Updated metadata for collection ${collection.name || collection.address.slice(0, 10)}`);
        }
      } catch (error) {
        // Ignore metadata fetch errors
      }
    }

    // Fetch user profile metadata
    const usersWithoutProfile = await User.find({
      profileURI: { $exists: true, $ne: "" },
      "profile.bio": { $exists: false },
    }).limit(50);

    for (const user of usersWithoutProfile) {
      try {
        const metadata = await ipfsService.get(user.profileURI);
        if (metadata) {
          await User.updateOne(
            { _id: user._id },
            {
              profile: {
                bio: metadata.bio,
                avatar: metadata.avatar,
                banner: metadata.banner,
                twitter: metadata.social_links?.twitter,
                discord: metadata.social_links?.discord,
                website: metadata.social_links?.website,
              },
            }
          );
        }
      } catch (error) {
        // Ignore metadata fetch errors
      }
    }
  }

  getStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncedBlock: this.lastSyncedBlock,
    };
  }
}

module.exports = new SyncService();
