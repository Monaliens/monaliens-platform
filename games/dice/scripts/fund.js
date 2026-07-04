const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const contractAddress = "0xaF24d603e0Cf7C2E6E971f4F95116d948e8D888B";
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
