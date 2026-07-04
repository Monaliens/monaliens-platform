const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const targetAddress = "0x8d231695019d65d05185674Aa3E7BA005F0bA62f";

  console.log("Funding wallet:", targetAddress);
  console.log("From:", deployer.address);

  const tx = await deployer.sendTransaction({
    to: targetAddress,
    value: ethers.parseEther("100")
  });

  await tx.wait();

  const balance = await ethers.provider.getBalance(targetAddress);
  console.log("Done! Balance:", ethers.formatEther(balance), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
