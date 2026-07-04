const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON");

  // Pyth Entropy addresses for Monad Mainnet
  const ENTROPY_ADDRESS = "0xD458261E832415CFd3BAE5E416FdF3230ce6F134";
  const ENTROPY_PROVIDER = "0x52DeaA1c84233F7bb8C8A45baeDE41091c616506";

  // Bet limits
  const minBet = ethers.parseEther("0.01");  // 0.01 MON min bet
  const maxBet = ethers.parseEther("100");   // 100 MON max bet

  console.log("\n=== Deploying HiLo Contract ===");
  console.log("Entropy:", ENTROPY_ADDRESS);
  console.log("Entropy Provider:", ENTROPY_PROVIDER);
  console.log("Min Bet:", ethers.formatEther(minBet), "MON");
  console.log("Max Bet:", ethers.formatEther(maxBet), "MON");

  // Deploy HiLo as upgradeable proxy
  const HiLo = await ethers.getContractFactory("HiLo");
  const hiLo = await upgrades.deployProxy(
    HiLo,
    [ENTROPY_ADDRESS, ENTROPY_PROVIDER, minBet, maxBet],
    { kind: "uups" }
  );
  await hiLo.waitForDeployment();
  const hiLoAddress = await hiLo.getAddress();
  console.log("\nHiLo Proxy deployed to:", hiLoAddress);

  // Get implementation address
  const implAddress = await upgrades.erc1967.getImplementationAddress(hiLoAddress);
  console.log("HiLo Implementation deployed to:", implAddress);

  // Fund HiLo contract with 50 MON
  const fundAmount = ethers.parseEther("50");
  console.log("\nFunding HiLo contract with", ethers.formatEther(fundAmount), "MON...");
  const fundTx = await deployer.sendTransaction({
    to: hiLoAddress,
    value: fundAmount
  });
  await fundTx.wait();
  console.log("HiLo funded successfully!");

  // Verify contract balance
  const contractBalance = await ethers.provider.getBalance(hiLoAddress);
  console.log("Contract balance:", ethers.formatEther(contractBalance), "MON");

  // Get entropy fee
  const entropyFee = await hiLo.getEntropyFee();
  console.log("Entropy fee:", ethers.formatEther(entropyFee), "MON");

  console.log("\n=== Deployment Summary ===");
  console.log("Network: Monad Mainnet (chainId: 143)");
  console.log("HiLo Proxy:", hiLoAddress);
  console.log("HiLo Implementation:", implAddress);
  console.log("Owner:", deployer.address);
  console.log("Min Bet:", ethers.formatEther(minBet), "MON");
  console.log("Max Bet:", ethers.formatEther(maxBet), "MON");
  console.log("Contract Balance:", ethers.formatEther(contractBalance), "MON");
  console.log("Entropy Fee:", ethers.formatEther(entropyFee), "MON");

  // Export addresses
  const addresses = {
    hiLo: hiLoAddress,
    hiLoImplementation: implAddress,
    entropy: ENTROPY_ADDRESS,
    entropyProvider: ENTROPY_PROVIDER,
    owner: deployer.address,
    minBet: minBet.toString(),
    maxBet: maxBet.toString(),
    chainId: 143,
    network: "monadMainnet"
  };

  const fs = require("fs");
  fs.writeFileSync(
    "./deployed-mainnet.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("\nAddresses saved to deployed-mainnet.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
