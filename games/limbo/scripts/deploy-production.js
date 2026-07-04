const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Deploying Limbo to Monad Mainnet...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON\n");

  // Monad Mainnet Pyth Entropy addresses
  const ENTROPY_ADDRESS = "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320";
  const ENTROPY_PROVIDER = "0x52DeaA1c84233F7bb8C8A45baeDE41091c616506";

  // Bet limits
  const MIN_BET = ethers.parseEther("0.01");  // 0.01 MON
  const MAX_BET = ethers.parseEther("100");   // 100 MON

  // Fee recipient
  const FEE_RECIPIENT = deployer.address;

  console.log("Configuration:");
  console.log("- Entropy:", ENTROPY_ADDRESS);
  console.log("- Provider:", ENTROPY_PROVIDER);
  console.log("- Min Bet:", ethers.formatEther(MIN_BET), "MON");
  console.log("- Max Bet:", ethers.formatEther(MAX_BET), "MON");
  console.log("- Fee Recipient:", FEE_RECIPIENT);
  console.log("");

  // Deploy Limbo as upgradeable proxy
  const Limbo = await ethers.getContractFactory("Limbo");
  const limbo = await upgrades.deployProxy(
    Limbo,
    [ENTROPY_ADDRESS, ENTROPY_PROVIDER, MIN_BET, MAX_BET, FEE_RECIPIENT],
    { initializer: "initialize", kind: "uups" }
  );

  await limbo.waitForDeployment();

  const proxyAddress = await limbo.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\nLimbo deployed!");
  console.log("- Proxy address:", proxyAddress);
  console.log("- Implementation address:", implementationAddress);

  // Save deployment info
  const deploymentInfo = {
    network: "monad-mainnet",
    proxy: proxyAddress,
    implementation: implementationAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    config: {
      entropy: ENTROPY_ADDRESS,
      entropyProvider: ENTROPY_PROVIDER,
      minBet: MIN_BET.toString(),
      maxBet: MAX_BET.toString(),
      feeRecipient: FEE_RECIPIENT
    }
  };

  fs.writeFileSync(
    "deployed-mainnet.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment info saved to deployed-mainnet.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
