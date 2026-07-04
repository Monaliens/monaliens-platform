// Deploy script for TokenAirdrop contract
async function main() {
  try {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying TokenAirdrop contract with the account:", deployer.address);
    
    const TokenAirdrop = await ethers.getContractFactory("TokenAirdrop");
    const tokenAirdrop = await TokenAirdrop.deploy();
    
    await tokenAirdrop.deployed();
    
    console.log("TokenAirdrop contract deployed to:", tokenAirdrop.address);
    console.log("Transaction hash:", tokenAirdrop.deployTransaction.hash);
    
    // Print out the details for adding to environment variables
    console.log("\n------------------------------------");
    console.log("Add this to your .env file:");
    console.log(`REACT_APP_TOKEN_AIRDROP_ADDRESS="${tokenAirdrop.address}"`);
    console.log("------------------------------------\n");
    
    return tokenAirdrop;
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 