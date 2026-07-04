import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { getContractAddress } from "./contract-address";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Setting max bet limits with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON");

  const proxyAddress = getContractAddress();

  if (!proxyAddress) {
    throw new Error("Proxy address not found. Please deploy first: npm run deploy");
  }

  // Set max bet limits
  const maxBetNative = ethers.parseEther("5000"); // 5000 MON
  const maxBetLMON = ethers.parseEther("100000"); // 100k LMON (not used on mainnet)

  console.log("\n Setting Max Bet Limits:");
  console.log("  Max Bet Native:", ethers.formatEther(maxBetNative), "MON");
  console.log("  Max Bet LMON:", ethers.formatEther(maxBetLMON), "LMON");
  console.log("  (Set to 0 for unlimited)");

  // Get contract instance
  const CoinFlip = await ethers.getContractFactory("CoinFlip");
  const coinFlip = CoinFlip.attach(proxyAddress);

  // Check if caller is owner
  const owner = await coinFlip.owner();
  if (deployer.address.toLowerCase() !== owner.toLowerCase()) {
    throw new Error(`Only owner can set limits. Owner: ${owner}, Caller: ${deployer.address}`);
  }

  // Get current limits
  const [currentMaxNative, currentMaxLMON] = await Promise.all([
    coinFlip.maxBetNative(),
    coinFlip.maxBetLMON(),
  ]);

  console.log("\n Current Max Bet Limits:");
  console.log("  Max Bet Native:", ethers.formatEther(currentMaxNative), "MON", currentMaxNative === 0n ? "(unlimited)" : "");
  console.log("  Max Bet LMON:", ethers.formatEther(currentMaxLMON), "LMON", currentMaxLMON === 0n ? "(unlimited)" : "");

  // Set new limits
  console.log("\n Setting new limits...");
  const tx = await coinFlip.setMaxBetLimits(maxBetNative, maxBetLMON);
  console.log("Transaction hash:", tx.hash);
  
  await tx.wait();
  console.log(" Max bet limits updated successfully!");

  // Verify new limits
  const [newMaxNative, newMaxLMON] = await Promise.all([
    coinFlip.maxBetNative(),
    coinFlip.maxBetLMON(),
  ]);

  console.log("\n New Max Bet Limits:");
  console.log("  Max Bet Native:", ethers.formatEther(newMaxNative), "MON", newMaxNative === 0n ? "(unlimited)" : "");
  console.log("  Max Bet LMON:", ethers.formatEther(newMaxLMON), "LMON", newMaxLMON === 0n ? "(unlimited)" : "");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });







































