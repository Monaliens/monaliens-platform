const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON");

  // Production parameters
  const entropy = "0xD458261E832415CFd3BAE5E416FdF3230ce6F134"; // Pyth Entropy on Monad
  const entropyProvider = "0x52DeaA1c84233F7bb8C8A45baeDE41091c616506"; // Pyth provider
  const minBet = ethers.parseEther("50");   // 50 MON
  const maxBet = ethers.parseEther("1000"); // 1000 MON
  const feeRecipient = "0x1CC17B568aA3b724DD9F48dE6593378064F35Bb3"; // Fee wallet

  console.log("\n=== Deploying Dice Contract (Production) ===");
  console.log("Entropy:", entropy);
  console.log("Entropy Provider:", entropyProvider);
  console.log("Min Bet:", ethers.formatEther(minBet), "MON");
  console.log("Max Bet:", ethers.formatEther(maxBet), "MON");
  console.log("Fee Recipient:", feeRecipient);

  // Deploy upgradeable proxy
  const Dice = await ethers.getContractFactory("Dice");
  const dice = await upgrades.deployProxy(
    Dice,
    [entropy, entropyProvider, minBet, maxBet, feeRecipient],
    { initializer: "initialize", kind: "uups" }
  );
  await dice.waitForDeployment();

  const proxyAddress = await dice.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\n=== Deployment Summary ===");
  console.log("Dice Proxy:", proxyAddress);
  console.log("Implementation:", implAddress);
  console.log("Owner:", deployer.address);
  console.log("Fee Recipient:", feeRecipient);

  // Save addresses to file
  const fs = require("fs");
  const addresses = {
    diceProxy: proxyAddress,
    diceImplementation: implAddress,
    owner: deployer.address,
    feeRecipient: feeRecipient,
    minBet: "50",
    maxBet: "1000",
    network: "monad-mainnet",
    deployedAt: new Date().toISOString()
  };
  fs.writeFileSync("./deployed-production.json", JSON.stringify(addresses, null, 2));
  console.log("\nAddresses saved to deployed-production.json");

  console.log("\n=== Next Steps ===");
  console.log("1. Fund the contract with MON for payouts");
  console.log("2. Set Entropy address: setEntropy(0x...)");
  console.log("3. Set Entropy provider: setEntropyProvider(0x...)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
