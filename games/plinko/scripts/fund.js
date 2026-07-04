const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Funding Plinko contract...\n");

  // Load deployment info
  const deploymentInfo = JSON.parse(fs.readFileSync("deployed-mainnet.json", "utf-8"));
  const proxyAddress = deploymentInfo.proxy;

  console.log("Contract address:", proxyAddress);

  const [funder] = await ethers.getSigners();
  console.log("Funding from:", funder.address);

  const balance = await ethers.provider.getBalance(funder.address);
  console.log("Wallet balance:", ethers.formatEther(balance), "MON");

  // Fund amount
  const FUND_AMOUNT = ethers.parseEther("200"); // 200 MON

  console.log("\nSending", ethers.formatEther(FUND_AMOUNT), "MON...");

  const tx = await funder.sendTransaction({
    to: proxyAddress,
    value: FUND_AMOUNT
  });

  await tx.wait();

  console.log("TX Hash:", tx.hash);

  // Check new balance
  const contractBalance = await ethers.provider.getBalance(proxyAddress);
  console.log("\nContract balance:", ethers.formatEther(contractBalance), "MON");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
