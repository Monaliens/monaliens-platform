const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Setting bet limits with account:", deployer.address);

  const DICE_PROXY = "0xA7e6f5609429E4f92Cff10ade4aD058De392BF2c";

  const abi = [
    "function setBetLimits(uint256 _minBet, uint256 _maxBet) external",
    "function minBet() external view returns (uint256)",
    "function maxBet() external view returns (uint256)",
    "function owner() external view returns (address)"
  ];

  const contract = new ethers.Contract(DICE_PROXY, abi, deployer);

  // Check owner
  const owner = await contract.owner();
  console.log("Contract owner:", owner);
  console.log("Our address:", deployer.address);

  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("ERROR: We are not the owner! Cannot change bet limits.");
    return;
  }

  // Current limits
  const currentMinBet = await contract.minBet();
  const currentMaxBet = await contract.maxBet();
  console.log("\nCurrent limits:");
  console.log("  Min bet:", ethers.formatEther(currentMinBet), "MON");
  console.log("  Max bet:", ethers.formatEther(currentMaxBet), "MON");

  // New limits
  const newMinBet = ethers.parseEther("10");
  const newMaxBet = currentMaxBet; // Keep max bet the same

  console.log("\nNew limits:");
  console.log("  Min bet:", ethers.formatEther(newMinBet), "MON");
  console.log("  Max bet:", ethers.formatEther(newMaxBet), "MON");

  // Set new limits
  console.log("\nSetting new bet limits...");
  const tx = await contract.setBetLimits(newMinBet, newMaxBet);
  await tx.wait();

  console.log("Bet limits updated successfully!");
  console.log("TX:", tx.hash);

  // Verify
  const verifyMinBet = await contract.minBet();
  console.log("\nVerified new min bet:", ethers.formatEther(verifyMinBet), "MON");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
