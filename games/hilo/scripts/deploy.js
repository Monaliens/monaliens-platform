const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Deploy FakeVRF first
  const vrfFee = ethers.parseEther("0.001"); // 0.001 ETH fee for testing
  const FakeVRF = await ethers.getContractFactory("FakeVRF");
  const fakeVRF = await FakeVRF.deploy(vrfFee);
  await fakeVRF.waitForDeployment();
  const fakeVRFAddress = await fakeVRF.getAddress();
  console.log("FakeVRF deployed to:", fakeVRFAddress);

  // Deploy HiLo as upgradeable proxy
  const minBet = ethers.parseEther("0.01");  // 0.01 ETH min bet
  const maxBet = ethers.parseEther("100");   // 100 ETH max bet

  const HiLo = await ethers.getContractFactory("HiLo");
  const hiLo = await upgrades.deployProxy(
    HiLo,
    [fakeVRFAddress, minBet, maxBet],
    { kind: "uups" }
  );
  await hiLo.waitForDeployment();
  const hiLoAddress = await hiLo.getAddress();
  console.log("HiLo Proxy deployed to:", hiLoAddress);

  // Get implementation address
  const implAddress = await upgrades.erc1967.getImplementationAddress(hiLoAddress);
  console.log("HiLo Implementation deployed to:", implAddress);

  // Set HiLo contract in FakeVRF
  await fakeVRF.setHiLoContract(hiLoAddress);
  console.log("FakeVRF configured with HiLo contract");

  // Fund HiLo contract with initial liquidity
  const initialLiquidity = ethers.parseEther("10");
  await deployer.sendTransaction({
    to: hiLoAddress,
    value: initialLiquidity
  });
  console.log("HiLo funded with", ethers.formatEther(initialLiquidity), "ETH");

  console.log("\n=== Deployment Summary ===");
  console.log("FakeVRF:", fakeVRFAddress);
  console.log("HiLo Proxy:", hiLoAddress);
  console.log("HiLo Implementation:", implAddress);
  console.log("VRF Fee:", ethers.formatEther(vrfFee), "ETH");
  console.log("Min Bet:", ethers.formatEther(minBet), "ETH");
  console.log("Max Bet:", ethers.formatEther(maxBet), "ETH");

  // Export addresses for frontend
  const addresses = {
    fakeVRF: fakeVRFAddress,
    hiLo: hiLoAddress,
    hiLoImplementation: implAddress,
    vrfFee: vrfFee.toString(),
    minBet: minBet.toString(),
    maxBet: maxBet.toString(),
    chainId: 31337
  };

  const fs = require("fs");
  fs.writeFileSync(
    "./deployed-addresses.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("\nAddresses saved to deployed-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
