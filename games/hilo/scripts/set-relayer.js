const { ethers } = require("hardhat");

async function main() {
  const PRODUCTION_CONTRACT = "0x12910d41f561EA125eECBe270a61BA0638697fd8";
  const NEW_RELAYER = "0x7a6a73d59F3aA8518b96604aF21da8476a51E1Bb";

  // Use production private key
  const productionKey = process.env.PRODUCTION_PRIVATE_KEY;
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const owner = new ethers.Wallet(productionKey, provider);

  console.log("Owner:", owner.address);

  const HiLo = await ethers.getContractAt("HiLo", PRODUCTION_CONTRACT, owner);

  const currentRelayer = await HiLo.relayer();
  console.log("Current relayer:", currentRelayer);

  console.log("Setting new relayer:", NEW_RELAYER);
  const tx = await HiLo.setRelayer(NEW_RELAYER);
  await tx.wait();

  const newRelayer = await HiLo.relayer();
  console.log("New relayer:", newRelayer);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
