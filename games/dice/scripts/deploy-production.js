const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON");

  // Production parameters
  const minBet = ethers.parseEther("0.01"); // 0.01 MON
  const maxBet = ethers.parseEther("100");  // 100 MON
  const feeRecipient = "0x1CC17B568aA3b724DD9F48dE6593378064F35Bb3"; // Fee wallet

  console.log("\n=== Deploying Dice Contract (Production) ===");
  console.log("Min Bet:", ethers.formatEther(minBet), "MON");
  console.log("Max Bet:", ethers.formatEther(maxBet), "MON");
  console.log("Fee Recipient:", feeRecipient);

  // Deploy upgradeable proxy
  const Dice = await ethers.getContractFactory("Dice");
  const dice = await upgrades.deployProxy(
    Dice,
    [minBet, maxBet, feeRecipient],
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
