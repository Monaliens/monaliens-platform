const hre = require("hardhat");

async function main() {
  console.log("Deploying SpinWheel contract...");

  // Deploy the SpinWheel contract with higher gas limit
  const SpinWheel = await hre.ethers.getContractFactory("SpinWheel");
  const spinWheel = await SpinWheel.deploy({
    gasLimit: 8000000, // Increased gas limit
  });

  await spinWheel.deployed();

  console.log(`SpinWheel deployed to: ${spinWheel.address}`);
  console.log("Please add this address to your .env file as REACT_APP_CONTRACT_ADDRESS");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 