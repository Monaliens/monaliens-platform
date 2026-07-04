const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Deploy parameters
  const minBet = ethers.parseEther("0.01"); // 0.01 ETH for local testing
  const maxBet = ethers.parseEther("100");  // 100 ETH
  const feeRecipient = deployer.address;    // Deployer receives fees for testing

  console.log("\n=== Deploying Dice Contract ===");
  console.log("Min Bet:", ethers.formatEther(minBet), "ETH");
  console.log("Max Bet:", ethers.formatEther(maxBet), "ETH");
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

  // Fund contract with some ETH for payouts
  console.log("\n=== Funding Contract ===");
  const fundAmount = ethers.parseEther("1000");
  const fundTx = await deployer.sendTransaction({
    to: proxyAddress,
    value: fundAmount
  });
  await fundTx.wait();
  console.log("Funded contract with:", ethers.formatEther(fundAmount), "ETH");

  const balance = await ethers.provider.getBalance(proxyAddress);
  console.log("Contract balance:", ethers.formatEther(balance), "ETH");

  // Save addresses to file
  const fs = require("fs");
  const addresses = {
    diceProxy: proxyAddress,
    diceImplementation: implAddress,
    feeRecipient: feeRecipient,
    network: "localhost",
    chainId: 31337
  };
  fs.writeFileSync("./deployed-local.json", JSON.stringify(addresses, null, 2));
  console.log("\nAddresses saved to deployed-local.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
