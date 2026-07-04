const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Blackjack with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON");

  // Pyth Entropy addresses for Monad Mainnet
  const ENTROPY_ADDRESS = process.env.ENTROPY_ADDRESS || "0xD458261E832415CFd3BAE5E416FdF3230ce6F134";
  const ENTROPY_PROVIDER = process.env.ENTROPY_PROVIDER || "0x52DeaA1c84233F7bb8C8A45baeDE41091c616506";

  // Bet limits (user specified: 0.01 - 10 MON)
  const minBet = ethers.parseEther("0.01");  // 0.01 MON min bet
  const maxBet = ethers.parseEther("10");    // 10 MON max bet

  console.log("\n=== Deploying Blackjack Contract ===");
  console.log("Entropy:", ENTROPY_ADDRESS);
  console.log("Entropy Provider:", ENTROPY_PROVIDER);
  console.log("Min Bet:", ethers.formatEther(minBet), "MON");
  console.log("Max Bet:", ethers.formatEther(maxBet), "MON");

  // Deploy Blackjack as upgradeable proxy
  const Blackjack = await ethers.getContractFactory("Blackjack");
  const blackjack = await upgrades.deployProxy(
    Blackjack,
    [ENTROPY_ADDRESS, ENTROPY_PROVIDER, minBet, maxBet],
    { kind: "uups" }
  );
  await blackjack.waitForDeployment();
  const blackjackAddress = await blackjack.getAddress();
  console.log("\nBlackjack Proxy deployed to:", blackjackAddress);

  // Get implementation address
  const implAddress = await upgrades.erc1967.getImplementationAddress(blackjackAddress);
  console.log("Blackjack Implementation deployed to:", implAddress);

  // Set relayer to deployer (same key for testing)
  console.log("\nSetting relayer to deployer address...");
  const setRelayerTx = await blackjack.setRelayer(deployer.address);
  await setRelayerTx.wait();
  console.log("Relayer set to:", deployer.address);

  // Set fee recipient to deployer
  console.log("Setting fee recipient to deployer address...");
  const setFeeTx = await blackjack.setFeeRecipient(deployer.address);
  await setFeeTx.wait();
  console.log("Fee recipient set to:", deployer.address);

  // Fund Blackjack contract with 100 MON (needs more for blackjack payouts)
  const fundAmount = ethers.parseEther("100");
  console.log("\nFunding Blackjack contract with", ethers.formatEther(fundAmount), "MON...");
  const fundTx = await deployer.sendTransaction({
    to: blackjackAddress,
    value: fundAmount
  });
  await fundTx.wait();
  console.log("Blackjack funded successfully!");

  // Verify contract balance
  const contractBalance = await ethers.provider.getBalance(blackjackAddress);
  console.log("Contract balance:", ethers.formatEther(contractBalance), "MON");

  // Get entropy fee
  const entropyFee = await blackjack.getEntropyFee();
  console.log("Entropy fee:", ethers.formatEther(entropyFee), "MON");

  console.log("\n=== Deployment Summary ===");
  console.log("Network: Monad Mainnet (chainId: 143)");
  console.log("Blackjack Proxy:", blackjackAddress);
  console.log("Blackjack Implementation:", implAddress);
  console.log("Owner:", deployer.address);
  console.log("Relayer:", deployer.address);
  console.log("Fee Recipient:", deployer.address);
  console.log("Min Bet:", ethers.formatEther(minBet), "MON");
  console.log("Max Bet:", ethers.formatEther(maxBet), "MON");
  console.log("Contract Balance:", ethers.formatEther(contractBalance), "MON");
  console.log("Entropy Fee:", ethers.formatEther(entropyFee), "MON");

  // Export addresses
  const addresses = {
    blackjack: blackjackAddress,
    blackjackImplementation: implAddress,
    entropy: ENTROPY_ADDRESS,
    entropyProvider: ENTROPY_PROVIDER,
    owner: deployer.address,
    relayer: deployer.address,
    feeRecipient: deployer.address,
    minBet: minBet.toString(),
    maxBet: maxBet.toString(),
    chainId: 143,
    network: "monadMainnet",
    deployedAt: new Date().toISOString()
  };

  const fs = require("fs");
  fs.writeFileSync(
    "./deployed-mainnet.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("\nAddresses saved to deployed-mainnet.json");

  // Also update .env with contract address
  console.log("\n=== Next Steps ===");
  console.log("1. Update .env with BLACKJACK_CONTRACT_ADDRESS=" + blackjackAddress);
  console.log("2. Run backend: cd backend && node server.js");
  console.log("3. Test with frontend");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
