const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Deploying Limbo to Monad Mainnet...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MON\n");

  if (balance < ethers.parseEther("1")) {
    console.error("WARNING: Low balance! Deployment may fail.");
  }

  // Monad Mainnet Pyth Entropy addresses
  const ENTROPY_ADDRESS = "0xD458261E832415CFd3BAE5E416FdF3230ce6F134";
  const ENTROPY_PROVIDER = "0x52DeaA1c84233F7bb8C8A45baeDE41091c616506";

  // Bet limits
  const MIN_BET = ethers.parseEther("0.01");  // 0.01 MON
  const MAX_BET = ethers.parseEther("1");     // 1 MON

  // Fee recipient (Monaliens fee wallet)
  const FEE_RECIPIENT = "0x1CC17B568aA3b724DD9F48dE6593378064F35Bb3";

  console.log("Configuration:");
  console.log("- Entropy:", ENTROPY_ADDRESS);
  console.log("- Provider:", ENTROPY_PROVIDER);
  console.log("- Min Bet:", ethers.formatEther(MIN_BET), "MON");
  console.log("- Max Bet:", ethers.formatEther(MAX_BET), "MON");
  console.log("- Fee Recipient:", FEE_RECIPIENT);
  console.log("");

  // Deploy Limbo as upgradeable proxy
  console.log("Deploying proxy...");
  const Limbo = await ethers.getContractFactory("Limbo");
  const limbo = await upgrades.deployProxy(
    Limbo,
    [ENTROPY_ADDRESS, ENTROPY_PROVIDER, MIN_BET, MAX_BET, FEE_RECIPIENT],
    { initializer: "initialize", kind: "uups" }
  );

  await limbo.waitForDeployment();

  const proxyAddress = await limbo.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\nLimbo deployed successfully!");
  console.log("- Proxy address:", proxyAddress);
  console.log("- Implementation address:", implementationAddress);

  // Save deployment info
  const deploymentInfo = {
    network: "monadMainnet",
    chainId: 143,
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

  // Verify contract info
  console.log("\n--- Contract Info ---");
  const minBetRead = await limbo.minBet();
  const maxBetRead = await limbo.maxBet();
  const entropyFee = await limbo.getEntropyFee();

  console.log("Min Bet:", ethers.formatEther(minBetRead), "MON");
  console.log("Max Bet:", ethers.formatEther(maxBetRead), "MON");
  console.log("Entropy Fee:", ethers.formatEther(entropyFee), "MON");

  console.log("\n--- Next Steps ---");
  console.log("1. Fund the contract: npx hardhat run scripts/fund.js --network monadMainnet");
  console.log("2. Update backend .env with LIMBO_CONTRACT_ADDRESS=" + proxyAddress);
  console.log("3. Start backend server");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
