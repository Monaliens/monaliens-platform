const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

const TREASURY_ADDRESS = "0xb8fC14c3D66dE79a71177F12F0c4eE0406a8629f";

async function main() {
  const proxyAddress = "0xA7e6f5609429E4f92Cff10ade4aD058De392BF2c"; // Production proxy

  console.log("Upgrading Dice contract...");
  console.log("Proxy address:", proxyAddress);

  const Dice = await ethers.getContractFactory("Dice");

  const upgraded = await upgrades.upgradeProxy(proxyAddress, Dice);
  await upgraded.waitForDeployment();

  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("Upgrade complete!");
  console.log("New implementation:", implAddress);

  // Set Treasury
  console.log("\n Setting Treasury...");
  const setTreasuryTx = await upgraded.setTreasury(TREASURY_ADDRESS);
  await setTreasuryTx.wait();
  console.log("Treasury set to:", TREASURY_ADDRESS);

  // Verify Treasury is set correctly
  const treasuryAddress = await upgraded.treasury();
  console.log("Treasury verified:", treasuryAddress);

  // Update deployed.json if exists
  const deployedPath = path.join(__dirname, "..", "deployed.json");
  if (fs.existsSync(deployedPath)) {
    const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
    deployed.implementation = implAddress;
    deployed.treasury = TREASURY_ADDRESS;
    deployed.lastUpgrade = new Date().toISOString();
    fs.writeFileSync(deployedPath, JSON.stringify(deployed, null, 2));
    console.log("\ndeployed.json updated");
  }

  console.log("\n Upgrade and Treasury setup complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
