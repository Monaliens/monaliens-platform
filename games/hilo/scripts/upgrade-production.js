const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON");

  // Production proxy address
  const PROXY_ADDRESS = "0x12910d41f561EA125eECBe270a61BA0638697fd8";

  console.log("\n=== Upgrading HiLo Contract ===");
  console.log("Proxy Address:", PROXY_ADDRESS);

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

  console.log("\n=== Upgrade Complete ===");
  console.log("Proxy:", PROXY_ADDRESS);
  console.log("Old Implementation:", oldImplAddress);
  console.log("New Implementation:", newImplAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
