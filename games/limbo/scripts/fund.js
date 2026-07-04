const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  // Read deployment info
  let deploymentFile = "deployed-mainnet.json";
  if (!fs.existsSync(deploymentFile)) {
    deploymentFile = "deployed-production.json";
  }
  if (!fs.existsSync(deploymentFile)) {
    throw new Error("No deployment file found! Deploy the contract first.");
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const contractAddress = deployment.proxy;

  console.log("Funding Limbo contract...");
  console.log("Contract address:", contractAddress);

  const [sender] = await ethers.getSigners();
  console.log("Sender:", sender.address);

  const senderBalance = await ethers.provider.getBalance(sender.address);
  console.log("Sender balance:", ethers.formatEther(senderBalance), "MON");

  // Amount to fund (adjust as needed)
  const FUND_AMOUNT = ethers.parseEther("100"); // 100 MON
  console.log("Funding amount:", ethers.formatEther(FUND_AMOUNT), "MON");

  if (senderBalance < FUND_AMOUNT) {
    throw new Error("Insufficient balance to fund contract!");
  }

  // Get current contract balance
  const contractBalance = await ethers.provider.getBalance(contractAddress);
  console.log("Current contract balance:", ethers.formatEther(contractBalance), "MON");

  // Send funds
  console.log("\nSending funds...");
  const tx = await sender.sendTransaction({
    to: contractAddress,
    value: FUND_AMOUNT
  });

  console.log("Transaction hash:", tx.hash);
  await tx.wait();

  // Verify new balance
  const newBalance = await ethers.provider.getBalance(contractAddress);
  console.log("New contract balance:", ethers.formatEther(newBalance), "MON");

  console.log("\nContract funded successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
