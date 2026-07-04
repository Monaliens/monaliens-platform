const { ethers } = require("ethers");
const axios = require("axios");

// Monaliens staking contract
const STAKING_CONTRACT = process.env.STAKING_CONTRACT_ADDRESS || process.env.STAKING_CONTRACT || "0x9a630ee2Cd6Bd946B5176beEE4d54C614Bf4d8d7";
const NFT_COLLECTION = process.env.NFT_CONTRACT_ADDRESS || "0x7Cc9ebAaBD29Cd36C1b2c0765307Df6374016e78";
const MULTICALL3_ADDRESS = process.env.MULTICALL3_ADDRESS || "0xcA11bde05977b3631167028862bE2a173976CA11";

// Staking contract ABI (getStakersSnapshot function)
const STAKING_ABI = [
  {
    inputs: [],
    name: "getStakersSnapshot",
    outputs: [
      { internalType: "address[]", name: "stakers", type: "address[]" },
      { internalType: "uint256[][]", name: "tokenIds", type: "uint256[][]" },
      { internalType: "uint256[][]", name: "stakeDurations", type: "uint256[][]" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "getStakedNFTs",
    outputs: [
      { internalType: "uint256[]", name: "tokenIds", type: "uint256[]" },
      { internalType: "uint256[]", name: "stakeDurations", type: "uint256[]" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "totalStaked",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "allStakedTokens",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "tokenIdToStaker",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "tokenIdToStakeTimestamp",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
];

const MULTICALL3_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "target", type: "address" },
          { internalType: "bool", name: "allowFailure", type: "bool" },
          { internalType: "bytes", name: "callData", type: "bytes" }
        ],
        internalType: "struct Multicall3.Call3[]",
        name: "calls",
        type: "tuple[]"
      }
    ],
    name: "aggregate3",
    outputs: [
      {
        components: [
          { internalType: "bool", name: "success", type: "bool" },
          { internalType: "bytes", name: "returnData", type: "bytes" }
        ],
        internalType: "struct Multicall3.Result[]",
        name: "returnData",
        type: "tuple[]"
      }
    ],
    stateMutability: "payable",
    type: "function"
  }
];

/**
 * Get RPC URL from environment
 */
function getRpcUrl() {
  const rpcUrl = process.env.RPC_URL || process.env.MONAD_TESTNET_URL;
  if (!rpcUrl) return rpcUrl;
  return rpcUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
}

function formatSnapshot(stakers, tokenIds, stakeDurations) {
  const stakersData = [];
  let totalStaked = 0;

  for (let i = 0; i < stakers.length; i++) {
    const tokens = tokenIds[i].map(id => id.toString());
    const durations = stakeDurations[i].map(d => {
      const days = Number(d) / (24 * 60 * 60);
      return parseFloat(days.toFixed(2));
    });

    totalStaked += tokens.length;

    stakersData.push({
      address: stakers[i].toLowerCase(),
      tokenCount: tokens.length,
      tokens: tokens,
      stakeDurations: durations
    });
  }

  return {
    success: true,
    stakers: stakersData,
    totalStakers: stakers.length,
    totalStaked: totalStaked,
    stakingContract: STAKING_CONTRACT.toLowerCase()
  };
}

async function aggregateMulticall(multicall, calls, batchSize = 100) {
  const results = [];

  for (let start = 0; start < calls.length; start += batchSize) {
    const batch = calls.slice(start, start + batchSize);
    const batchResults = await multicall.callStatic.aggregate3(batch);
    results.push(...batchResults);
  }

  return results;
}

async function getStakingSnapshotByTokenScan(contract, provider) {
  const totalStaked = await contract.totalStaked();
  const totalStakedNumber = totalStaked.toNumber();
  if (totalStakedNumber === 0) {
    return formatSnapshot([], [], []);
  }

  const multicallCode = await provider.getCode(MULTICALL3_ADDRESS);
  if (!multicallCode || multicallCode === '0x') {
    throw new Error(`Multicall3 not deployed at ${MULTICALL3_ADDRESS}`);
  }

  const batchSize = Number(process.env.STAKING_MULTICALL_BATCH_SIZE || 100);
  const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
  const tokenCalls = [];

  for (let i = 0; i < totalStakedNumber; i++) {
    tokenCalls.push({
      target: STAKING_CONTRACT,
      allowFailure: true,
      callData: contract.interface.encodeFunctionData('allStakedTokens', [i])
    });
  }

  const tokenResults = await aggregateMulticall(multicall, tokenCalls, batchSize);
  const tokenIdsFlat = [];

  for (const result of tokenResults) {
    if (result.success && result.returnData !== '0x') {
      const tokenId = contract.interface.decodeFunctionResult('allStakedTokens', result.returnData)[0];
      tokenIdsFlat.push(tokenId);
    }
  }

  const detailCalls = [];
  for (const tokenId of tokenIdsFlat) {
    detailCalls.push({
      target: STAKING_CONTRACT,
      allowFailure: true,
      callData: contract.interface.encodeFunctionData('tokenIdToStaker', [tokenId])
    });
    detailCalls.push({
      target: STAKING_CONTRACT,
      allowFailure: true,
      callData: contract.interface.encodeFunctionData('tokenIdToStakeTimestamp', [tokenId])
    });
  }

  const detailResults = await aggregateMulticall(multicall, detailCalls, batchSize * 2);
  const stakerMap = new Map();
  const nowSeconds = Math.floor(Date.now() / 1000);

  for (let i = 0; i < tokenIdsFlat.length; i++) {
    const stakerResult = detailResults[i * 2];
    const timestampResult = detailResults[i * 2 + 1];
    if (!stakerResult?.success || !timestampResult?.success) continue;

    const staker = contract.interface.decodeFunctionResult('tokenIdToStaker', stakerResult.returnData)[0];
    if (!staker || staker === ethers.constants.AddressZero) continue;

    const timestamp = contract.interface.decodeFunctionResult('tokenIdToStakeTimestamp', timestampResult.returnData)[0];
    const stakerKey = staker.toLowerCase();
    if (!stakerMap.has(stakerKey)) {
      stakerMap.set(stakerKey, { address: staker, tokens: [], durations: [] });
    }

    const entry = stakerMap.get(stakerKey);
    entry.tokens.push(tokenIdsFlat[i]);
    entry.durations.push(Math.max(0, nowSeconds - timestamp.toNumber()));
  }

  const entries = Array.from(stakerMap.values());
  return formatSnapshot(
    entries.map(entry => entry.address),
    entries.map(entry => entry.tokens),
    entries.map(entry => entry.durations)
  );
}

/**
 * Get staking snapshot from contract
 * @returns {Promise<Object>} Staking data with stakers, tokens, and durations
 */
async function getStakingSnapshot() {
  const rpcUrl = getRpcUrl();
  let lastError;
  const maxRetries = 3;

  try {
    console.log(`[Staking] Using configured RPC: ${rpcUrl.substring(0, 50)}...`);
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);


    // Override network detection to prevent chain ID mismatch errors
    provider.detectNetwork = async () => {
      return { chainId: 143, name: "mainnet" };
    };

    const contract = new ethers.Contract(STAKING_CONTRACT, STAKING_ABI, provider);

    console.log('[Staking] Fetching snapshot from contract...');

    // Retry logic for temporary RPC errors
    let result;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`[Staking] Retry attempt ${attempt}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }

        result = await contract.getStakersSnapshot();
        break; // Success
      } catch (error) {
        lastError = error;

        // Check if it's a temporary RPC error
        const isTemporaryError = error.message?.includes('Temporary internal error') ||
                                 error.code === 'SERVER_ERROR' ||
                                 (error.error?.code === 19);

        if (!isTemporaryError || attempt === maxRetries) {
          throw error; // Not retryable or last attempt
        }
      }
    }

    const snapshot = formatSnapshot(result[0], result[1], result[2]);
    console.log(`[Staking] Found ${snapshot.totalStakers} stakers with ${snapshot.totalStaked} staked NFTs`);

    return snapshot;
  } catch (error) {
    lastError = error;

    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      provider.detectNetwork = async () => {
        return { chainId: 143, name: "mainnet" };
      };

      const contract = new ethers.Contract(STAKING_CONTRACT, STAKING_ABI, provider);
      console.warn(`[Staking] Snapshot call failed, scanning tokens via multicall: ${error.message}`);
      const snapshot = await getStakingSnapshotByTokenScan(contract, provider);
      console.log(`[Staking] Found ${snapshot.totalStakers} stakers with ${snapshot.totalStaked} staked NFTs via multicall`);
      return snapshot;
    } catch (fallbackError) {
      console.error(`[Staking] RPC failed: ${fallbackError.message}`);
      lastError = fallbackError;

      // RPC call failed
      console.error('[Staking] RPC endpoint failed');
      return {
        success: false,
        error: lastError?.message || 'RPC endpoint failed',
        stakers: [],
        totalStakers: 0,
        totalStaked: 0
      };
    }
  }
}

async function getStakedCount(address) {
  const rpcUrl = getRpcUrl();

  try {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    provider.detectNetwork = async () => {
      return { chainId: 143, name: "mainnet" };
    };

    const contract = new ethers.Contract(STAKING_CONTRACT, STAKING_ABI, provider);
    const result = await contract.getStakedNFTs(address);
    return {
      success: true,
      count: result[0].length,
      tokens: result[0].map(id => id.toString()),
      stakingContract: STAKING_CONTRACT.toLowerCase()
    };
  } catch (error) {
    console.error(`[Staking] Failed to fetch staked NFTs for ${address}: ${error.message}`);
    return {
      success: false,
      count: 0,
      tokens: [],
      error: error.message
    };
  }
}

/**
 * Get Monaliens holders from GraphQL
 */
async function getMonaliensHolders() {
  try {
    const query = `
      query GetCollectionHolders {
        NFTHolder(
          where: {collection_id: {_eq: "${NFT_COLLECTION}"}},
          order_by: {balance: desc}
        ) {
          owner
          balance
          tokenIds
        }
      }
    `;

    const response = await axios.post(
      process.env.GRAPHQL_URL || 'https://your-graphql-endpoint/v1/graphql',
      { query },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET
        }
      }
    );

    const holders = response.data.data.NFTHolder || [];
    const totalTokens = holders.reduce((sum, h) => sum + parseInt(h.balance), 0);

    console.log(`[GraphQL] Found ${holders.length} holders with ${totalTokens} total tokens`);

    return {
      success: true,
      holders: holders.map(h => ({
        address: h.owner.toLowerCase(),
        tokenCount: parseInt(h.balance),
        tokens: h.tokenIds || []
      })),
      totalHolders: holders.length,
      totalTokens: totalTokens
    };
  } catch (error) {
    console.error('[GraphQL] Error fetching holders:', error.message);
    return {
      success: false,
      error: error.message,
      holders: [],
      totalHolders: 0,
      totalTokens: 0
    };
  }
}

/**
 * Merge GraphQL holders with staking data
 * Combines same addresses into single entry with wallet/staking breakdown
 */
async function getMergedSnapshot() {
  try {
    console.log('[Snapshot] Creating merged snapshot...');

    // Get both datasets
    const [stakingData, graphqlData] = await Promise.all([
      getStakingSnapshot(),
      getMonaliensHolders()
    ]);

    if (!stakingData.success || !graphqlData.success) {
      throw new Error('Failed to fetch staking or holder data');
    }

    const stakingContractLower = STAKING_CONTRACT.toLowerCase();

    // Remove staking contract from holders
    const walletsOnly = graphqlData.holders.filter(h => h.address !== stakingContractLower);

    // Create a map to merge wallet + staking data by address
    const holderMap = new Map();

    // Add wallet holders
    for (const holder of walletsOnly) {
      holderMap.set(holder.address, {
        address: holder.address,
        tokenCount: holder.tokenCount,
        tokens: [...holder.tokens],
        wallet: holder.tokenCount,
        staking: 0,
        walletTokens: [...holder.tokens],
        stakingTokens: []
      });
    }

    // Merge staking data
    for (const staker of stakingData.stakers) {
      if (holderMap.has(staker.address)) {
        // User has both wallet + staking
        const existing = holderMap.get(staker.address);
        existing.staking = staker.tokenCount;
        existing.stakingTokens = [...staker.tokens];
        existing.tokenCount = existing.wallet + existing.staking;
        existing.tokens = [...existing.walletTokens, ...existing.stakingTokens];
        if (staker.stakeDurations) {
          existing.stakeDurations = staker.stakeDurations;
        }
      } else {
        // User only has staking (no wallet tokens)
        holderMap.set(staker.address, {
          address: staker.address,
          tokenCount: staker.tokenCount,
          tokens: [...staker.tokens],
          wallet: 0,
          staking: staker.tokenCount,
          walletTokens: [],
          stakingTokens: [...staker.tokens],
          stakeDurations: staker.stakeDurations || []
        });
      }
    }

    // Convert map to array and sort by total token count
    const mergedHolders = Array.from(holderMap.values());
    mergedHolders.sort((a, b) => b.tokenCount - a.tokenCount);

    const result = {
      holders: mergedHolders,
      totalHolders: mergedHolders.length,
      totalTokens: graphqlData.totalTokens,
      stakingStats: {
        stakedTokens: stakingData.totalStaked,
        uniqueStakers: stakingData.totalStakers,
        stakingContract: stakingContractLower
      },
      timestamp: new Date().toISOString()
    };

    console.log(`[Snapshot] Merged: ${result.totalHolders} unique holders (${walletsOnly.length} with wallets, ${stakingData.totalStakers} with staking)`);

    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('[Snapshot] Error creating merged snapshot:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  getStakingSnapshot,
  getStakedCount,
  getMergedSnapshot,
  STAKING_CONTRACT,
  NFT_COLLECTION
};
