const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// ABI for the airdrop contract (only the function we need)
const AIRDROP_ABI = [
    "function linearAirdrop(address tokenAddress, address[] calldata recipients, uint256[] calldata weights, uint256 totalAmount) external"
];

// ERC20 ABI for token operations
const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function allowance(address owner, address spender) external view returns (uint256)"
];

const STATE_FILE = path.join(__dirname, 'airdrop-state.json');
const AIRDROPS_DIR = path.join(__dirname, 'airdrops');

class AirdropManager {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.airdropContract = new ethers.Contract(
            process.env.AIRDROP_CONTRACT,
            AIRDROP_ABI,
            this.wallet
        );
        this.tokenContract = new ethers.Contract(
            process.env.LMON_TOKEN_ADDRESS,
            ERC20_ABI,
            this.wallet
        );
    }

    // Load state from file
    async loadState() {
        try {
            const data = await fs.readFile(STATE_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            // File doesn't exist, return empty state
            return {
                lastAirdrop: null,
                totalDistributed: 0,
                history: []
            };
        }
    }

    // Save state to file
    async saveState(state) {
        await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
    }

    // Save detailed airdrop data
    async saveAirdropDetails(airdropData) {
        // Create airdrops directory if it doesn't exist
        try {
            await fs.mkdir(AIRDROPS_DIR, { recursive: true });
        } catch (error) {
            // Directory might already exist
        }

        // Create folder name with date (DDMMYYYY format)
        const date = new Date();
        const folderName = `${String(date.getDate()).padStart(2, '0')}${String(date.getMonth() + 1).padStart(2, '0')}${date.getFullYear()}`;
        const airdropFolder = path.join(AIRDROPS_DIR, folderName);

        // Create the specific airdrop folder
        await fs.mkdir(airdropFolder, { recursive: true });

        // Save the detailed data
        const fileName = `airdrop_${date.getHours()}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}.json`;
        const filePath = path.join(airdropFolder, fileName);

        await fs.writeFile(filePath, JSON.stringify(airdropData, null, 2));
        console.log(`    Detailed log: ${filePath}`);

        return filePath;
    }

    // Check if airdrop was already done today
    async canRunAirdrop() {
        const state = await this.loadState();
        if (!state.lastAirdrop) return true;

        const lastAirdropDate = new Date(state.lastAirdrop);
        const today = new Date();

        // Check if it's a different day (in UTC)
        return lastAirdropDate.toDateString() !== today.toDateString();
    }

    // Check if enough time has passed for test mode (5 minutes)
    async canRunTestAirdrop() {
        const state = await this.loadState();
        if (!state.lastAirdrop) return true;

        const lastAirdropDate = new Date(state.lastAirdrop);
        const now = new Date();

        // Check if at least 5 minutes have passed
        const fiveMinutesInMs = 5 * 60 * 1000;
        return (now - lastAirdropDate) >= fiveMinutesInMs;
    }

    // Fetch staker data from API with retry
    async fetchStakers(retryCount = 10) {
        for (let attempt = 1; attempt <= retryCount; attempt++) {
            try {
                console.log(` Fetching staker data from API... (Deneme ${attempt}/${retryCount})`);

                // Add timeout to prevent hanging
                const response = await axios.get(process.env.API_ENDPOINT, {
                    timeout: 30000 // 30 seconds timeout
                });

                if (!response.data?.data?.stakers) {
                    throw new Error('API response is not in expected format');
                }

                const stakers = response.data.data.stakers;
                console.log(` ${stakers.length} staker bulundu`);

                return stakers;
            } catch (error) {
                console.error(` API error (Deneme ${attempt}/${retryCount}):`, error.message);

                if (attempt === retryCount) {
                    console.error(' All attempts failed!');
                    throw error;
                }

                // Wait before retry (exponential backoff)
                const waitTime = Math.min(attempt * 3000, 30000); // Max 30 seconds
                console.log(` ${waitTime/1000} saniye bekleniyor...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));

                // Try alternative API if first one fails
                if (attempt === 2 && process.env.API_ENDPOINT.includes('dev.api')) {
                    console.log(' Alternatif API deneniyor...');
                    process.env.API_ENDPOINT = process.env.API_ENDPOINT.replace('dev.api', 'api');
                }
            }
        }
    }

    // Calculate weights based on stake duration
    calculateWeights(stakers) {
        const addressWeights = new Map();

        stakers.forEach(staker => {
            // Calculate total stake duration for this staker
            // Weight = sum of all stake durations for all NFTs
            const totalStakeDuration = staker.stakeDurations.reduce((sum, duration) => sum + duration, 0);

            // Round to avoid decimal issues
            const weight = Math.floor(totalStakeDuration * 100); // Multiply by 100 for precision

            if (weight > 0) {
                addressWeights.set(staker.address.toLowerCase(), weight);
            }
        });

        // Convert to arrays for contract call
        const addresses = Array.from(addressWeights.keys());
        const weights = Array.from(addressWeights.values());

        const totalWeight = weights.reduce((sum, w) => sum + w, 0);

        console.log('\n Weight Calculation Summary:');
        console.log(`   Total addresses: ${addresses.length}`);
        console.log(`   Total weight: ${totalWeight}`);
        console.log(`   Average weight: ${(totalWeight / addresses.length).toFixed(2)}`);

        // Show top 5 stakers
        const sorted = addresses.map((addr, i) => ({ addr, weight: weights[i] }))
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 5);

        console.log('\n    Top 5 Staker:');
        sorted.forEach((s, i) => {
            const percentage = ((s.weight / totalWeight) * 100).toFixed(2);
            console.log(`   ${i + 1}. ${s.addr.slice(0, 6)}...${s.addr.slice(-4)}: ${s.weight} (${percentage}%)`);
        });

        return { addresses, weights, totalWeight };
    }

    // Check token balance and allowance
    async checkTokenStatus(amount) {
        const decimals = await this.tokenContract.decimals();
        const amountWei = ethers.parseUnits(amount.toString(), decimals);

        const balance = await this.tokenContract.balanceOf(this.wallet.address);
        const allowance = await this.tokenContract.allowance(this.wallet.address, process.env.AIRDROP_CONTRACT);

        console.log('\n Token Durumu:');
        console.log(`   Wallet balance: ${ethers.formatUnits(balance, decimals)} LMON`);
        console.log(`   Airdrop contract allowance: ${ethers.formatUnits(allowance, decimals)} LMON`);
        console.log(`   Amount to distribute: ${amount} LMON`);

        if (balance < amountWei) {
            throw new Error(`Yetersiz bakiye! Gerekli: ${amount} LMON, Mevcut: ${ethers.formatUnits(balance, decimals)} LMON`);
        }

        return { amountWei, decimals, balance, allowance };
    }

    // Approve token spending if needed
    async approveIfNeeded(amountWei, currentAllowance) {
        if (currentAllowance < amountWei) {
            console.log('\n Token izni veriliyor...');
            const approveTx = await this.tokenContract.approve(
                process.env.AIRDROP_CONTRACT,
                amountWei
            );
            console.log(`   Approve TX: ${approveTx.hash}`);
            const receipt = await approveTx.wait();
            console.log(`    Approve confirmed! Block: ${receipt.blockNumber}`);
            return receipt;
        }
        console.log('    Token allowance already granted');
        return null;
    }

    // Execute the airdrop
    async executeAirdrop(addresses, weights, amount) {
        const { amountWei, decimals, balance, allowance } = await this.checkTokenStatus(amount);

        // Approve if needed
        await this.approveIfNeeded(amountWei, allowance);

        // Execute airdrop
        console.log('\n Starting airdrop...');
        console.log(`   Recipient count: ${addresses.length}`);
        console.log(`   Toplam miktar: ${amount} LMON`);

        try {
            const tx = await this.airdropContract.linearAirdrop(
                process.env.LMON_TOKEN_ADDRESS,
                addresses,
                weights,
                amountWei
            );

            console.log(`    TX sent: ${tx.hash}`);
            console.log('    Onay bekleniyor...');

            const receipt = await tx.wait();

            console.log(`    Airdrop completed!`);
            console.log(`   Block: ${receipt.blockNumber}`);
            console.log(`   Gas used: ${receipt.gasUsed.toString()}`);

            return receipt;
        } catch (error) {
            console.error(' Airdrop error:', error.message);
            throw error;
        }
    }

    // Main run function
    async run(isTest = false) {
        console.log('\n=======================================');
        console.log(' LMON AIRDROP STARTING');
        console.log(` Tarih: ${new Date().toLocaleString('tr-TR')}`);
        console.log(` Mod: ${isTest ? 'TEST' : 'PRODUCTION'}`);
        console.log('=======================================\n');

        // Check if we can run based on mode
        if (!isTest) {
            // Production mode: check daily limit
            const canRun = await this.canRunAirdrop();
            if (!canRun) {
                console.log('  Airdrop already done today! Try again tomorrow.');
                const state = await this.loadState();
                console.log(`   Son airdrop: ${new Date(state.lastAirdrop).toLocaleString('tr-TR')}`);
                return;
            }
        } else {
            // Test mode: check 5-minute limit
            const canRun = await this.canRunTestAirdrop();
            if (!canRun) {
                const state = await this.loadState();
                const lastTime = new Date(state.lastAirdrop);
                const nextTime = new Date(lastTime.getTime() + 5 * 60 * 1000);
                const remainingMinutes = Math.ceil((nextTime - new Date()) / 60000);

                console.log('  5 minutes have not passed yet!');
                console.log(`   Son airdrop: ${lastTime.toLocaleString('tr-TR')}`);
                console.log(`   Sonraki airdrop: ${nextTime.toLocaleString('tr-TR')}`);
                console.log(`   Remaining: ${remainingMinutes} dakika`);
                return false;
            }
        }

        try {
            // Fetch stakers
            const stakers = await this.fetchStakers();

            // Calculate weights
            const { addresses, weights, totalWeight } = this.calculateWeights(stakers);

            if (addresses.length === 0) {
                console.log('  No stakers found!');
                return;
            }

            // Determine amount
            const amount = isTest ? process.env.TEST_AMOUNT : process.env.DAILY_AMOUNT;

            // Execute airdrop
            const receipt = await this.executeAirdrop(addresses, weights, amount);

            // Calculate individual distributions
            const distributions = addresses.map((addr, index) => {
                const weight = weights[index];
                const tokenAmount = (parseInt(amount) * weight) / totalWeight;
                return {
                    address: addr,
                    weight: weight,
                    percentage: ((weight / totalWeight) * 100).toFixed(4),
                    tokenAmount: tokenAmount.toFixed(6)
                };
            });

            // Sort by token amount for better readability
            distributions.sort((a, b) => parseFloat(b.tokenAmount) - parseFloat(a.tokenAmount));

            // Create detailed airdrop data
            const detailedData = {
                timestamp: new Date().toISOString(),
                date: new Date().toLocaleString('tr-TR'),
                network: "Monad Testnet",
                contract: {
                    airdrop: process.env.AIRDROP_CONTRACT,
                    token: process.env.LMON_TOKEN_ADDRESS
                },
                transaction: {
                    hash: receipt.transactionHash,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed.toString(),
                    from: this.wallet.address
                },
                distribution: {
                    totalAmount: parseInt(amount),
                    totalRecipients: addresses.length,
                    totalWeight: totalWeight,
                    recipients: distributions
                },
                summary: {
                    top5Recipients: distributions.slice(0, 5),
                    smallest5Recipients: distributions.slice(-5),
                    averageAmount: (parseInt(amount) / addresses.length).toFixed(6)
                }
            };

            // Save detailed airdrop data
            await this.saveAirdropDetails(detailedData);

            // Update state
            const state = await this.loadState();
            const airdropRecord = {
                date: new Date().toISOString(),
                amount: parseInt(amount),
                recipients: addresses.length,
                txHash: receipt.transactionHash,
                blockNumber: receipt.blockNumber,
                totalWeight: totalWeight
            };

            state.lastAirdrop = airdropRecord.date;
            state.totalDistributed += parseInt(amount);
            state.history.push(airdropRecord);

            await this.saveState(state);

            console.log('\n Summary Statistics:');
            console.log(`   Total distributed: ${state.totalDistributed} LMON`);
            console.log(`   Total airdrops: ${state.history.length}`);

            return true;

        } catch (error) {
            console.error('\n HATA:', error.message);
            throw error;
        }
    }
}

// Export for use in other files
module.exports = AirdropManager;

// Run if called directly
if (require.main === module) {
    const manager = new AirdropManager();
    const isTest = process.argv.includes('--test');

    manager.run(isTest)
        .then(() => {
            console.log('\n Operation completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n Kritik hata:', error);
            process.exit(1);
        });
}