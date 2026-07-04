import { RAFFLE_ABI, ZERO_ADDRESS, GAS_CONFIG } from '../constants/contracts';

// Monad Testnet RPC endpoint
const MONAD_RPC_URL = 'https://testnet-rpc.monad.xyz';

/**
 * Create a provider specifically for balance checking with correct RPC
 * @returns {Promise<Object>} - Ethers provider with correct RPC
 */
const getBalanceProvider = async () => {
  try {
    const { ethers } = await import('ethers');
    console.log('🌐 BALANCE PROVIDER: Creating provider with RPC =', MONAD_RPC_URL);
    return new ethers.JsonRpcProvider(MONAD_RPC_URL);
  } catch (error) {
    console.error('❌ BALANCE PROVIDER: Error creating provider:', error);
    throw error;
  }
};

/**
 * Fetch user's native MON balance using the proven approach
 * @param {string} userAddress - User's wallet address
 * @returns {Promise<Object>} - Balance information
 */
const fetchUserNativeBalance = async (userAddress) => {
  try {
    const { ethers } = await import('ethers');
    
    // Get provider with correct RPC
    const provider = new ethers.JsonRpcProvider(MONAD_RPC_URL);
    
    // Check native MON balance
    const nativeBalance = await provider.getBalance(userAddress);
    const formattedBalance = ethers.formatEther(nativeBalance);
    
    return {
      balance: nativeBalance,
      formattedBalance,
      symbol: 'MON'
    };
  } catch (error) {
    console.error('❌ Error fetching native balance:', error);
    throw error;
  }
};

/**
 * Check if token is native token (ETH/MON)
 * @param {string} tokenAddress - Token contract address
 * @returns {boolean} - Whether token is native
 */
export const isNativeToken = (tokenAddress) => {
  // SYSTEM CHANGED: Only native MON token is supported now
  return true;
};

/**
 * Get user's native token balance using the proven approach
 * @param {Object} _ - Unused provider parameter (for compatibility)
 * @param {string} userAddress - User's wallet address
 * @returns {Promise<BigInt>} - Balance in wei
 */
export const getNativeBalance = async (_, userAddress) => {
  try {
    const balanceInfo = await fetchUserNativeBalance(userAddress);
    return balanceInfo.balance;
  } catch (error) {
    console.error('❌ Failed to get native balance:', error);
    throw new Error(`Failed to get native token balance: ${error.message}`);
  }
};

/**
 * Estimate gas for buyTickets transaction - NATIVE MON ONLY
 * @param {Object} raffleContract - Raffle contract instance
 * @param {number} ticketCount - Number of tickets to buy
 * @param {BigInt} totalCost - Total cost in native MON
 * @returns {Promise<BigInt>} - Gas estimate
 */
export const estimateBuyTicketsGas = async (raffleContract, ticketCount, totalCost) => {
  try {
    // Try direct gas estimation first
    const estimatedGas = await raffleContract.buyTickets.estimateGas(ticketCount, {
      value: totalCost
    });
    return estimatedGas + GAS_CONFIG.gasBuffer;
  } catch (error) {
    // If estimation fails, use high gas limit
    console.log('⛽ Gas estimation failed, using high gas limit');
    return BigInt(3000000);
  }
};

/**
 * Execute buyTickets transaction - NATIVE MON ONLY
 * @param {Object} raffleContract - Raffle contract instance
 * @param {number} ticketCount - Number of tickets to buy
 * @param {BigInt} gasLimit - Gas limit for transaction
 * @param {BigInt} totalCost - Total cost in native MON
 * @returns {Promise<Object>} - Transaction object
 */
export const executeBuyTickets = async (raffleContract, ticketCount, gasLimit, totalCost) => {
  try {
    console.log('🚀 Executing ticket purchase transaction...');
    
    // Try transaction with optimized gas settings
    const transactionStrategies = [
      // Strategy 1: Standard transaction
      {
        name: 'Standard',
        params: {
          value: totalCost,
          gasLimit: gasLimit
        }
      },
      // Strategy 2: Higher gas limit with manual gas price
      {
        name: 'High Gas',
        params: {
          value: totalCost,
          gasLimit: gasLimit + BigInt(1000000), // Add 1M more gas
          gasPrice: BigInt('50000000000') // 50 gwei
        }
      },
      // Strategy 3: Maximum gas with higher gas price
      {
        name: 'Maximum',
        params: {
          value: totalCost,
          gasLimit: BigInt(5000000), // 5M gas
          gasPrice: BigInt('60000000000') // 60 gwei
        }
      }
    ];
    
    // Try each strategy
    for (let i = 0; i < transactionStrategies.length; i++) {
      const strategy = transactionStrategies[i];
      
      try {
        const tx = await raffleContract.buyTickets(ticketCount, strategy.params);
        
        console.log(`✅ Transaction successful with ${strategy.name} strategy`);
        console.log('✅ Transaction hash:', tx.hash);
        
        return tx;
        
      } catch (strategyError) {
        console.log(`❌ ${strategy.name} strategy failed:`, strategyError.message);
        
        if (i === transactionStrategies.length - 1) {
          // Last strategy failed, throw the error
          throw strategyError;
        }
        
        // Continue to next strategy
        console.log(`🔄 Trying next strategy...`);
      }
    }
    
  } catch (error) {
    console.error('❌ All transaction strategies failed:', error.message);
    
    // Enhanced error message based on error type
    if (error.code === 'CALL_EXCEPTION') {
      throw new Error(`Contract transaction failed. This could be due to: insufficient balance, transaction already processed, or contract state changed. Please try again.`);
    } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
      throw new Error(`Unable to estimate gas for this transaction. Please check your balance and try again.`);
    } else if (error.reason) {
      throw new Error(`Transaction failed: ${error.reason}`);
    } else {
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }
};

/**
 * Get raffle contract instance with detailed logging
 * @param {Object} signer - Ethers signer
 * @param {string} raffleAddress - Raffle contract address
 * @returns {Object} - Raffle contract instance
 */
export const getRaffleContract = async (signer, raffleAddress) => {
  try {
    const { ethers } = await import('ethers');
    
    const contract = new ethers.Contract(raffleAddress, RAFFLE_ABI, signer);
    
    // Test the contract by checking if it has the buyTickets function
    if (typeof contract.buyTickets === 'function') {
      console.log('✅ Contract created successfully');
    } else {
      throw new Error('buyTickets function not found in contract');
    }
    
    return contract;
  } catch (error) {
    console.error('❌ Error creating raffle contract:', error);
    throw new Error(`Failed to create raffle contract instance: ${error.message}`);
  }
};

/**
 * Format token amount from wei to readable format
 * @param {string|BigInt} amount - Amount in wei
 * @param {number} decimals - Token decimals (18 for most tokens)
 * @returns {string} - Formatted amount
 */
export const formatTokenAmount = (amount, decimals = 18) => {
  try {
    // Use ethers for precision - sync import should work since it's already used elsewhere
    const { ethers } = require('ethers');
    
    // Convert to string first if BigInt
    const amountStr = amount.toString();
    
    // Debug log
    console.log('🔍 FORMAT DEBUG:', { input: amountStr, decimals });
    
    // Use ethers.formatUnits for precise conversion
    const ethAmount = parseFloat(ethers.formatUnits(amountStr, decimals));
    
    console.log('🔍 FORMAT DEBUG:', { formatted: ethAmount });
    
    // Format the amount nicely
    let result;
    if (ethAmount >= 1000000) {
      result = (ethAmount / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
    } else if (ethAmount >= 1000) {
      result = (ethAmount / 1000).toFixed(2).replace(/\.?0+$/, '') + 'K';
    } else if (ethAmount >= 1) {
      result = ethAmount.toFixed(2).replace(/\.?0+$/, '');
    } else if (ethAmount >= 0.0001) {
      result = ethAmount.toFixed(4).replace(/\.?0+$/, '');
    } else if (ethAmount > 0) {
      result = ethAmount.toFixed(6).replace(/\.?0+$/, '');
    } else {
      result = '0';
    }
    
    console.log('🔍 FORMAT DEBUG:', { result });
    return result;
  } catch (error) {
    console.error('Error formatting token amount:', error);
    return '0';
  }
};

/**
 * Format balance for display (legacy - kept for compatibility)
 * @param {BigInt} balance - Balance in wei/token units
 * @param {number} decimals - Token decimals (18 for most tokens)
 * @returns {string} - Formatted balance
 */
export const formatBalance = (balance, decimals = 18) => {
  return formatTokenAmount(balance, decimals);
};

/**
 * Parse ticket price to BigInt
 * @param {string|number} ticketPrice - Ticket price (could be in various formats)
 * @returns {BigInt} - Ticket price in wei
 */
export const parseTicketPrice = (ticketPrice) => {
  try {
    const { ethers } = require('ethers');
    
    console.log('🔍 PARSE TICKET PRICE DEBUG:', { input: ticketPrice, type: typeof ticketPrice });
    
    // If already a BigInt, return as is
    if (typeof ticketPrice === 'bigint') {
      console.log('🔍 PARSE DEBUG: Already BigInt, returning as is');
      return ticketPrice;
    }
    
    const priceStr = ticketPrice.toString();
    
    // Better wei detection: if string is long and contains only digits, it's likely wei
    const isOnlyDigits = /^\d+$/.test(priceStr);
    const isLongNumber = priceStr.length >= 15; // Wei amounts are typically 15+ digits
    const priceNum = parseFloat(priceStr);
    
    console.log('🔍 PARSE DEBUG:', { 
      priceStr, 
      priceNum, 
      isOnlyDigits, 
      isLongNumber, 
      isLarge: priceNum >= 1e18,
      willTreatAsWei: (isOnlyDigits && isLongNumber) || priceNum >= 1e18
    });
    
    // If it's a long string of digits OR clearly >= 1e18, treat as wei
    if ((isOnlyDigits && isLongNumber) || priceNum >= 1e18) {
      const result = BigInt(priceStr.split('.')[0]); // Remove decimals if any
      console.log('🔍 PARSE DEBUG: Already in wei format, result:', result.toString());
      return result;
    }
    
    // Otherwise, assume it's in ether and convert to wei
    const result = ethers.parseEther(priceStr);
    console.log('🔍 PARSE DEBUG: Small number (ether), converted to wei:', result.toString());
    return result;
  } catch (error) {
    console.error('Error parsing ticket price:', error);
    return BigInt(0);
  }
};

/**
 * Validate sufficient balance with detailed logging
 * @param {BigInt} balance - User's balance
 * @param {BigInt} required - Required amount
 * @param {string} tokenSymbol - Token symbol for error message
 * @returns {Object} - Validation result
 */
export const validateSufficientBalance = (balance, required, tokenSymbol = 'MON') => {
  const formattedRequired = formatTokenAmount(required);
  const formattedBalance = formatTokenAmount(balance);
  
  if (balance < required) {
    const errorMessage = `Insufficient ${tokenSymbol} balance. Need ${formattedRequired} ${tokenSymbol}, have ${formattedBalance} ${tokenSymbol}`;
    console.error('❌ BALANCE VALIDATION:', errorMessage);
    
    return {
      isValid: false,
      error: errorMessage
    };
  }
  
  return { isValid: true, error: null };
};

/**
 * Check raffle state and information
 * @param {Object} contract - Raffle contract instance
 * @returns {Promise<Object>} - Raffle information
 */
export const checkRaffleState = async (contract) => {
  try {
    const raffleInfo = await contract.getRaffleInfo();
    
    const parsedInfo = {
      owner: raffleInfo.owner,
      prizeType: Number(raffleInfo.prizeType),
      ticketPrice: raffleInfo.ticketPrice.toString(),
      // NATIVE MON SYSTEM: Override ticketTokenAddress to ZERO_ADDRESS for native payments
      ticketTokenAddress: ZERO_ADDRESS,
      maxTicketsPerWallet: Number(raffleInfo.maxTicketsPerWallet),
      maxTotalTickets: Number(raffleInfo.maxTotalTickets),
      endTime: Number(raffleInfo.endTime),
      winner: raffleInfo.winner,
      status: Number(raffleInfo.status),
      totalTicketsSold: Number(raffleInfo.totalTicketsSold),
      platformFeePercentage: Number(raffleInfo.platformFeePercentage),
      prizeInEscrow: raffleInfo.prizeInEscrow,
      prizeAmount: raffleInfo.prizeAmount.toString()
    };
    
    // Check raffle status
    const statusMap = {
      0: 'ACTIVE',
      1: 'ENDED',
      2: 'DRAWN',
      3: 'CANCELLED'
    };
    
    const statusName = statusMap[parsedInfo.status] || 'UNKNOWN';
    
    // Check time
    const currentTime = Math.floor(Date.now() / 1000);
    const isExpired = currentTime > parsedInfo.endTime;
    
    // Check tickets
    const isSoldOut = parsedInfo.totalTicketsSold >= parsedInfo.maxTotalTickets;
    
    // Check ticket price
    const { ethers } = await import('ethers');
    const formattedPrice = ethers.formatEther(raffleInfo.ticketPrice);
    
    return {
      ...parsedInfo,
      statusName,
      isExpired,
      isSoldOut,
      formattedPrice,
      canPurchase: parsedInfo.status === 0 && !isExpired && !isSoldOut
    };
  } catch (error) {
    console.error('❌ Error checking raffle state:', error);
    throw error;
  }
};

/**
 * Check user's current ticket count for a raffle
 * @param {Object} contract - Raffle contract instance
 * @param {string} userAddress - User's wallet address
 * @returns {Promise<Object>} - User ticket information
 */
export const checkUserTickets = async (contract, userAddress) => {
  try {
    const ticketCount = await contract.tickets(userAddress);
    const ticketCountNumber = Number(ticketCount);
    
    return {
      ticketCount: ticketCountNumber,
      rawTicketCount: ticketCount.toString()
    };
  } catch (error) {
    console.error('❌ Error checking user tickets:', error);
    throw error;
  }
};