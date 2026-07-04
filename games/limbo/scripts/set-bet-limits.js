const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  // Read deployment info
  let deploymentFile = "deployed-mainnet.json";
  if (!fs.existsSync(deploymentFile)) {
    deploymentFile = "deployed-production.json";
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const contractAddress = deployment.proxy;

  console.log("Setting bet limits for Limbo...");
  console.log("Contract address:", contractAddress);

  const [owner] = await ethers.getSigners();
  console.log("Owner:", owner.address);

  // New bet limits
  const NEW_MIN_BET = ethers.parseEther("10");    // 10 MON
  const NEW_MAX_BET = ethers.parseEther("500");   // 500 MON

  console.log("New min bet:", ethers.formatEther(NEW_MIN_BET), "MON");
  console.log("New max bet:", ethers.formatEther(NEW_MAX_BET), "MON");

  // Get contract instance
  const Limbo = await ethers.getContractFactory("Limbo");
  const limbo = Limbo.attach(contractAddress);

  // Get current limits
  const currentMin = await limbo.minBet();
  const currentMax = await limbo.maxBet();
  console.log("\nCurrent min bet:", ethers.formatEther(currentMin), "MON");
  console.log("Current max bet:", ethers.formatEther(currentMax), "MON");

  // Set new limits
  console.log("\nSetting new limits...");
  const tx = await limbo.setBetLimits(NEW_MIN_BET, NEW_MAX_BET);
  console.log("Transaction hash:", tx.hash);
  await tx.wait();

  // Verify
  const newMin = await limbo.minBet();
  const newMax = await limbo.maxBet();
  console.log("\nNew min bet:", ethers.formatEther(newMin), "MON");
  console.log("New max bet:", ethers.formatEther(newMax), "MON");

  console.log("\nBet limits updated successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
