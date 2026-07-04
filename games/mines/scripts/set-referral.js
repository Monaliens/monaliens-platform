const { ethers } = require("hardhat");

async function main() {
  const contractAddress = process.env.MINES_CONTRACT_ADDRESS || "0x541997E9FAB55BAFbe1e5c8AE9F320674A30F5a0";
  const referralAddress = process.env.REFERRAL_CONTRACT || "0xD6C3a8C266B8221b4F5Ad5dEF126cf0549BFA8Ee";

  const contract = await ethers.getContractAt("Mines", contractAddress);

  console.log("Current referral contract:", await contract.referralContract());
  console.log("Setting referral contract to:", referralAddress);

  const tx = await contract.setReferralContract(referralAddress);
  console.log("TX:", tx.hash);
  await tx.wait();

  console.log("Done! Referral contract:", await contract.referralContract());
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
