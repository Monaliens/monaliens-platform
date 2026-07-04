const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("Deploying SpinWheelVRF contract...");

  // VRF Configuration from environment variables
  const VRF_COORDINATOR = process.env.VRF_COORDINATOR || "0xd945F759D422F7EAB035ABBb52cC78c364ae694B"; // Default to Chainlink coordinator for Monad Testnet
  const VRF_KEY_HASH = process.env.VRF_KEY_HASH || "0x9fe0eebf5e446e3c998ec9bb19951541aee00bb90ea201ae456421a2ded86805"; // Default key hash for Monad Testnet
  const VRF_SUBSCRIPTION_ID = process.env.VRF_SUBSCRIPTION_ID || "1"; // Default subscription ID (must be changed)

  console.log(`Using VRF Coordinator: ${VRF_COORDINATOR}`);
  console.log(`Using VRF Key Hash: ${VRF_KEY_HASH}`);
  console.log(`Using VRF Subscription ID: ${VRF_SUBSCRIPTION_ID}`);

  // Deploy the contract
  const SpinWheelVRF = await hre.ethers.getContractFactory("SpinWheelVRF");
  const spinWheelVRF = await SpinWheelVRF.deploy(
    VRF_COORDINATOR,
    VRF_KEY_HASH,
    VRF_SUBSCRIPTION_ID
  );

  await spinWheelVRF.deployed();

  console.log(`SpinWheelVRF deployed to: ${spinWheelVRF.address}`);
  
  // Update .env file with the deployed contract address
  console.log("Please add this address to your .env file as REACT_APP_CONTRACT_ADDRESS");
  
  // Verify current cooldown period
  const cooldownPeriod = await spinWheelVRF.cooldownPeriod();
  console.log(`Current cooldown period: ${cooldownPeriod} seconds`);
  
  // Optionally update cooldown period for testing (uncomment to use)
  // const tx = await spinWheelVRF.updateCooldownPeriod(60); // 60 seconds for testing
  // await tx.wait();
  // console.log("Cooldown period updated to 60 seconds");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 