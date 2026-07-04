const { ethers } = require("hardhat");

const CONTRACT = "0x541997E9FAB55BAFbe1e5c8AE9F320674A30F5a0";
const NEW_FEE_RECIPIENT = "0x1CC17B568aA3b724DD9F48dE6593378064F35Bb3";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  
  const abi = [
    "function setFeeRecipient(address _newRecipient) external",
    "function feeRecipient() external view returns (address)"
  ];
  
  const contract = new ethers.Contract(CONTRACT, abi, signer);
  
  const currentRecipient = await contract.feeRecipient();
  console.log("Current fee recipient:", currentRecipient);
  console.log("New fee recipient:", NEW_FEE_RECIPIENT);
  
  console.log("Setting new fee recipient...");
  const tx = await contract.setFeeRecipient(NEW_FEE_RECIPIENT);
  console.log("TX:", tx.hash);
  await tx.wait();
  
  const updatedRecipient = await contract.feeRecipient();
  console.log("Updated fee recipient:", updatedRecipient);
  console.log("Done!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
