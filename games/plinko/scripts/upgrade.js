const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

const TREASURY_ADDRESS = "0xb8fC14c3D66dE79a71177F12F0c4eE0406a8629f";

async function main() {
  console.log("Upgrading Plinko contract...\n");

  // Load deployment info
  const deploymentInfo = JSON.parse(fs.readFileSync("deployed-mainnet.json", "utf-8"));
  const proxyAddress = deploymentInfo.proxy;

  console.log("Proxy address:", proxyAddress);
  console.log("Old implementation:", deploymentInfo.implementation);

  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with account:", deployer.address);

  // Get new implementation
  const Plinko = await ethers.getContractFactory("Plinko");

  console.log("\nUpgrading...");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, Plinko);
  await upgraded.waitForDeployment();

  const newImplementation = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\nUpgrade successful!");
  console.log("- Proxy address:", proxyAddress);
  console.log("- New implementation:", newImplementation);

  // Set Treasury
  console.log("\nSetting Treasury...");
  const setTreasuryTx = await upgraded.setTreasury(TREASURY_ADDRESS);
  await setTreasuryTx.wait();
  console.log("Treasury set to:", TREASURY_ADDRESS);

  // Verify Treasury
  const treasuryAddr = await upgraded.treasury();
  console.log("Treasury verified:", treasuryAddr);

  // Update deployment info
  deploymentInfo.implementation = newImplementation;
  deploymentInfo.treasury = TREASURY_ADDRESS;
  deploymentInfo.lastUpgrade = new Date().toISOString();

  fs.writeFileSync(
    "deployed-mainnet.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment info updated.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
