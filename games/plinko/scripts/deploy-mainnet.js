const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Deploying Plinko (Hash Pool Version) to Monad Mainnet...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MON\n");

  if (balance < ethers.parseEther("1")) {
    console.error("WARNING: Low balance! Deployment may fail.");
  }

  // Backend/Relayer wallet (mines relayer)
  const BACKEND_ADDRESS = "0x7a6a73d59F3aA8518b96604aF21da8476a51E1Bb";

  // Bet limits
  const MIN_BET = ethers.parseEther("0.01");  // 0.01 MON
  const MAX_BET = ethers.parseEther("10");    // 10 MON

  // Fee recipient (Monaliens fee wallet)
  const FEE_RECIPIENT = "0x1CC17B568aA3b724DD9F48dE6593378064F35Bb3";

  console.log("Configuration:");
  console.log("- Backend:", BACKEND_ADDRESS);
  console.log("- Min Bet:", ethers.formatEther(MIN_BET), "MON");
  console.log("- Max Bet:", ethers.formatEther(MAX_BET), "MON");
  console.log("- Fee Recipient:", FEE_RECIPIENT);
  console.log("");

  // Deploy Plinko as upgradeable proxy
  console.log("Deploying proxy...");
  const Plinko = await ethers.getContractFactory("Plinko");
  const plinko = await upgrades.deployProxy(
    Plinko,
    [BACKEND_ADDRESS, MIN_BET, MAX_BET, FEE_RECIPIENT],
    { initializer: "initialize", kind: "uups" }
  );

  await plinko.waitForDeployment();

  const proxyAddress = await plinko.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\nPlinko deployed successfully!");
  console.log("- Proxy address:", proxyAddress);
  console.log("- Implementation address:", implementationAddress);

  // Save deployment info
  const deploymentInfo = {
    network: "monadMainnet",
    chainId: 143,
    proxy: proxyAddress,
    implementation: implementationAddress,
    deployer: deployer.address,
    backend: BACKEND_ADDRESS,
    treasury: "0xb8fC14c3D66dE79a71177F12F0c4eE0406a8629f",
    timestamp: new Date().toISOString(),
    config: {
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
  const minBetRead = await plinko.minBet();
  const maxBetRead = await plinko.maxBet();
  const backendRead = await plinko.backend();

  console.log("Min Bet:", ethers.formatEther(minBetRead), "MON");
  console.log("Max Bet:", ethers.formatEther(maxBetRead), "MON");
  console.log("Backend:", backendRead);

  // Set Treasury
  const TREASURY_ADDRESS = "0xb8fC14c3D66dE79a71177F12F0c4eE0406a8629f";
  console.log("\nSetting Treasury...");
  const setTreasuryTx = await plinko.setTreasury(TREASURY_ADDRESS);
  await setTreasuryTx.wait();
  const treasuryAddr = await plinko.treasury();
  console.log("Treasury set:", treasuryAddr);

  console.log("\n--- Next Steps ---");
  console.log("1. Add to Treasury whitelist: addGame(" + proxyAddress + ")");
  console.log("2. Update .env with PLINKO_CONTRACT_ADDRESS=" + proxyAddress);
  console.log("3. Start backend - it will call initializePool() with hash chain");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
