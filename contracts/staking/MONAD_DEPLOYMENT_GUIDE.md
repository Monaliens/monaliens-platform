# 🚀 Monad Testnet Deployment & Testing Guide

## Overview

This guide provides complete instructions for deploying and testing the NFT Staking contract on Monad testnet with a 10-minute cooldown period for rapid testing, then switching to 5-day cooldown for production.

---

## 🔧 Current Configuration

**Current Mode**: TEST MODE (10-minute cooldown)  
**Network**: Monad Testnet  
**Chain ID**: 10143  
**RPC URL**: https://monad-testnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY  
**Explorer**: https://testnet.monadexplorer.com/

---

## 📝 Pre-Deployment Checklist

- [x] Contract modified for 10-minute cooldown (600 seconds)
- [x] Hardhat config updated with Monad testnet settings
- [x] Test wallets generated and saved for reuse
- [x] Deployment scripts created
- [x] Test phase scripts created (1-4)
- [x] Report generator ready
- [x] Production deployment script prepared

---

## 🚀 Deployment Instructions

### Step 1: Verify Configuration
```bash
# Check current cooldown setting
node scripts/check-cooldown.js

# Should show: TEST MODE - 10 minutes
```

### Step 2: Deploy to Monad Testnet
```bash
# Deploy contracts and create test wallets
npx hardhat run scripts/deploy-monad.js --network monadTestnet

# This will:
# 1. Deploy MockNFT contract
# 2. Deploy NFTStaking contract (10-min cooldown)
# 3. Create 5 test wallets with predetermined keys
# 4. Distribute MON to test wallets (2,2,2,1,1 MON)
# 5. Save deployment info to monad-deployment.json
```

### Expected Output:
- MockNFT Address: `0x...`
- NFTStaking Address: `0x...`
- 5 Test Wallets with addresses and private keys
- Deployment info saved to `monad-deployment.json`

---

## 🧪 Testing Timeline (Complete Cycle: ~30 minutes)

### Phase 1: Initial Staking (Minutes 0-5)
```bash
npx hardhat run scripts/test-monad-phase1.js --network monadTestnet
```

**What happens**:
- Mints 3 NFTs to each test wallet (1-3)
- Wallet 1 stakes 2 NFTs
- Wallet 2 stakes 3 NFTs  
- Wallet 3 stakes 1 NFT
- Records timestamps for cooldown tracking
- Saves results to `monad-phase1-results.json`

### Phase 2: Rewards & Queries (Minutes 5-10)
```bash
# Wait 5 minutes after Phase 1
npx hardhat run scripts/test-monad-phase2.js --network monadTestnet
```

**What happens**:
- Tests reward distribution simulation
- Distributes 1 MON in rewards
- Verifies proportional distribution
- Tests pause/unpause functionality
- Tests all query functions
- Saves results to `monad-phase2-results.json`

### Phase 3: Unstaking After Cooldown (After 10 minutes)
```bash
# Wait until 10 minutes have passed since Phase 1
npx hardhat run scripts/test-monad-phase3.js --network monadTestnet
```

**What happens**:
- Checks exact cooldown timing (599 vs 601 seconds)
- Wallet 1 unstakes 1 NFT (should succeed)
- Wallet 2 stakes additional NFT, tries immediate unstake (should fail)
- Tests emergency withdraw function
- Saves results to `monad-phase3-results.json`

### Phase 4: Complete Cycle (After 20 minutes)
```bash
# Wait until 20 minutes total (for all NFTs to complete cooldown)
npx hardhat run scripts/test-monad-phase4.js --network monadTestnet
```

**What happens**:
- Unstakes all remaining NFTs
- Verifies final ownership
- Analyzes gas usage
- Confirms complete test cycle
- Saves results to `monad-phase4-results.json`

---

## 📊 Generate Test Report

After completing all phases:
```bash
node scripts/generate-monad-report.js
```

This creates:
- `MONAD_TEST_REPORT.md` - Comprehensive test report
- `scripts/deploy-production.js` - Production deployment script

---

## 🏭 Production Deployment

### Step 1: Change Cooldown to 5 Days
```solidity
// In contracts/NFTStaking.sol, line 16:
// Change from:
uint256 public constant COOLDOWN_PERIOD = 10 minutes; // 600 seconds for testing

// To:
uint256 public constant COOLDOWN_PERIOD = 5 days; // Production setting
```

### Step 2: Verify Change
```bash
# Compile and verify
npx hardhat compile
node scripts/check-cooldown.js

# Should show: PRODUCTION MODE - 5 days
```

### Step 3: Deploy to Production
```bash
# Update the NFT collection address in deploy-production.js
# Then deploy:
npx hardhat run scripts/deploy-production.js --network mainnet
```

---

## 💾 Preserved Test Wallets

The following test wallets are saved and reused across all test phases:

| Wallet | Address | Private Key | Initial Balance | Role |
|--------|---------|-------------|-----------------|------|
| 1 | `0x15F8Ce63ef5B9a2AA563dE39FaF8f6fCc4B99d4E` | `0x1234...cde1` | 2 MON | Heavy staker |
| 2 | `0xD31a84493A3EeB696915385Def51fe56a96EFc8b` | `0x1234...cde2` | 2 MON | Max staker |
| 3 | `0xa3c960fD3ff93bc9731a96f56D056dd899C87171` | `0x1234...cde3` | 2 MON | Light staker |
| 4 | `0x99b693Eb84BF1b2Ed5Fe884f039f99BE7981f03A` | `0x1234...cde4` | 1 MON | Query tester |
| 5 | `0x6e2C6343Dc17E5199d13E8AdBe98FCb4F3b63650` | `0x1234...cde5` | 1 MON | Edge tester |

**Important**: These are TEST wallets. Never use in production!

---

## ⛽ Expected Gas Costs

Based on test mode (actual production costs may vary):

| Operation | Gas Used | Cost @ 30 Gwei |
|-----------|----------|----------------|
| Deploy NFTStaking | ~3,500,000 | 0.105 ETH |
| Stake 1 NFT | ~233,000 | 0.007 ETH |
| Stake 2 NFTs | ~467,000 | 0.014 ETH |
| Unstake 1 NFT | ~93,000 | 0.003 ETH |
| Distribute Rewards | ~280,000 | 0.008 ETH |

---

## 🛠️ Troubleshooting

### Issue: "Cooldown not expired"
- **Cause**: Trying to unstake before 10 minutes (test) or 5 days (production)
- **Solution**: Wait for cooldown period to complete

### Issue: "Not the token owner"
- **Cause**: Trying to stake NFT you don't own
- **Solution**: Ensure wallet owns the NFT before staking

### Issue: "Contract paused"
- **Cause**: Contract is in paused state
- **Solution**: Owner needs to unpause the contract

### Issue: Gas estimation failed
- **Cause**: Transaction will revert
- **Solution**: Check requirements (ownership, cooldown, etc.)

---

## 📋 Key Commands Reference

```bash
# Check cooldown setting
node scripts/check-cooldown.js

# Deploy to Monad testnet
npx hardhat run scripts/deploy-monad.js --network monadTestnet

# Run test phases
npx hardhat run scripts/test-monad-phase1.js --network monadTestnet
npx hardhat run scripts/test-monad-phase2.js --network monadTestnet
npx hardhat run scripts/test-monad-phase3.js --network monadTestnet
npx hardhat run scripts/test-monad-phase4.js --network monadTestnet

# Generate report
node scripts/generate-monad-report.js

# Compile contracts
npx hardhat compile

# Run local tests
npx hardhat test
```

---

## ✅ Final Checklist for Production

Before deploying to mainnet:

- [ ] Change COOLDOWN_PERIOD to 5 days
- [ ] Get professional security audit
- [ ] Test on mainnet fork
- [ ] Verify gas optimization
- [ ] Set up monitoring
- [ ] Prepare emergency response plan
- [ ] Document admin procedures
- [ ] Create user guide
- [ ] Set up support channels
- [ ] Announce deployment schedule

---

## 📞 Support

For issues or questions:
- Review test reports in `MONAD_TEST_REPORT.md`
- Check deployment logs in JSON files
- Verify contract on explorer: https://testnet.monadexplorer.com/

---

*Last Updated: 2025-08-03*  
*Contract Version: 1.0.0*  
*Test Mode: 10 minutes | Production: 5 days*