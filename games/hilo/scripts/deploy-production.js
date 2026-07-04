const { ethers, upgrades } = require("hardhat");

async function main() {
  // Use production private key
  const productionKey = process.env.PRODUCTION_PRIVATE_KEY;
  if (!productionKey) {
    throw new Error("PRODUCTION_PRIVATE_KEY not set");
  }

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const deployer = new ethers.Wallet(productionKey, provider);

  console.log("=".repeat(60));
  console.log("PRODUCTION DEPLOYMENT - HiLo");
  console.log("=".repeat(60));
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await provider.getBalance(deployer.address)), "MON");

  // Pyth Entropy on Monad Mainnet
  const ENTROPY_ADDRESS = "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320";
  const ENTROPY_PROVIDER = "0x52DeaA1c84233F7bb8C8A45baeDE41091c616506";

  // Fee recipient
  const FEE_RECIPIENT = "0x1CC17B568aA3b724DD9F48dE6593378064F35Bb3";

  // Relayer (same as deployer for now, can change later)
  const RELAYER = deployer.address;

  console.log("\n=== Deploying HiLo Contract ===");
  console.log("Entropy:", ENTROPY_ADDRESS);
  console.log("Entropy Provider:", ENTROPY_PROVIDER);
  console.log("Fee Recipient:", FEE_RECIPIENT);
  console.log("Relayer:", RELAYER);

  // Deploy upgradeable proxy
  const HiLo = await ethers.getContractFactory("HiLo", deployer);
  const hiLo = await upgrades.deployProxy(HiLo, [ENTROPY_ADDRESS, ENTROPY_PROVIDER], {
    initializer: "initialize",
    kind: "uups"
  });

  await hiLo.waitForDeployment();
  const proxyAddress = await hiLo.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\nProxy deployed to:", proxyAddress);
  console.log("Implementation:", implAddress);

  // Set relayer
  console.log("\n=== Setting Relayer ===");
  const setRelayerTx = await hiLo.setRelayer(RELAYER);
  await setRelayerTx.wait();
  console.log("Relayer set to:", RELAYER);

  // Set fee recipient
  console.log("\n=== Setting Fee Recipient ===");
  const setFeeTx = await hiLo.setFeeRecipient(FEE_RECIPIENT);
  await setFeeTx.wait();
  console.log("Fee recipient set to:", FEE_RECIPIENT);

  // Set bet limits (min 50, max 2500)
  console.log("\n=== Setting Bet Limits ===");
  const setBetLimitsTx = await hiLo.setBetLimits(
    ethers.parseEther("50"),
    ethers.parseEther("2500")
  );
  await setBetLimitsTx.wait();
  console.log("Min bet: 50 MON");
  console.log("Max bet: 2500 MON");

  // Fund contract with initial liquidity (optional)
  console.log("\n=== Funding Contract ===");
  const fundAmount = ethers.parseEther("1000");
  const fundTx = await deployer.sendTransaction({
    to: proxyAddress,
    value: fundAmount
  });
  await fundTx.wait();
  console.log("Funded with:", ethers.formatEther(fundAmount), "MON");

  // Verify settings
  console.log("\n=== Verification ===");
  const relayer = await hiLo.relayer();
  const feeRecipient = await hiLo.feeRecipient();
  const minBet = await hiLo.minBet();
  const maxBet = await hiLo.maxBet();
  const balance = await provider.getBalance(proxyAddress);

  console.log("Relayer:", relayer);
  console.log("Fee Recipient:", feeRecipient);
  console.log("Min Bet:", ethers.formatEther(minBet), "MON");
  console.log("Max Bet:", ethers.formatEther(maxBet), "MON");
  console.log("Contract Balance:", ethers.formatEther(balance), "MON");

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("Proxy Address:", proxyAddress);
  console.log("Implementation:", implAddress);
  console.log("Owner:", deployer.address);
  console.log("=".repeat(60));

  // Save to file
  const fs = require("fs");
  const deployedAddresses = {
    network: "monad-mainnet",
    chainId: 143,
    proxy: proxyAddress,
    implementation: implAddress,
    owner: deployer.address,
    relayer: RELAYER,
    feeRecipient: FEE_RECIPIENT,
    entropy: ENTROPY_ADDRESS,
    entropyProvider: ENTROPY_PROVIDER,
    deployedAt: new Date().toISOString()
  };
  fs.writeFileSync("./deployed-production.json", JSON.stringify(deployedAddresses, null, 2));
  console.log("\nAddresses saved to deployed-production.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
