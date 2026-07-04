import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { getContractAddress } from "./contract-address";

dotenv.config();

async function main() {
  const [signer] = await ethers.getSigners();
  const contractAddress = getContractAddress();

  if (!contractAddress) {
    throw new Error("Contract address not found. Please deploy first: npm run deploy");
  }

  console.log(" Funding contract with 10 MON...\n");
  console.log("Contract Address:", contractAddress);
  console.log("From Address:", signer.address);

  const balance = await ethers.provider.getBalance(signer.address);
  console.log("Your Balance:", ethers.formatEther(balance), "MON");

  const tenMon = ethers.parseEther("10");
  
  if (balance < tenMon) {
    throw new Error(`Insufficient balance. Need ${ethers.formatEther(tenMon)} MON, have ${ethers.formatEther(balance)} MON`);
  }

  console.log("\n Sending 10 MON to contract...");
  const tx = await signer.sendTransaction({
    to: contractAddress,
    value: tenMon,
  });

  console.log("Transaction hash:", tx.hash);
  console.log(" View on MonVision:", `https://testnet.monvision.io/tx/${tx.hash}`);
  console.log("Waiting for confirmation...");
  
  const receipt = await tx.wait();
  console.log(" Transaction confirmed in block:", receipt?.blockNumber);

  // Verify balance
  const contractBalance = await ethers.provider.getBalance(contractAddress);
  console.log("\n Contract Balance:", ethers.formatEther(contractBalance), "MON");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

