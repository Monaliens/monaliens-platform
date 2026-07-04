const { ethers, upgrades } = require("hardhat");

// Monad Mainnet Pyth Entropy addresses
const ENTROPY_ADDRESS = "0xD458261E832415CFd3BAE5E416FdF3230ce6F134";
const ENTROPY_PROVIDER = "0x52DeaA1c84233F7bb8C8A45baeDE41091c616506";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON");

  // Deploy parameters
  const minBet = ethers.parseEther("0.01"); // 0.01 MON
  const maxBet = ethers.parseEther("100");  // 100 MON
  const feeRecipient = deployer.address;    // Change this to your fee recipient

  console.log("\n=== Deploy Parameters ===");
  console.log("Entropy:", ENTROPY_ADDRESS);
  console.log("Entropy Provider:", ENTROPY_PROVIDER);
  console.log("Min Bet:", ethers.formatEther(minBet), "MON");
  console.log("Max Bet:", ethers.formatEther(maxBet), "MON");
  console.log("Fee Recipient:", feeRecipient);

  console.log("\n=== Deploying Dice Contract ===");

  // Deploy upgradeable proxy with VRF
  const Dice = await ethers.getContractFactory("Dice");
  const dice = await upgrades.deployProxy(
    Dice,
    [ENTROPY_ADDRESS, ENTROPY_PROVIDER, minBet, maxBet, feeRecipient],
    { initializer: "initialize", kind: "uups" }
  );
  await dice.waitForDeployment();

  const proxyAddress = await dice.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\n=== Deployment Summary ===");
  console.log("Dice Proxy:", proxyAddress);
  console.log("Implementation:", implAddress);

  // Check entropy fee
  const entropyFee = await dice.getEntropyFee();
  console.log("Entropy Fee:", ethers.formatEther(entropyFee), "MON");

  const balance = await ethers.provider.getBalance(proxyAddress);
  console.log("Contract balance:", ethers.formatEther(balance), "MON");

  // Save addresses to file
  const fs = require("fs");
  const addresses = {
    diceProxy: proxyAddress,
    diceImplementation: implAddress,
    entropy: ENTROPY_ADDRESS,
    entropyProvider: ENTROPY_PROVIDER,
    feeRecipient: feeRecipient,
    network: "monad-mainnet",
    chainId: 10143
  };
  fs.writeFileSync("./deployed-mainnet.json", JSON.stringify(addresses, null, 2));
  console.log("\nAddresses saved to deployed-mainnet.json");

  console.log("\n=== Next Steps ===");
  console.log("1. Fund the contract with MON for payouts");
  console.log("2. Update backend .env with new contract address");
  console.log("3. Update frontend constants with new contract address");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
