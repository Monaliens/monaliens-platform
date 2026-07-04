const { ethers } = require("hardhat");

async function main() {
  const contract = await ethers.getContractAt("Mines", "0x541997E9FAB55BAFbe1e5c8AE9F320674A30F5a0");

  console.log("Setting bet limits: min=10 MON, max=1000 MON");

  const tx = await contract.setBetLimits(
    ethers.parseEther("10"),
    ethers.parseEther("1000")
  );

  console.log("TX:", tx.hash);
  await tx.wait();
  console.log("Done!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
