import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { getContractAddress } from "./contract-address";

dotenv.config();

async function main() {
  const contractAddress = getContractAddress();

  if (!contractAddress) {
    throw new Error("Contract address not found. Please deploy first: npm run deploy");
  }

  console.log(" Verifying contract...\n");
  console.log("Contract Address:", contractAddress);

  const ENTROPY_CONTRACT = "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320";
  const ENTROPY_PROVIDER = "0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344";
  const LMON_TOKEN = "0xECc6F8fB4962cBF02D83CEE8c4d9c2C96204A17D";

  // Verify contract code exists
  const code = await ethers.provider.getCode(contractAddress);
  if (code === "0x") {
    throw new Error("Contract not found at address");
  }
  console.log(" Contract code exists");

  // Verify contract state
  const CoinFlip = await ethers.getContractFactory("CoinFlip");
  const coinFlip = CoinFlip.attach(contractAddress);

  const [entropy, entropyProvider, owner, lmonToken, maxBetNative, maxBetLMON] = await Promise.all([
    coinFlip.entropy(),
    coinFlip.entropyProvider(),
    coinFlip.owner(),
    coinFlip.lmonToken(),
    coinFlip.maxBetNative(),
    coinFlip.maxBetLMON(),
  ]);

  console.log("\n Contract State:");
  console.log("  Entropy Contract:", entropy);
  console.log("  Entropy Provider:", entropyProvider);
  console.log("  Owner:", owner);
  console.log("  LMON Token:", lmonToken);
  console.log("  Max Bet Native:", ethers.formatEther(maxBetNative), "MON", maxBetNative === 0n ? "(unlimited)" : "");
  console.log("  Max Bet LMON:", ethers.formatEther(maxBetLMON), "LMON", maxBetLMON === 0n ? "(unlimited)" : "");

  // Verify values
  if (entropy.toLowerCase() !== ENTROPY_CONTRACT.toLowerCase()) {
    console.log("    Entropy contract mismatch!");
  } else {
    console.log("   Entropy contract matches");
  }

  if (entropyProvider.toLowerCase() !== ENTROPY_PROVIDER.toLowerCase()) {
    console.log("    Entropy provider mismatch!");
  } else {
    console.log("   Entropy provider matches");
  }

  if (lmonToken.toLowerCase() !== LMON_TOKEN.toLowerCase()) {
    console.log("    LMON token mismatch!");
  } else {
    console.log("   LMON token matches");
  }

  // Check balances
  const [monBalance, lmonBalance] = await Promise.all([
    coinFlip.contractBalance(),
    coinFlip.contractLMONBalance(),
  ]);

  console.log("\n Contract Balances:");
  console.log("  Native MON:", ethers.formatEther(monBalance), "MON");
  console.log("  LMON:", ethers.formatEther(lmonBalance), "LMON");

  // Get entropy fee
  const entropyFee = await coinFlip.getEntropyFee();
  console.log("\n Entropy Fee:", ethers.formatEther(entropyFee), "MON");

  console.log("\n Contract verification complete!");
  console.log("\n To verify on block explorer, run:");
  console.log(
    `   hardhat verify --network monad-testnet ${contractAddress} ${ENTROPY_CONTRACT} ${ENTROPY_PROVIDER} ${LMON_TOKEN}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

