const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON");

  // Monad Mainnet Pyth Entropy addresses
  const entropyAddress = "0xD458261E832415CFd3BAE5E416FdF3230ce6F134";
  const entropyProvider = "0x52DeaA1c84233F7bb8C8A45baeDE41091c616506";

  // Deploy parameters
  const minBet = ethers.parseEther("0.1");   // 0.1 MON minimum
  const maxBet = ethers.parseEther("1000");  // 1000 MON maximum
  const feeRecipient = deployer.address;     // Deployer receives fees

  console.log("\n=== Deploying Keno Contract ===");
  console.log("Entropy:", entropyAddress);
  console.log("Entropy Provider:", entropyProvider);
  console.log("Min Bet:", ethers.formatEther(minBet), "MON");
  console.log("Max Bet:", ethers.formatEther(maxBet), "MON");
  console.log("Fee Recipient:", feeRecipient);

  // Deploy upgradeable proxy
  const Keno = await ethers.getContractFactory("Keno");
  const keno = await upgrades.deployProxy(
    Keno,
    [entropyAddress, entropyProvider, minBet, maxBet, feeRecipient],
    { initializer: "initialize", kind: "uups" }
  );
  await keno.waitForDeployment();

  const proxyAddress = await keno.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\n=== Deployment Summary ===");
  console.log("Keno Proxy:", proxyAddress);
  console.log("Implementation:", implAddress);

  const balance = await ethers.provider.getBalance(proxyAddress);
  console.log("Contract balance:", ethers.formatEther(balance), "MON");

  // Get entropy fee
  const entropyFee = await keno.getEntropyFee();
  console.log("Entropy Fee:", ethers.formatEther(entropyFee), "MON");

  // Save addresses to file
  const network = await ethers.provider.getNetwork();
  const addresses = {
    kenoProxy: proxyAddress,
    kenoImplementation: implAddress,
    entropy: entropyAddress,
    entropyProvider: entropyProvider,
    feeRecipient: feeRecipient,
    minBet: ethers.formatEther(minBet),
    maxBet: ethers.formatEther(maxBet),
    network: network.name,
    chainId: Number(network.chainId)
  };

  const filename = network.chainId === 143n ? "./deployed-mainnet.json" : "./deployed-local.json";
  fs.writeFileSync(filename, JSON.stringify(addresses, null, 2));
  console.log("\nAddresses saved to", filename);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
