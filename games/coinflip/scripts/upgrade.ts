import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
import { getContractAddress } from "./contract-address";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Upgrading CoinFlip contract with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON");

  const proxyAddress = getContractAddress();

  if (!proxyAddress) {
    throw new Error("Proxy address not found. Please deploy first: npm run deploy");
  }

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  console.log("Proxy Address:", proxyAddress);

  // Get current implementation
  const currentImplementation = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("Current Implementation:", currentImplementation);

  // Deploy new implementation
  console.log("\n Deploying new CoinFlip implementation...");
  const CoinFlip = await ethers.getContractFactory("CoinFlip");
  
  // Upgrade proxy
  console.log(" Upgrading proxy...");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, CoinFlip);
  await upgraded.waitForDeployment();

  const newImplementation = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("\n Proxy upgraded successfully!");
  console.log(" New Implementation:", newImplementation);

  // Verify the upgrade
  const coinFlip = await ethers.getContractAt("CoinFlip", proxyAddress);
  const owner = await coinFlip.owner();
  console.log("\n Contract State (after upgrade):");
  console.log("  Owner:", owner);
  console.log("  Proxy Address:", proxyAddress);

  console.log("\n Next steps:");
  console.log("  1. Verify new implementation on block explorer");
  console.log(`  2. Run: hardhat verify --network monad-testnet ${newImplementation}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });







































