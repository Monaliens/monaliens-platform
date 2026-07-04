import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
import { saveContractAddress } from "./contract-address";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying CoinFlip contract with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON");

  // Get network info first
  const network = await ethers.provider.getNetwork();
  const isMainnet = network.chainId === 143n;

  // Contract addresses - different for mainnet and testnet
  const ENTROPY_CONTRACT = isMainnet
    ? "0xD458261E832415CFd3BAE5E416FdF3230ce6F134"  // Mainnet
    : "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320"; // Testnet

  const ENTROPY_PROVIDER = isMainnet
    ? "0x52DeaA1c84233F7bb8C8A45baeDE41091c616506"  // Mainnet
    : "0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344"; // Testnet

  // LMON token - only testnet has it, mainnet uses dummy address
  const LMON_TOKEN = isMainnet
    ? "0x0000000000000000000000000000000000000001"  // Dummy address for mainnet (won't be used)
    : "0xECc6F8fB4962cBF02D83CEE8c4d9c2C96204A17D"; // Testnet
  
  // Max bet limits (0 = unlimited)
  // Set to 50 MON and 100k LMON
  const MAX_BET_NATIVE = ethers.parseEther("50"); // 50 MON
  const MAX_BET_LMON = ethers.parseEther("100000"); // 100k LMON

  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  console.log("\n Using contract addresses:");
  console.log("   Entropy:", ENTROPY_CONTRACT);
  console.log("   Provider:", ENTROPY_PROVIDER);
  console.log("   LMON:", LMON_TOKEN, isMainnet ? "(dummy - not used)" : "");

  // Deploy implementation contract
  console.log("\n Deploying CoinFlip implementation contract...");
  const CoinFlip = await ethers.getContractFactory("CoinFlip");
  
  // Deploy proxy with UUPS pattern
  console.log(" Deploying UUPS Proxy...");
  const coinFlip = await upgrades.deployProxy(
    CoinFlip,
    [
      ENTROPY_CONTRACT,
      ENTROPY_PROVIDER,
      LMON_TOKEN,
      MAX_BET_NATIVE,
      MAX_BET_LMON,
    ],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );

  await coinFlip.waitForDeployment();
  const proxyAddress = await coinFlip.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\n CoinFlip Proxy deployed to:", proxyAddress);
  console.log(" Implementation deployed to:", implementationAddress);

  // Save contract addresses
  saveContractAddress(proxyAddress, network.name);

  // Get entropy fee
  const entropyFee = await coinFlip.getEntropyFee();
  console.log("\n Entropy Fee:", ethers.formatEther(entropyFee), "MON");
  
  // Get max bet limits
  const maxBetNative = await coinFlip.maxBetNative();
  const maxBetLMON = await coinFlip.maxBetLMON();
  console.log("\n Max Bet Limits:");
  console.log("   Max MON bet:", ethers.formatEther(maxBetNative), "MON");
  console.log("   Max LMON bet:", ethers.formatEther(maxBetLMON), "LMON");

  console.log("\n Next steps:");
  console.log("  1. Fund contract: npm run fund-mon");
  console.log("  2. Fund LMON: npm run fund-lmon");
  console.log("  3. Test flip: npm run flip-mon-0.1");
  console.log("  4. Test LMON flip: npm run flip-lmon-10");
  console.log("  5. Verify contracts: npm run verify-contract");
  console.log("  6. Update limits: coinFlip.setMaxBetLimits(newMaxNative, newMaxLMON)");

  console.log("\n Proxy Address (use this):", proxyAddress);
  console.log(" Implementation Address:", implementationAddress);
  console.log("\n Verify Proxy with:");
  console.log(`   hardhat verify --network monad-testnet ${proxyAddress}`);
  console.log("\n Verify Implementation with:");
  console.log(`   hardhat verify --network monad-testnet ${implementationAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

