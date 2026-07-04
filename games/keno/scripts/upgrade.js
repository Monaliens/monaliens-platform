const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

const TREASURY_ADDRESS = "0xb8fC14c3D66dE79a71177F12F0c4eE0406a8629f";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading contracts with account:", deployer.address);

  // Load deployed addresses
  const network = await ethers.provider.getNetwork();
  const filename = network.chainId === 143n ? "./deployed-mainnet.json" : "./deployed-local.json";

  if (!fs.existsSync(filename)) {
    console.error("Deployed addresses file not found:", filename);
    process.exit(1);
  }

  const addresses = JSON.parse(fs.readFileSync(filename));
  console.log("Upgrading Keno at:", addresses.kenoProxy);

  // Upgrade (V5 - treasury integration)
  const Keno = await ethers.getContractFactory("Keno");
  console.log("Deploying new implementation...");
  const upgraded = await upgrades.upgradeProxy(addresses.kenoProxy, Keno, {
    unsafeSkipStorageCheck: true,
    kind: 'uups'
  });
  await upgraded.waitForDeployment();

  const newImplAddress = await upgrades.erc1967.getImplementationAddress(addresses.kenoProxy);

  console.log("\n=== Upgrade Summary ===");
  console.log("Proxy (unchanged):", addresses.kenoProxy);
  console.log("Old Implementation:", addresses.kenoImplementation);
  console.log("New Implementation:", newImplAddress);

  // Set Treasury
  console.log("\n Setting Treasury...");
  const setTreasuryTx = await upgraded.setTreasury(TREASURY_ADDRESS);
  await setTreasuryTx.wait();
  console.log("Treasury set to:", TREASURY_ADDRESS);

  // Verify Treasury
  const treasury = await upgraded.treasury();
  console.log("Treasury verified:", treasury);

  // Update addresses file
  addresses.kenoImplementation = newImplAddress;
  addresses.treasury = TREASURY_ADDRESS;
  fs.writeFileSync(filename, JSON.stringify(addresses, null, 2));
  console.log("\nAddresses updated in", filename);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
