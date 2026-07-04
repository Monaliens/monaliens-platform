const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
  // Read contract address from deployed file
  let proxyAddress;
  try {
    const deployed = JSON.parse(fs.readFileSync("./deployed-mainnet.json"));
    proxyAddress = deployed.minesProxy;
  } catch (e) {
    console.log("No deployed-mainnet.json found, using env variable");
    proxyAddress = process.env.MINES_CONTRACT_ADDRESS;
  }

  if (!proxyAddress) {
    throw new Error("No proxy address found");
  }

  console.log("Upgrading Mines contract...");
  console.log("Proxy address:", proxyAddress);

  const Mines = await ethers.getContractFactory("Mines");

  const upgraded = await upgrades.upgradeProxy(proxyAddress, Mines);
  await upgraded.waitForDeployment();

  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("Upgrade complete!");
  console.log("New implementation:", implAddress);

  // Update deployed file
  try {
    const deployed = JSON.parse(fs.readFileSync("./deployed-mainnet.json"));
    deployed.minesImplementation = implAddress;
    fs.writeFileSync("./deployed-mainnet.json", JSON.stringify(deployed, null, 2));
    console.log("Updated deployed-mainnet.json");
  } catch (e) {
    console.log("Could not update deployed-mainnet.json");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
