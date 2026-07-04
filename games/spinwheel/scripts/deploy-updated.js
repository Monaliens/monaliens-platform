const hre = require("hardhat");

async function main() {
  console.log("Deploying updated SpinWheel contract...");

  // Deploy the contract
  const SpinWheel = await hre.ethers.getContractFactory("SpinWheel");
  const spinWheel = await SpinWheel.deploy();

  await spinWheel.deployed();

  console.log(`SpinWheel deployed to: ${spinWheel.address}`);
  
  // Log dev wallet for verification
  const devWallet = await spinWheel.devWallet();
  console.log(`Dev wallet set to: ${devWallet}`);
  
  // Update .env file with the deployed contract address
  console.log("Please add this address to your .env file as SPINWHEEL_PROXY_ADDRESS");
  
  // Verify current cooldown period
  const cooldownPeriod = await spinWheel.cooldownPeriod();
  console.log(`Current cooldown period: ${cooldownPeriod} seconds`);
  
  // Optionally update cooldown period for testing (uncomment to use)
  // const tx = await spinWheel.updateCooldownPeriod(60); // 60 seconds for testing
  // await tx.wait();
  // console.log("Cooldown period updated to 60 seconds");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 