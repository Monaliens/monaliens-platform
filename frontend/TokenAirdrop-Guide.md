# TokenAirdrop Contract Usage Guide

## Contract Overview
The TokenAirdrop contract enables efficient distribution of both native tokens (ETH/MON) and ERC20 tokens to multiple recipients using two distribution methods:
- **Linear Distribution**: Proportional amounts based on weights (e.g., NFT holdings)
- **Equal Distribution**: Same amount to all recipients

## Contract ABI

```json
[
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "tokenAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "totalAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "name": "recipientCount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "name": "isLinearDistribution",
        "type": "bool"
      }
    ],
    "name": "AirdropCompleted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "name": "totalAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "name": "recipientCount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "name": "isLinearDistribution",
        "type": "bool"
      }
    ],
    "name": "NativeAirdropCompleted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "recipient",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "name": "reason",
        "type": "string"
      }
    ],
    "name": "TransferFailed",
    "type": "event"
  },
  {
    "inputs": [
      {
        "name": "recipients",
        "type": "address[]"
      },
      {
        "name": "weights",
        "type": "uint256[]"
      }
    ],
    "name": "linearNativeAirdrop",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "name": "recipients",
        "type": "address[]"
      }
    ],
    "name": "equalNativeAirdrop",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "name": "tokenAddress",
        "type": "address"
      },
      {
        "name": "recipients",
        "type": "address[]"
      },
      {
        "name": "weights",
        "type": "uint256[]"
      },
      {
        "name": "totalAmount",
        "type": "uint256"
      }
    ],
    "name": "linearAirdrop",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "name": "tokenAddress",
        "type": "address"
      },
      {
        "name": "recipients",
        "type": "address[]"
      },
      {
        "name": "totalAmount",
        "type": "uint256"
      }
    ],
    "name": "equalAirdrop",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "getTokenApprovalData",
    "outputs": [
      {
        "name": "",
        "type": "bytes"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "name": "recipients",
        "type": "address[]"
      },
      {
        "name": "weights",
        "type": "uint256[]"
      }
    ],
    "name": "estimateLinearNativeAirdropGas",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "name": "recipients",
        "type": "address[]"
      }
    ],
    "name": "estimateEqualNativeAirdropGas",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "name": "recipients",
        "type": "address[]"
      },
      {
        "name": "weights",
        "type": "uint256[]"
      }
    ],
    "name": "estimateLinearAirdropGas",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "name": "recipients",
        "type": "address[]"
      }
    ],
    "name": "estimateEqualAirdropGas",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "name": "tokenAddress",
        "type": "address"
      }
    ],
    "name": "recoverTokens",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "recoverNativeTokens",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getContractBalance",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  },
  {
    "stateMutability": "payable",
    "type": "fallback"
  }
]
```

## Usage Examples

### 1. Native Token Airdrop (ETH/MON)

#### Equal Distribution
Send 10 ETH/MON equally to 5 recipients:

```javascript
import { ethers } from 'ethers';

const contractAddress = '0x...'; // Deployed contract address
const abi = [...]; // Contract ABI above

// Connect to contract
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();
const airdropContract = new ethers.Contract(contractAddress, abi, signer);

// Recipients list
const recipients = [
  '0x1234567890123456789012345678901234567890',
  '0x2345678901234567890123456789012345678901',
  '0x3456789012345678901234567890123456789012',
  '0x4567890123456789012345678901234567890123',
  '0x5678901234567890123456789012345678901234'
];

// Total amount to distribute (10 ETH/MON)
const totalAmount = ethers.utils.parseEther('10');

// Execute equal distribution
const tx = await airdropContract.equalNativeAirdrop(recipients, {
  value: totalAmount
});

await tx.wait();
console.log('Airdrop completed! Each recipient received:', ethers.utils.formatEther(totalAmount.div(5)), 'ETH/MON');
```

#### Linear Distribution (Weighted)
Distribute 100 MON based on NFT holdings:

```javascript
// Recipients and their NFT counts (weights)
const recipients = [
  '0x1234567890123456789012345678901234567890', // Has 10 NFTs
  '0x2345678901234567890123456789012345678901', // Has 5 NFTs
  '0x3456789012345678901234567890123456789012', // Has 25 NFTs
  '0x4567890123456789012345678901234567890123', // Has 8 NFTs
  '0x5678901234567890123456789012345678901234'  // Has 2 NFTs
];

const weights = [10, 5, 25, 8, 2]; // Total: 50 NFTs

// Total amount to distribute (100 MON)
const totalAmount = ethers.utils.parseEther('100');

// Execute linear distribution
const tx = await airdropContract.linearNativeAirdrop(recipients, weights, {
  value: totalAmount
});

await tx.wait();

// Calculate distributions
// User 1: (100 * 10/50) = 20 MON
// User 2: (100 * 5/50) = 10 MON
// User 3: (100 * 25/50) = 50 MON
// User 4: (100 * 8/50) = 16 MON
// User 5: (100 * 2/50) = 4 MON
```

### 2. Custom Amount Distribution (Özel Miktar Dağıtımı)

Linear distribution kullanarak her adrese istediğiniz spesifik miktarı gönderebilirsiniz. Formül basit: **Weight'leri istediğiniz miktarlara göre ayarlayın**.

#### Formül ve Örnek

```javascript
// AMAÇ: Spesifik miktarlar göndermek
// Adres1'e: 15 MON
// Adres2'ye: 25 MON
// Adres3'e: 10 MON
// Toplam: 50 MON

// YÖNTEM 1: Direkt weight = miktar
const recipients = [
  '0xAdres1',
  '0xAdres2',
  '0xAdres3'
];

const weights = [15, 25, 10]; // İstediğiniz miktarlar
const totalAmount = ethers.utils.parseEther('50'); // Weight toplamı

await contract.linearNativeAirdrop(recipients, weights, {
  value: totalAmount
});

// SONUÇ:
// Adres1: (50 * 15/50) = 15 MON ✓
// Adres2: (50 * 25/50) = 25 MON ✓
// Adres3: (50 * 10/50) = 10 MON ✓
```

#### Farklı Total Amount İle Dağıtım

```javascript
// Eğer 50 MON yerine 100 MON dağıtmak isterseniz:
// Weight'leri orantılı olarak artırın

const desiredAmounts = [15, 25, 10]; // İstediğiniz dağılım
const desiredTotal = 50; // Bu miktarların toplamı
const actualTotal = 100; // Dağıtacağınız gerçek miktar

// Çarpan hesapla
const multiplier = actualTotal / desiredTotal; // 100/50 = 2

// Weight'leri ayarla
const weights = desiredAmounts.map(amount => amount * multiplier); // [30, 50, 20]

await contract.linearNativeAirdrop(recipients, weights, {
  value: ethers.utils.parseEther('100')
});

// SONUÇ:
// Adres1: (100 * 30/100) = 30 MON
// Adres2: (100 * 50/100) = 50 MON
// Adres3: (100 * 20/100) = 20 MON
```

#### Helper Function - Custom Distribution

```javascript
function prepareCustomDistribution(distributions, totalBudget = null) {
  // distributions: [{address: '0x...', amount: 15}, ...]
  
  const recipients = distributions.map(d => d.address);
  const amounts = distributions.map(d => d.amount);
  const sumOfAmounts = amounts.reduce((a, b) => a + b, 0);
  
  if (!totalBudget || totalBudget === sumOfAmounts) {
    // Direkt kullan
    return {
      recipients,
      weights: amounts,
      totalAmount: ethers.utils.parseEther(sumOfAmounts.toString())
    };
  } else {
    // Orantılı dağıt
    const multiplier = totalBudget / sumOfAmounts;
    return {
      recipients,
      weights: amounts.map(a => a * multiplier),
      totalAmount: ethers.utils.parseEther(totalBudget.toString())
    };
  }
}

// Kullanım
const distribution = prepareCustomDistribution([
  { address: '0xAdres1', amount: 15 },
  { address: '0xAdres2', amount: 25 },
  { address: '0xAdres3', amount: 10 }
], 100); // 100 MON bütçe ile

await contract.linearNativeAirdrop(
  distribution.recipients,
  distribution.weights,
  { value: distribution.totalAmount }
);
```

### 3. ERC20 Token Airdrop

#### Step 1: Approve Token Spending

```javascript
// Token contract
const tokenAddress = '0x...'; // ERC20 token address
const tokenAbi = [...]; // ERC20 ABI
const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, signer);

// Amount to distribute (1000 tokens with 18 decimals)
const totalAmount = ethers.utils.parseUnits('1000', 18);

// Approve airdrop contract to spend tokens
const approveTx = await tokenContract.approve(contractAddress, totalAmount);
await approveTx.wait();
console.log('Tokens approved for airdrop');
```

#### Step 2a: Equal ERC20 Distribution

```javascript
const recipients = [
  '0x1234567890123456789012345678901234567890',
  '0x2345678901234567890123456789012345678901',
  '0x3456789012345678901234567890123456789012',
  '0x4567890123456789012345678901234567890123'
];

// Execute equal token distribution
const tx = await airdropContract.equalAirdrop(
  tokenAddress,
  recipients,
  totalAmount
);

await tx.wait();
console.log('Each recipient received:', ethers.utils.formatUnits(totalAmount.div(4), 18), 'tokens');
```

#### Step 2b: Linear ERC20 Distribution

```javascript
const recipients = [
  '0x1234567890123456789012345678901234567890',
  '0x2345678901234567890123456789012345678901',
  '0x3456789012345678901234567890123456789012'
];

// Weights based on staking amounts
const weights = [
  ethers.utils.parseEther('500'),  // User staked 500 tokens
  ethers.utils.parseEther('300'),  // User staked 300 tokens
  ethers.utils.parseEther('200')   // User staked 200 tokens
]; // Total: 1000 tokens staked

// Total reward amount (100 tokens)
const rewardAmount = ethers.utils.parseUnits('100', 18);

// Execute linear token distribution
const tx = await airdropContract.linearAirdrop(
  tokenAddress,
  recipients,
  weights,
  rewardAmount
);

await tx.wait();
// User 1 gets: 50 tokens (50% of rewards)
// User 2 gets: 30 tokens (30% of rewards)
// User 3 gets: 20 tokens (20% of rewards)
```

### 4. Gas Estimation

#### Estimate Before Execution

```javascript
// For native token airdrops
const estimatedGas = await airdropContract.estimateLinearNativeAirdropGas(
  recipients,
  weights
);
console.log('Estimated gas:', estimatedGas.toString());

// For equal native distribution
const equalGasEstimate = await airdropContract.estimateEqualNativeAirdropGas(recipients);

// For ERC20 token airdrops
const tokenGasEstimate = await airdropContract.estimateLinearAirdropGas(
  recipients,
  weights
);

// Calculate actual ETH/MON cost
const gasPrice = await provider.getGasPrice();
const estimatedCost = gasPrice.mul(estimatedGas);
console.log('Estimated cost:', ethers.utils.formatEther(estimatedCost), 'ETH/MON');
```

#### Gas Optimization Tips

```javascript
// Batch size recommendations based on gas estimates
const MAX_GAS_LIMIT = 3000000; // Block gas limit
const GAS_PER_RECIPIENT = 6000; // For native transfers
const BASE_GAS = 56000; // Base + contract overhead

const maxRecipients = Math.floor((MAX_GAS_LIMIT - BASE_GAS) / GAS_PER_RECIPIENT);
console.log('Max recipients per transaction:', maxRecipients); // ~490 recipients

// Split large airdrops into batches
function batchRecipients(recipients, weights, batchSize = 100) {
  const batches = [];
  for (let i = 0; i < recipients.length; i += batchSize) {
    batches.push({
      recipients: recipients.slice(i, i + batchSize),
      weights: weights.slice(i, i + batchSize)
    });
  }
  return batches;
}
```

### 5. Recovery Functions

#### Recover Stuck Tokens

```javascript
// If tokens are stuck in the contract
const stuckTokenAddress = '0x...';
await airdropContract.recoverTokens(stuckTokenAddress);

// Recover stuck native tokens (ETH/MON)
await airdropContract.recoverNativeTokens();

// Check contract balance before recovery
const balance = await airdropContract.getContractBalance();
console.log('Contract balance:', ethers.utils.formatEther(balance));
```

### 6. Error Handling

```javascript
try {
  // Prepare airdrop
  const recipients = [...];
  const weights = [...];
  
  // Check for common issues
  if (recipients.length !== weights.length) {
    throw new Error('Recipients and weights arrays must have same length');
  }
  
  if (recipients.length === 0) {
    throw new Error('Recipient list cannot be empty');
  }
  
  // Check balance before airdrop
  const balance = await provider.getBalance(signer.getAddress());
  const totalAmount = ethers.utils.parseEther('10');
  
  if (balance.lt(totalAmount)) {
    throw new Error('Insufficient balance');
  }
  
  // Execute with gas estimation
  const estimatedGas = await airdropContract.estimateGas.linearNativeAirdrop(
    recipients,
    weights,
    { value: totalAmount }
  );
  
  const tx = await airdropContract.linearNativeAirdrop(
    recipients,
    weights,
    {
      value: totalAmount,
      gasLimit: estimatedGas.mul(110).div(100) // 10% buffer
    }
  );
  
  const receipt = await tx.wait();
  
  // Parse events for failed transfers
  const failedTransfers = receipt.events?.filter(
    event => event.event === 'TransferFailed'
  );
  
  if (failedTransfers?.length > 0) {
    console.warn('Some transfers failed:', failedTransfers);
  }
  
} catch (error) {
  console.error('Airdrop failed:', error);
}
```

### 7. Integration with Frontend

```javascript
// React component example
import { useState } from 'react';
import { ethers } from 'ethers';

function AirdropManager() {
  const [recipients, setRecipients] = useState('');
  const [distributionType, setDistributionType] = useState('equal');
  const [tokenType, setTokenType] = useState('native');
  const [amount, setAmount] = useState('');
  
  const executeAirdrop = async () => {
    // Parse recipients (one address per line)
    const recipientList = recipients
      .split('\n')
      .map(addr => addr.trim())
      .filter(addr => ethers.utils.isAddress(addr));
    
    if (recipientList.length === 0) {
      alert('No valid addresses found');
      return;
    }
    
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);
    
    try {
      let tx;
      const totalAmount = ethers.utils.parseEther(amount);
      
      if (tokenType === 'native') {
        if (distributionType === 'equal') {
          tx = await contract.equalNativeAirdrop(recipientList, {
            value: totalAmount
          });
        } else {
          // For demo, using equal weights
          const weights = recipientList.map(() => 1);
          tx = await contract.linearNativeAirdrop(recipientList, weights, {
            value: totalAmount
          });
        }
      } else {
        // ERC20 token logic here
        // First approve, then distribute
      }
      
      const receipt = await tx.wait();
      console.log('Airdrop successful!', receipt);
      
    } catch (error) {
      console.error('Airdrop failed:', error);
    }
  };
  
  return (
    <div>
      {/* UI Components */}
    </div>
  );
}
```

## Important Notes

1. **Reentrancy Protection**: Contract has built-in reentrancy guards
2. **Failed Transfers**: Contract emits `TransferFailed` events but continues with other transfers
3. **Remaining Funds**: Any leftover funds are automatically returned to sender
4. **Zero Addresses**: Contract skips zero addresses automatically
5. **Gas Limits**: Consider blockchain gas limits when sending to many recipients
6. **Token Approval**: Must approve contract before ERC20 transfers
7. **Precision Loss**: Be aware of potential rounding in linear distribution

## Deployment

The TokenAirdrop contract is deployed on Monad Testnet and ready to use.