const { ethers } = require("hardhat");
const fs = require("fs");

// Plinko ABI for admin functions
const PLINKO_ABI = [
  "function setHighMultipliers(uint256[11] calldata multipliers) external",
  "function setMediumMultipliers(uint256[17] calldata multipliers) external",
  "function setLowMultipliers(uint256[17] calldata multipliers) external",
  "function getMultipliers(uint8 riskLevel) external view returns (uint256[] memory)"
];

async function main() {
  console.log("Setting Plinko multipliers...\n");

  // Load deployment info
  const deploymentInfo = JSON.parse(fs.readFileSync("deployed-mainnet.json", "utf-8"));
  const proxyAddress = deploymentInfo.proxy;

  const [owner] = await ethers.getSigners();
  console.log("Owner:", owner.address);
  console.log("Contract:", proxyAddress);

  const plinko = new ethers.Contract(proxyAddress, PLINKO_ABI, owner);

  // ========================================
  // MULTIPLIER TABLES (PRECISION = 10000)
  // ========================================
  // Values from plinko_*_multipliers.csv files (RTP ~99%)

  // HIGH: 10 rows, 11 buckets (indices 0-10)
  // From: 73.72, 9.70, 2.91, 0.87, 0.29, 0.19, 0.29, 0.87, 2.91, 9.70, 73.72
  const highMultipliers = [
    737200,   // 0: 73.72x
    97000,    // 1: 9.70x
    29100,    // 2: 2.91x
    8700,     // 3: 0.87x
    2900,     // 4: 0.29x
    1900,     // 5: 0.19x
    2900,     // 6: 0.29x
    8700,     // 7: 0.87x
    29100,    // 8: 2.91x
    97000,    // 9: 9.70x
    737200    // 10: 73.72x
  ];

  // MEDIUM: 16 rows, 17 buckets (indices 0-16)
  // From: 106.70, 39.77, 9.70, 4.85, 2.91, 1.46, 0.97, 0.49, 0.29, 0.49, 0.97, 1.46, 2.91, 4.85, 9.70, 39.77, 106.70
  const mediumMultipliers = [
    1067000,  // 0: 106.70x
    397700,   // 1: 39.77x
    97000,    // 2: 9.70x
    48500,    // 3: 4.85x
    29100,    // 4: 2.91x
    14600,    // 5: 1.46x
    9700,     // 6: 0.97x
    4900,     // 7: 0.49x
    2900,     // 8: 0.29x
    4900,     // 9: 0.49x
    9700,     // 10: 0.97x
    14600,    // 11: 1.46x
    29100,    // 12: 2.91x
    48500,    // 13: 4.85x
    97000,    // 14: 9.70x
    397700,   // 15: 39.77x
    1067000   // 16: 106.70x
  ];

  // LOW: 16 rows, 17 buckets (indices 0-16)
  // From: 15.52, 8.73, 1.94, 1.36, 1.36, 1.16, 1.07, 0.97, 0.49, 0.97, 1.07, 1.16, 1.36, 1.36, 1.94, 8.73, 15.52
  const lowMultipliers = [
    155200,   // 0: 15.52x
    87300,    // 1: 8.73x
    19400,    // 2: 1.94x
    13600,    // 3: 1.36x
    13600,    // 4: 1.36x
    11600,    // 5: 1.16x
    10700,    // 6: 1.07x
    9700,     // 7: 0.97x
    4900,     // 8: 0.49x
    9700,     // 9: 0.97x
    10700,    // 10: 1.07x
    11600,    // 11: 1.16x
    13600,    // 12: 1.36x
    13600,    // 13: 1.36x
    19400,    // 14: 1.94x
    87300,    // 15: 8.73x
    155200    // 16: 15.52x
  ];

  console.log("\nSetting HIGH multipliers (10 rows, 11 buckets)...");
  console.log("Values:", highMultipliers.map(m => (m/10000).toFixed(2) + "x").join(", "));
  let tx = await plinko.setHighMultipliers(highMultipliers);
  await tx.wait();
  console.log("TX:", tx.hash);

  console.log("\nSetting MEDIUM multipliers (16 rows, 17 buckets)...");
  console.log("Values:", mediumMultipliers.map(m => (m/10000).toFixed(2) + "x").join(", "));
  tx = await plinko.setMediumMultipliers(mediumMultipliers);
  await tx.wait();
  console.log("TX:", tx.hash);

  console.log("\nSetting LOW multipliers (16 rows, 17 buckets)...");
  console.log("Values:", lowMultipliers.map(m => (m/10000).toFixed(2) + "x").join(", "));
  tx = await plinko.setLowMultipliers(lowMultipliers);
  await tx.wait();
  console.log("TX:", tx.hash);

  // Verify
  console.log("\n--- Verification ---");
  const highMults = await plinko.getMultipliers(2); // HIGH = 2
  const medMults = await plinko.getMultipliers(1);  // MEDIUM = 1
  const lowMults = await plinko.getMultipliers(0);  // LOW = 0

  console.log("HIGH:", highMults.map(m => (Number(m)/10000).toFixed(2) + "x").join(", "));
  console.log("MEDIUM:", medMults.map(m => (Number(m)/10000).toFixed(2) + "x").join(", "));
  console.log("LOW:", lowMults.map(m => (Number(m)/10000).toFixed(2) + "x").join(", "));

  console.log("\nMultipliers set successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
