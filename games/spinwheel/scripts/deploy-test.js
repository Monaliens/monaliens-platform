const { ethers } = require("hardhat");

async function main() {
    console.log(" Deploying contracts for testing...");
    
    // Get signers
    const [owner, ...accounts] = await ethers.getSigners();
    console.log(`Owner: ${owner.address}`);
    console.log(`Available accounts: ${accounts.length}`);
    
    // Deploy MockNFT
    console.log("\n Deploying MockNFT...");
    const MockNFT = await ethers.getContractFactory("MockNFT");
    const mockNFT = await MockNFT.deploy();
    await mockNFT.deployed();
    console.log(`MockNFT deployed to: ${mockNFT.address}`);
    
    // Deploy SpinWheel
    console.log("\n Deploying SpinWheel...");
    const SpinWheel = await ethers.getContractFactory("SpinWheel");
    const spinWheel = await SpinWheel.deploy();
    await spinWheel.deployed();
    console.log(`SpinWheel deployed to: ${spinWheel.address}`);
    
    // Fund SpinWheel with ETH
    console.log("\n Funding SpinWheel contract...");
    const fundTx = await owner.sendTransaction({
        to: spinWheel.address,
        value: ethers.utils.parseEther("1000") // 1000 ETH for testing
    });
    await fundTx.wait();
    console.log(" SpinWheel funded with 1000 ETH");
    
    // Setup NFT contract in SpinWheel
    console.log("\n Setting up NFT integration...");
    const setNFTTx = await spinWheel.setNFTContract(mockNFT.address, true);
    await setNFTTx.wait();
    
    const enableTx = await spinWheel.setNFTIntegrationEnabled(true);
    await enableTx.wait();
    console.log(" NFT integration enabled");
    
    // Mint NFTs to test accounts
    console.log("\n Minting NFTs to test accounts...");
    
    // Mint 1 NFT to first 10 accounts
    for (let i = 0; i < 10 && i < accounts.length; i++) {
        await mockNFT.mint(accounts[i].address, 1);
        console.log(` Minted 1 NFT to ${accounts[i].address}`);
    }
    
    // Mint 50 NFTs to one specific account (for stress testing)
    if (accounts.length > 10) {
        await mockNFT.mint(accounts[10].address, 50);
        console.log(` Minted 50 NFTs to ${accounts[10].address}`);
    }
    
    // Mint 5 NFTs to a few more accounts
    for (let i = 11; i < 15 && i < accounts.length; i++) {
        await mockNFT.mint(accounts[i].address, 5);
        console.log(` Minted 5 NFTs to ${accounts[i].address}`);
    }
    
    console.log("\n Deployment Summary:");
    console.log(`MockNFT: ${mockNFT.address}`);
    console.log(`SpinWheel: ${spinWheel.address}`);
    console.log(`Total accounts with NFTs: ${Math.min(15, accounts.length)}`);
    console.log(`Account with 50 NFTs: ${accounts.length > 10 ? accounts[10].address : 'None'}`);
    
    // Check contract balance
    const balance = await ethers.provider.getBalance(spinWheel.address);
    console.log(`SpinWheel balance: ${ethers.utils.formatEther(balance)} ETH`);
    
    // Save deployment info
    const deploymentInfo = {
        mockNFT: mockNFT.address,
        spinWheel: spinWheel.address,
        owner: owner.address,
        testAccounts: accounts.slice(0, 15).map(acc => acc.address),
        stressTestAccount: accounts.length > 10 ? accounts[10].address : null
    };
    
    console.log("\n Ready for testing!");
    console.log("Use these addresses for testing:");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    return deploymentInfo;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });