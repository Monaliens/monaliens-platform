const { ethers, upgrades } = require("hardhat");
const deployed = require("../deployed-mainnet.json");

const TREASURY_ADDRESS = "0xb8fC14c3D66dE79a71177F12F0c4eE0406a8629f";

async function main() {
  console.log(" Upgrading Blackjack contract...");
  console.log("Proxy address:", deployed.blackjack);
  console.log("Current implementation:", deployed.blackjackImplementation);

  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON");

  // Get the new implementation
  const Blackjack = await ethers.getContractFactory("Blackjack");

  console.log("\n Deploying new implementation...");
  const upgraded = await upgrades.upgradeProxy(deployed.blackjack, Blackjack);
  await upgraded.waitForDeployment();

  const newImplAddress = await upgrades.erc1967.getImplementationAddress(deployed.blackjack);

  console.log("\n Upgrade complete!");
  console.log("New implementation:", newImplAddress);

  // Verify new functions exist
  console.log("\n Verifying new functions...");
  const contract = await ethers.getContractAt("Blackjack", deployed.blackjack);

  // Just check the relayer is set
  const relayer = await contract.relayer();
  console.log("Relayer:", relayer);

  // Check referral contract
  const referralContract = await contract.referralContract();
  console.log("Referral contract:", referralContract);

  // Set Treasury
  console.log("\n Setting Treasury...");
  const setTreasuryTx = await contract.setTreasury(TREASURY_ADDRESS);
  await setTreasuryTx.wait();
  console.log("Treasury set to:", TREASURY_ADDRESS);

  // Verify Treasury is set
  const treasury = await contract.treasury();
  console.log("Treasury verified:", treasury);

  // Update deployed.json
  const fs = require("fs");
  deployed.blackjackImplementation = newImplAddress;
  deployed.treasury = TREASURY_ADDRESS;
  deployed.upgradedAt = new Date().toISOString();
  fs.writeFileSync("deployed-mainnet.json", JSON.stringify(deployed, null, 2));
  console.log("\n Updated deployed-mainnet.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
