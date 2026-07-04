const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

// Treasury address (Monad Mainnet)
const TREASURY_ADDRESS = "0xb8fC14c3D66dE79a71177F12F0c4eE0406a8629f";

async function main() {
  // Read deployment info
  let deploymentFile = "deployed-mainnet.json";
  if (!fs.existsSync(deploymentFile)) {
    deploymentFile = "deployed-production.json";
  }
  if (!fs.existsSync(deploymentFile)) {
    throw new Error("No deployment file found!");
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const proxyAddress = deployment.proxy;

  console.log("Upgrading Limbo contract...");
  console.log("Proxy address:", proxyAddress);
  console.log("Old implementation:", deployment.implementation);

  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with account:", deployer.address);

  // Deploy new implementation
  const Limbo = await ethers.getContractFactory("Limbo");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, Limbo);
  await upgraded.waitForDeployment();

  const newImplementation = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("\nUpgrade successful!");
  console.log("New implementation:", newImplementation);

  // Set Treasury
  console.log("\n Setting Treasury...");
  const setTreasuryTx = await upgraded.setTreasury(TREASURY_ADDRESS);
  await setTreasuryTx.wait();
  console.log("Treasury set to:", TREASURY_ADDRESS);

  // Verify Treasury
  const treasuryAddr = await upgraded.treasury();
  console.log("Treasury verified:", treasuryAddr);

  // Update deployment file
  deployment.implementation = newImplementation;
  deployment.treasury = TREASURY_ADDRESS;
  deployment.lastUpgrade = new Date().toISOString();
  fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
  console.log("Deployment file updated.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
