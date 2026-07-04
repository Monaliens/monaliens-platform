const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();

  // Read contract address from deployed file
  let contractAddress;
  try {
    const deployed = JSON.parse(fs.readFileSync("./deployed-mainnet.json"));
    contractAddress = deployed.minesProxy;
  } catch (e) {
    console.log("No deployed-mainnet.json found, using env variable");
    contractAddress = process.env.MINES_CONTRACT_ADDRESS;
  }

  if (!contractAddress) {
    throw new Error("No contract address found");
  }

  const fundAmount = ethers.parseEther("50");

  console.log("Funding contract:", contractAddress);
  console.log("Amount:", ethers.formatEther(fundAmount), "MON");
  console.log("From:", deployer.address);

  const balanceBefore = await ethers.provider.getBalance(contractAddress);
  console.log("Contract balance before:", ethers.formatEther(balanceBefore), "MON");

  const tx = await deployer.sendTransaction({
    to: contractAddress,
    value: fundAmount
  });
  await tx.wait();

  const balanceAfter = await ethers.provider.getBalance(contractAddress);
  console.log("Contract balance after:", ethers.formatEther(balanceAfter), "MON");
  console.log("Done!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
