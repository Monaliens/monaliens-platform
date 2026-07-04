import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { getContractAddress } from "./contract-address";

dotenv.config();

async function main() {
  const [signer] = await ethers.getSigners();
  const contractAddress = getContractAddress();
  const LMON_TOKEN = "0xECc6F8fB4962cBF02D83CEE8c4d9c2C96204A17D";

  if (!contractAddress) {
    throw new Error("Contract address not found. Please deploy first: npm run deploy");
  }

  console.log(" Funding contract with 100 LMON...\n");
  console.log("Contract Address:", contractAddress);
  console.log("From Address:", signer.address);

  const erc20Abi = [
    "function balanceOf(address account) external view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
  ];

  const lmonToken = new ethers.Contract(LMON_TOKEN, erc20Abi, signer);

  const [balance, symbol, decimals] = await Promise.all([
    lmonToken.balanceOf(signer.address),
    lmonToken.symbol().catch(() => "LMON"),
    lmonToken.decimals().catch(() => 18),
  ]);

  console.log("Your LMON Balance:", ethers.formatUnits(balance, decimals), symbol);

  const hundredLmon = ethers.parseEther("100");

  if (balance < hundredLmon) {
    throw new Error(
      `Insufficient LMON balance. Need ${ethers.formatEther(hundredLmon)} ${symbol}, have ${ethers.formatUnits(balance, decimals)} ${symbol}`
    );
  }

  console.log("\n Sending 100 LMON to contract...");
  const tx = await lmonToken.transfer(contractAddress, hundredLmon);
  console.log("Transaction hash:", tx.hash);
  console.log(" View on MonVision:", `https://testnet.monvision.io/tx/${tx.hash}`);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log(" Transaction confirmed in block:", receipt?.blockNumber);

  // Verify balance
  const contractBalance = await lmonToken.balanceOf(contractAddress);
  console.log("\n Contract LMON Balance:", ethers.formatUnits(contractBalance, decimals), symbol);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

