const { ethers, upgrades } = require("hardhat");

const TREASURY_ADDRESS = "0xb8fC14c3D66dE79a71177F12F0c4eE0406a8629f";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON");

  // Existing proxy address
  const PROXY_ADDRESS = "0x12910d41f561EA125eECBe270a61BA0638697fd8";

  console.log("\n=== Upgrading HiLo Contract ===");
  console.log("Proxy Address:", PROXY_ADDRESS);
  console.log("Treasury Address:", TREASURY_ADDRESS);

  // Get current implementation
  const oldImplAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("Old Implementation:", oldImplAddress);

  // Upgrade to new implementation
  const HiLo = await ethers.getContractFactory("HiLo");
  const hiLo = await upgrades.upgradeProxy(PROXY_ADDRESS, HiLo);
  await hiLo.waitForDeployment();

  // Get new implementation address
  const newImplAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("New Implementation:", newImplAddress);

  // Set treasury
  console.log("\n Setting Treasury...");
  const setTreasuryTx = await hiLo.setTreasury(TREASURY_ADDRESS);
  await setTreasuryTx.wait();
  console.log("Treasury set to:", TREASURY_ADDRESS);

  // Verify treasury
  const treasury = await hiLo.treasury();
  console.log("Treasury verified:", treasury);

  console.log("\n=== Upgrade Summary ===");
  console.log("Network: Monad Mainnet (chainId: 143)");
  console.log("HiLo Proxy:", PROXY_ADDRESS);
  console.log("Old Implementation:", oldImplAddress);
  console.log("New Implementation:", newImplAddress);
  console.log("Treasury:", treasury);
  console.log("\nNew features:");
  console.log("- Treasury integration for centralized liquidity");
  console.log("- setTreasury(address) - owner can set treasury");
  console.log("- All payouts via treasury.pay() when treasury is set");

  // Update deployed-mainnet.json
  const fs = require("fs");
  const addresses = JSON.parse(fs.readFileSync("./deployed-mainnet.json"));
  addresses.hiLoImplementation = newImplAddress;
  addresses.treasury = TREASURY_ADDRESS;
  fs.writeFileSync("./deployed-mainnet.json", JSON.stringify(addresses, null, 2));
  console.log("\nAddresses updated in deployed-mainnet.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
