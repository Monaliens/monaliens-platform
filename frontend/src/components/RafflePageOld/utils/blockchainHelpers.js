// BUNDLE SIZE FIX: Dynamic import to keep ethers.js out of main bundle
import { createWalletClient, custom, createPublicClient, http, parseUnits, formatEther } from 'viem';
import { RAFFLE_FACTORY_ABI, ERC20_ABI, ERC721_ABI } from './contractABIs';
import { CONTRACT_ADDRESSES, PRIZE_TYPES, ERROR_MESSAGES } from './constants';
import { monadTestnet } from '../../../config/reownConfig';

// Create public client for read operations
export const createPublicClientForMonad = () => {
  return createPublicClient({
    chain: monadTestnet,
    transport: http()
  });
};

// Get wallet client from active wallet (using SpinPage logic)
export const getWalletClientFromActiveWallet = async (activeWallet) => {
  if (!activeWallet) {
    throw new Error('No active wallet found');
  }

  try {
    // SpinPage'deki mantığı kullan
    let provider = null;
    
    // Direkt olarak activeWallet.provider'ı kullan
    if (activeWallet.provider) {
      provider = activeWallet.provider;
    } else {
      // Alternatif olarak embedded provider'ı dene
      try {
        if (activeWallet.getEthereumProvider) {
          provider = await activeWallet.getEthereumProvider();
        }
      } catch (error) {
        // Silent error
      }
    }
    
    // Provider yok ise, hata ver
    if (!provider) {
      throw new Error('No provider available in wallet');
    }
    
    // SpinPage'de test edilmiş createPrivyWalletClient kullan
    const walletClient = createPrivyWalletClient(provider);
    if (!walletClient) {
      throw new Error('Failed to create wallet client');
    }
    
    return walletClient;
  } catch (error) {
    console.error('Error creating wallet client:', error);
    throw new Error('Failed to create wallet client from Privy: ' + error.message);
  }
};

// Get signer from provider (Updated for Privy)
export const getSigner = async (walletClient = null) => {
  // Use Wagmi wallet client directly if provided
  if (walletClient) {
    console.log('Using provided wagmi wallet client');
    return walletClient;
  }

  // Fallback to window.ethereum if no wallet client provided
  if (!window.ethereum) {
    throw new Error('Please connect your wallet first');
  }

  // BUNDLE SIZE FIX: Dynamic import ethers.js with error handling
  try {
    const { ethers } = await import('ethers');
    const provider = new ethers.BrowserProvider(window.ethereum);
    return await provider.getSigner();
  } catch (error) {
    console.error('Failed to load ethers.js:', error);
    throw new Error('Failed to initialize wallet provider. Please refresh the page and try again.');
  }
};

// Test contract connectivity
export const testContractConnectivity = async (walletClient) => {
  try {
    const publicClient = createPublicClientForMonad();
    
    const totalRaffles = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.RAFFLE_FACTORY,
      abi: RAFFLE_FACTORY_ABI,
      functionName: 'totalRaffles'
    });
    
    console.log(`Contract OK - Total raffles: ${totalRaffles.toString()}`);
    return { success: true, totalRaffles: totalRaffles.toString() };
  } catch (error) {
    console.error('Contract connectivity test failed:', error);
    throw new Error('Cannot connect to contract. Please check network and contract address.');
  }
};

// Get creation fee from factory contract
export const getCreationFee = async (walletClient) => {
  try {
    const publicClient = createPublicClientForMonad();
    
    const fee = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.RAFFLE_FACTORY,
      abi: RAFFLE_FACTORY_ABI,
      functionName: 'raffleCreationFee'
    });
    
    return fee;
  } catch (error) {
    console.error('Error getting creation fee:', error);
    throw new Error('Failed to get creation fee from contract');
  }
};

// Check and approve ERC20 token
export const approveERC20Token = async (walletClient, tokenAddress, amount, spenderAddress, userAddress) => {
  try {
    const publicClient = createPublicClientForMonad();
    
    // Check current allowance
    const currentAllowance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [userAddress, spenderAddress]
    });
    
    console.log(`Current allowance: ${currentAllowance.toString()}`);
    
    if (currentAllowance < amount) {
      console.log('Approving tokens...');
      const txHash = await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spenderAddress, amount],
        account: userAddress
      });
      
      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log('Tokens approved successfully');
      return { success: true, txHash };
    }
    
    return { success: true, alreadyApproved: true };
  } catch (error) {
    console.error('Error approving ERC20 token:', error);
    throw new Error(`Token approval failed: ${error.message}`);
  }
};

// Check and approve ERC721 NFT
export const approveERC721NFT = async (walletClient, nftAddress, tokenId, spenderAddress, userAddress) => {
  try {
    const publicClient = createPublicClientForMonad();
    
    // First check if approved for all
    let isApprovedForAll = false;
    try {
      isApprovedForAll = await publicClient.readContract({
        address: nftAddress,
        abi: ERC721_ABI,
        functionName: 'isApprovedForAll',
        args: [userAddress, spenderAddress]
      });
      console.log(`Is approved for all: ${isApprovedForAll}`);
    } catch (error) {
      console.log('Error checking isApprovedForAll:', error);
    }
    
    // If already approved for all, no need to approve individual token
    if (isApprovedForAll) {
      console.log('Already approved for all tokens');
      return { success: true, alreadyApproved: true };
    }
    
    // Check individual token approval
    // Some contracts revert on getApproved for token ID 0 or non-existent tokens
    let approvedAddress = '0x0000000000000000000000000000000000000000';
    let needsApproval = true;
    
    try {
      approvedAddress = await publicClient.readContract({
        address: nftAddress,
        abi: ERC721_ABI,
        functionName: 'getApproved',
        args: [BigInt(tokenId)]
      });
      console.log(`NFT approved address: ${approvedAddress}`);
      needsApproval = approvedAddress.toLowerCase() !== spenderAddress.toLowerCase();
    } catch (error) {
      console.log('getApproved failed (likely token ID 0 or non-standard implementation), will proceed with approval');
      // If getApproved fails, we'll try to approve anyway
      needsApproval = true;
    }
    
    if (needsApproval) {
      console.log('Approving NFT...');
      
      try {
        // Try individual token approval first
        const txHash = await walletClient.writeContract({
          address: nftAddress,
          abi: ERC721_ABI,
          functionName: 'approve',
          args: [spenderAddress, BigInt(tokenId)],
          account: userAddress
        });
        
        // Wait for transaction receipt
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log('NFT approved successfully using approve()');
        return { success: true, txHash };
      } catch (approveError) {
        console.log('Individual approve failed, trying setApprovalForAll as fallback...');
        
        // If individual approval fails (common with token ID 0), try setApprovalForAll
        try {
          const txHash = await walletClient.writeContract({
            address: nftAddress,
            abi: ERC721_ABI,
            functionName: 'setApprovalForAll',
            args: [spenderAddress, true],
            account: userAddress
          });
          
          // Wait for transaction receipt
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          console.log('NFT approved successfully using setApprovalForAll()');
          return { success: true, txHash, usedApprovalForAll: true };
        } catch (setApprovalError) {
          console.error('Both approval methods failed');
          throw setApprovalError;
        }
      }
    }
    
    return { success: true, alreadyApproved: true };
  } catch (error) {
    console.error('Error approving ERC721 NFT:', error);
    throw new Error(`NFT approval failed: ${error.message}`);
  }
};

// Estimate gas for raffle creation
export const estimateGasForRaffleCreation = async (walletClient, params, totalValue, userAddress) => {
  try {
    const publicClient = createPublicClientForMonad();
    
    const gasEstimate = await publicClient.estimateContractGas({
      address: CONTRACT_ADDRESSES.RAFFLE_FACTORY,
      abi: RAFFLE_FACTORY_ABI,
      functionName: 'createRaffle',
      args: [
        params.prizeType,
        params.prizeContractAddress,
        params.prizeTokenId,
        params.prizeAmount,
        params.ticketPrice,
        params.ticketTokenAddress,
        params.maxTicketsPerWallet,
        params.maxTotalTickets,
        params.duration,
        params.participantsVisible,
        params.participantCountVisible
      ],
      value: totalValue,
      account: userAddress
    });
    
    console.log('Gas estimate successful:', gasEstimate.toString());
    return gasEstimate;
  } catch (error) {
    console.error('Gas estimation failed:', error);
    
    if (error?.reason) {
      throw new Error(`Contract validation failed: ${error.reason}`);
    } else if (error?.message?.includes('execution reverted')) {
      if (params.prizeContractAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error('Native tokens cannot be used as prizes. Please select an ERC20 token for the prize.');
      }
      throw new Error('Contract validation failed. Please check your token selections and amounts.');
    }
    throw error;
  }
};

// Create raffle transaction
export const createRaffleTransaction = async (walletClient, params, totalValue, userAddress) => {
  try {
    const publicClient = createPublicClientForMonad();
    
    console.log('Creating raffle with parameters:', params);
    console.log('Total value:', totalValue.toString());
    
    const txHash = await walletClient.writeContract({
      address: CONTRACT_ADDRESSES.RAFFLE_FACTORY,
      abi: RAFFLE_FACTORY_ABI,
      functionName: 'createRaffle',
      args: [
        params.prizeType,
        params.prizeContractAddress,
        params.prizeTokenId,
        params.prizeAmount,
        params.ticketPrice,
        params.ticketTokenAddress,
        params.maxTicketsPerWallet,
        params.maxTotalTickets,
        params.duration,
        params.participantsVisible,
        params.participantCountVisible
      ],
      value: totalValue,
      account: userAddress
    });
    
    console.log('Transaction sent:', txHash);
    
    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log('Transaction confirmed:', receipt.transactionHash);
    
    return { success: true, txHash: receipt.transactionHash, receipt };
  } catch (error) {
    console.error('Error creating raffle transaction:', error);
    throw error;
  }
};

// Prepare contract parameters from form data
export const prepareContractParameters = async (formData, selectedPrizeToken, selectedTicketToken) => {
  console.log('=== PREPARE CONTRACT PARAMETERS DEBUG ===');
  console.log('Input form data:', formData);
  console.log('Selected prize token/NFT:', selectedPrizeToken);
  console.log('🔍 Max tickets debug:', {
    maxTicketsPerWallet: formData.maxTicketsPerWallet,
    maxTotalTickets: formData.maxTotalTickets,
    typeOfMaxTicketsPerWallet: typeof formData.maxTicketsPerWallet,
    typeOfMaxTotalTickets: typeof formData.maxTotalTickets
  });
  
  // Prize type (0 = TOKEN, 1 = NFT)
  const prizeType = formData.prizeType === PRIZE_TYPES.TOKEN ? 0 : 1;
  
  // Token decimals
  const prizeTokenDecimals = selectedPrizeToken?.decimals || 18;
  const ticketTokenDecimals = selectedTicketToken?.decimals || 18;
  
  // Amounts - with null/undefined safety
  const prizeAmount = formData.prizeType === PRIZE_TYPES.TOKEN 
    ? parseUnits((formData.prizeAmount || '0').toString(), prizeTokenDecimals)
    : 0n;
    
  const ticketPrice = parseUnits((formData.ticketPrice || '0').toString(), ticketTokenDecimals);
  
  // Token ID - use the correct field name from blockchain form data
  const prizeTokenId = formData.prizeType === PRIZE_TYPES.NFT 
    ? BigInt(formData.prizeTokenId || '0') 
    : 0n;
  
  // Contract addresses (already prepared correctly in usePrivyRaffle)
  const prizeContractAddress = formData.prizeContractAddress;
  const ticketTokenAddress = formData.ticketTokenAddress;
  
  // Duration conversion (hours to seconds) - using final duration helper
  let durationInSeconds = 24 * 3600; // Default 24 hours
  try {
    const { getFinalDuration } = await import('../components/CreateRaffleModal/utils/formHelpers.js');
    const durationHours = getFinalDuration(formData) || 24;
    durationInSeconds = Math.floor(durationHours * 3600);
    
    console.log('🔍 Duration conversion debug:', {
      rawDuration: formData.duration,
      useCustomDuration: formData.useCustomDuration,
      customDuration: formData.customDuration,
      customDurationUnit: formData.customDurationUnit,
      finalDurationHours: durationHours,
      durationInSeconds: durationInSeconds
    });
  } catch (error) {
    console.error('Failed to load duration helper:', error);
    // Use fallback duration calculation
    durationInSeconds = (formData.duration || 24) * 3600;
  }
  
  const params = {
    prizeType,
    prizeContractAddress,
    prizeTokenId,
    prizeAmount,
    ticketPrice,
    ticketTokenAddress,
    maxTicketsPerWallet: BigInt((formData.maxTicketsPerWallet && formData.maxTicketsPerWallet.toString().trim() !== '') ? formData.maxTicketsPerWallet : '10'),
    maxTotalTickets: BigInt((formData.maxTotalTickets && formData.maxTotalTickets.toString().trim() !== '') ? formData.maxTotalTickets : '100'),
    duration: BigInt(durationInSeconds),
    participantsVisible: formData.participantsVisible !== false,
    participantCountVisible: formData.participantCountVisible !== false
  };
  
  console.log('Prepared contract parameters:', params);
  return params;
};

// Calculate total transaction value
export const calculateTransactionValue = async (walletClient, formData, selectedPrizeToken, creationFee) => {
  let totalValue = creationFee;
  
  // Check if prize is native token (ZERO_ADDRESS means native)
  const isNativePrize = formData.prizeType === PRIZE_TYPES.TOKEN && 
                       (formData.prizeContractAddress === CONTRACT_ADDRESSES.ZERO_ADDRESS || 
                        selectedPrizeToken?.isNative === true);
  
  if (isNativePrize) {
    const prizeTokenDecimals = selectedPrizeToken?.decimals || 18;
    const prizeAmount = parseUnits(formData.prizeAmount.toString(), prizeTokenDecimals);
    totalValue = totalValue + prizeAmount;
    console.log('Native token prize detected, adding to transaction value:', formatEther(prizeAmount));
  }
  
  return totalValue;
};

// Comprehensive error handling
export const handleBlockchainError = (error) => {
  console.error('Blockchain error:', error);
  
  if (error instanceof Error) {
    if (error.message.includes('user rejected')) {
      return 'Transaction was rejected by user';
    } else if (error.message.includes('insufficient funds')) {
      return 'Insufficient funds for transaction';
    } else if (error.message.includes('Duration too short')) {
      return 'Duration is too short (minimum 1 minute)';
    } else if (error.message.includes('Duration too long')) {
      return 'Duration is too long (maximum 30 days)';
    } else if (error.message.includes('UNCONFIGURED_NAME')) {
      return 'Invalid contract address. Please select a valid token from the list.';
    } else if (error.message.includes('could not decode result data')) {
      return 'Contract interaction failed. Please check token selection and try again.';
    } else if (error.message.includes('BAD_DATA')) {
      return 'Invalid token data. Please select a different token.';
    } else {
      return error.message;
    }
  }
  
  return ERROR_MESSAGES.UNKNOWN_ERROR;
};

// Validate form data before blockchain interaction
export const validateFormForBlockchain = (formData, selectedPrizeToken, selectedTicketToken) => {
  const errors = {};
  
  console.log('=== BLOCKCHAIN VALIDATION DEBUG ===');
  console.log('Form data:', formData);
  console.log('Selected prize token/NFT:', selectedPrizeToken);
  console.log('Prize type:', formData.prizeType);
  
  // Duration validation (minimum 1 minute)
  const durationHours = parseFloat(formData.duration);
  if (durationHours < (1/60)) {
    errors.duration = 'Duration must be at least 1 minute (contract requirement)';
  }
  
  // Prize type specific validation
  if (formData.prizeType === PRIZE_TYPES.TOKEN) {
    // For TOKEN raffle, we use Native MON, so selectedPrizeToken can be null
    // Just validate prize amount
    const prizeAmount = parseFloat(formData.prizeAmount);
    if (prizeAmount <= 0) {
      errors.prizeAmount = 'Prize amount must be greater than 0';
    }
    
    // Balance validation for native token prizes (if selectedPrizeToken provided)
    if (selectedPrizeToken && selectedPrizeToken.balanceFormatted) {
      const availableBalance = parseFloat(selectedPrizeToken.balanceFormatted.replace(/,/g, ''));
      if (prizeAmount > availableBalance) {
        errors.prizeAmount = `Insufficient balance. You have ${selectedPrizeToken.balanceFormatted} ${selectedPrizeToken.symbol}`;
      }
    }
  } else if (formData.prizeType === PRIZE_TYPES.NFT) {
    // NFT specific validation
    if (!selectedPrizeToken) {
      errors.selectedPrizeToken = 'Please select an NFT';
    } else {
      if (!formData.prizeContractAddress) {
        errors.prizeContractAddress = 'NFT contract address is missing';
      }
      if (!formData.prizeTokenId) {
        errors.prizeTokenId = 'NFT token ID is missing';
      }
      
      console.log('NFT validation - Contract:', formData.prizeContractAddress);
      console.log('NFT validation - Token ID:', formData.prizeTokenId);
    }
  }
  
  // Ticket token validation
  if (!selectedTicketToken) {
    errors.selectedTicketToken = 'Please select a payment token for tickets';
  }
  
  // Ticket price validation
  const ticketPrice = parseFloat(formData.ticketPrice);
  if (ticketPrice <= 0) {
    errors.ticketPrice = 'Ticket price must be greater than 0';
  }
  
  console.log('Blockchain validation errors:', errors);
  
  return { isValid: Object.keys(errors).length === 0, errors };
};

/**
 * Fetch NFT metadata from blockchain
 * @param {string} contractAddress - NFT contract address
 * @param {string} tokenId - NFT token ID
 * @param {Object} activeWallet - Active Privy wallet (optional)
 * @returns {Promise<Object|null>} NFT metadata with image URL
 */
export const fetchNFTMetadata = async (contractAddress, tokenId, activeWallet = null) => {
  try {
    
    // Use public client for read operations (no wallet needed)
    const publicClient = createPublicClientForMonad();

    // Get tokenURI from contract
    let tokenURI;
    try {
      tokenURI = await publicClient.readContract({
        address: contractAddress,
        abi: ERC721_ABI,
        functionName: 'tokenURI',
        args: [BigInt(tokenId)]
      });
      //console.log('TokenURI:', tokenURI);
    } catch (error) {
      console.error('Error getting tokenURI:', error);
      return null;
    }

    if (!tokenURI) {
      console.error('No tokenURI found');
      return null;
    }

    // Handle IPFS URIs
    let metadataURL = tokenURI;
    if (tokenURI.startsWith('ipfs://')) {
      metadataURL = `https://ipfs.io/ipfs/${tokenURI.replace('ipfs://', '')}`;
    }

    // Fetch metadata from URL
    try {
      const response = await fetch(metadataURL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const metadata = await response.json();

      // Process image URL
      let imageURL = metadata.image;
      if (imageURL && imageURL.startsWith('ipfs://')) {
        imageURL = `https://ipfs.io/ipfs/${imageURL.replace('ipfs://', '')}`;
      }

      return {
        ...metadata,
        image: imageURL,
        originalTokenURI: tokenURI
      };
    } catch (error) {
      console.error('Error fetching metadata from URL:', error);
      return null;
    }
  } catch (error) {
    console.error('Error fetching NFT metadata:', error);
    return null;
  }
}; 