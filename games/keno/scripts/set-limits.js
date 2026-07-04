const { ethers } = require("hardhat");

async function main() {
  const keno = await ethers.getContractAt("Keno", "0xE5D2f5d2a8dcc3be155cdF70A864F63aeF459107");
  
  const minBet = ethers.parseEther("10");   // 10 MON
  const maxBet = ethers.parseEther("500");  // 500 MON
  
  console.log("Setting bet limits...");
  console.log("Min:", ethers.formatEther(minBet), "MON");
  console.log("Max:", ethers.formatEther(maxBet), "MON");
  
  const tx = await keno.setBetLimits(minBet, maxBet);
  await tx.wait();
  
  console.log("Done:", tx.hash);
}

main().catch(console.error);
