const { ethers } = require("hardhat");

async function main() {
  console.log(" Starting TokenAirdrop deployment to Monad testnet...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  
  console.log(" Deploying with account:", deployerAddress);
  
  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployerAddress);
  console.log(" Account balance:", ethers.utils.formatEther(balance), "ETH");
  
  if (balance.lt(ethers.utils.parseEther("0.01"))) {
    console.log("  Warning: Low balance. Make sure you have enough ETH for deployment.");
  }
  
  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log(" Network:", network.name, "Chain ID:", network.chainId.toString());
  
  try {
    // Deploy TokenAirdrop contract
    console.log("\n Deploying TokenAirdrop contract...");
    const TokenAirdrop = await ethers.getContractFactory("TokenAirdrop");
    
    // Estimate gas for deployment
    const deploymentData = TokenAirdrop.getDeployTransaction();
    const estimatedGas = await ethers.provider.estimateGas({
      data: deploymentData.data
    });
    console.log(" Estimated gas for deployment:", estimatedGas.toString());
    
    // Deploy with specific gas limit
    const tokenAirdrop = await TokenAirdrop.deploy({
      gasLimit: estimatedGas.mul(120).div(100) // Add 20% buffer
    });
    
    console.log(" Waiting for deployment transaction to be mined...");
    await tokenAirdrop.deployed();
    
    const contractAddress = tokenAirdrop.address;
    console.log(" TokenAirdrop deployed successfully!");
    console.log(" Contract address:", contractAddress);
    
    // Get deployment transaction details
    const deploymentTx = tokenAirdrop.deployTransaction;
    if (deploymentTx) {
      console.log(" Deployment transaction hash:", deploymentTx.hash);
      console.log(" Gas used for deployment:", deploymentTx.gasLimit?.toString());
      
      // Wait for additional confirmations
      console.log(" Waiting for additional confirmations...");
      const receipt = await deploymentTx.wait(3); // Wait for 3 confirmations
      console.log(" Transaction confirmed in block:", receipt?.blockNumber);
      console.log(" Actual gas used:", receipt?.gasUsed?.toString());
    }
    
    // Verify contract functions are working
    console.log("\n Verifying contract deployment...");
    
    // Test a simple view function
    try {
      const contractBalance = await tokenAirdrop.getContractBalance();
      console.log(" Contract balance:", ethers.utils.formatEther(contractBalance), "ETH");
      console.log(" Contract is responding correctly!");
    } catch (error) {
      console.log(" Error testing contract:", error.message);
    }
    
    // Test gas estimation functions
    try {
      const testRecipients = [deployerAddress, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"];
      const testWeights = [40, 60];
      
      const linearGasEstimate = await tokenAirdrop.estimateLinearNativeAirdropGas(testRecipients, testWeights);
      const equalGasEstimate = await tokenAirdrop.estimateEqualNativeAirdropGas(testRecipients);
      
      console.log(" Linear airdrop gas estimate:", linearGasEstimate.toString());
      console.log(" Equal airdrop gas estimate:", equalGasEstimate.toString());
      console.log(" Gas estimation functions working!");
    } catch (error) {
      console.log(" Error testing gas estimation:", error.message);
    }
    
    console.log("\n Deployment completed successfully!");
    console.log(" Contract Summary:");
    console.log("   • Contract: TokenAirdrop");
    console.log("   • Address:", contractAddress);
    console.log("   • Network: Monad Testnet");
    console.log("   • Deployer:", deployerAddress);
    console.log("   • Transaction:", deploymentTx?.hash);
    
    // Save deployment info to file
    const deploymentInfo = {
      contractName: "TokenAirdrop",
      contractAddress: contractAddress,
      deployerAddress: deployerAddress,
      network: "Monad Testnet",
      chainId: network.chainId.toString(),
      transactionHash: deploymentTx?.hash,
      blockNumber: deploymentTx ? (await deploymentTx.wait())?.blockNumber : null,
      timestamp: new Date().toISOString(),
      gasUsed: deploymentTx ? (await deploymentTx.wait())?.gasUsed?.toString() : null
    };
    
    const fs = require('fs');
    fs.writeFileSync(
      'monad-airdrop-deployment.json', 
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log(" Deployment info saved to: monad-airdrop-deployment.json");
    
    return contractAddress;
    
  } catch (error) {
    console.error(" Deployment failed:");
    console.error("Error:", error.message);
    
    if (error.code === 'INSUFFICIENT_FUNDS') {
      console.log(" Tip: Make sure you have enough ETH in your wallet for gas fees");
    } else if (error.code === 'NETWORK_ERROR') {
      console.log(" Tip: Check your internet connection and RPC URL");
    } else if (error.message.includes('gas')) {
      console.log(" Tip: Try increasing gas limit or gas price");
    }
    
    throw error;
  }
}

// Execute deployment
if (require.main === module) {
  main()
    .then((contractAddress) => {
      console.log(`\n TokenAirdrop deployed at: ${contractAddress}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error(" Deployment script failed:", error);
      process.exit(1);
    });
}

module.exports = main; 