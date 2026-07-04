import { useState, useCallback } from 'react';
import { usePrivyOptimized } from '../../../context';
import { useWalletClient } from 'wagmi';
import {
  isNativeToken,
  getNativeBalance,
  estimateBuyTicketsGas,
  executeBuyTickets,
  getRaffleContract,
  parseTicketPrice,
  validateSufficientBalance,
  checkRaffleState,
  checkUserTickets,
  formatTokenAmount
} from '../utils/contractHelpers';
import { 
  parseBlockchainError, 
  createBlockchainErrorHandler 
} from '../utils/blockchainErrors';

/**
 * Hook for purchasing raffle tickets with native MON only
 * Simplified for RafflePage UI components
 */
export const useRafflePurchase = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [progress, setProgress] = useState(null);
  
  const { user, authenticated, walletAddress, isConnected } = usePrivyOptimized();
  const { data: walletClient } = useWalletClient();

  // Get wallet provider and signer (Wagmi/Reown integration)
  const getProviderAndSigner = useCallback(async () => {
    console.log('🔗 GET PROVIDER: Starting provider setup...');
    console.log('🔗 GET PROVIDER: Authenticated =', authenticated);
    console.log('🔗 GET PROVIDER: Connected =', isConnected);
    console.log('🔗 GET PROVIDER: Wallet client =', !!walletClient);
    console.log('🔗 GET PROVIDER: Wallet address =', walletAddress);

    if (!isConnected || !walletAddress) {
      throw new Error('Wallet not connected');
    }

    if (!walletClient) {
      throw new Error('Wallet client not available');
    }

    try {
      console.log('🔗 GET PROVIDER: Using Wagmi wallet client...');
      const { ethers } = await import('ethers');

      // Get provider from wagmi wallet client
      const web3Provider = new ethers.BrowserProvider(walletClient.transport);
      const web3Signer = await web3Provider.getSigner();

      console.log('✅ GET PROVIDER: Provider created successfully');
      console.log('✅ GET PROVIDER: Signer address =', await web3Signer.getAddress());

      return {
        provider: web3Provider,
        signer: web3Signer,
        userAddress: walletAddress
      };
    } catch (error) {
      console.error('❌ GET PROVIDER: Error getting provider and signer:', error);
      throw error;
    }
  }, [authenticated, isConnected, walletAddress, walletClient]);

  // Create error handler
  const handleError = createBlockchainErrorHandler((message) => {
    console.error('Ticket purchase error:', message);
    setError(message);
  });

  /**
   * Buy tickets for a raffle
   * @param {Object} params - Purchase parameters
   * @param {string} params.contractAddress - Raffle contract address
   * @param {number} params.ticketCount - Number of tickets to buy
   * @param {string|number} params.ticketPriceRaw - Raw ticket price from API
   * @param {Function} params.onProgress - Progress callback function
   * @param {Function} params.onSuccess - Success callback function
   * @returns {Promise<Object>} - Purchase result
   */
  const buyTickets = useCallback(async ({
    contractAddress,
    ticketCount,
    ticketPriceRaw,
    onProgress = () => {},
    onSuccess = () => {}
  }) => {
    // Validation
    console.log('🔍 PURCHASE VALIDATION:', {
      authenticated,
      hasWallet: !!user?.wallet,
      contractAddress,
      ticketCount,
      ticketPriceRaw
    });

    if (!authenticated || !user?.wallet) {
      const error = 'Please connect your wallet first';
      console.error('❌ WALLET:', error);
      handleError(new Error(error));
      return { success: false, error };
    }

    if (!contractAddress || !ticketCount || !ticketPriceRaw) {
      const error = 'Invalid purchase parameters';
      console.error('❌ PARAMS:', { contractAddress, ticketCount, ticketPriceRaw });
      handleError(new Error(error));
      return { success: false, error };
    }

    console.log('✅ PURCHASE VALIDATION: All checks passed');

    setLoading(true);
    setError(null);
    setTxHash(null);
    setProgress(null);

    try {
      // Step 1: Get provider and signer
      onProgress({ step: 'wallet', message: 'Connecting to wallet...' });
      const { provider, signer, userAddress } = await getProviderAndSigner();

      // Step 2: Parse ticket price and calculate cost
      const ticketPriceWei = parseTicketPrice(ticketPriceRaw);
      const totalCost = ticketPriceWei * BigInt(ticketCount);

      // Step 3: Get raffle contract instance
      const raffleContract = await getRaffleContract(signer, contractAddress);

      // Step 4: Check raffle state
      console.log('🔄 TICKET PURCHASE: Checking raffle state...');
      onProgress({ step: 'validation', message: 'Checking raffle state...' });
      
      const raffleState = await checkRaffleState(raffleContract);
      
      console.log('💰 Purchasing', ticketCount, 'tickets for', formatTokenAmount(totalCost.toString()), 'MON');
      
      if (!raffleState.canPurchase) {
        let errorMessage = 'Cannot purchase tickets: ';
        
        if (raffleState.status !== 0) {
          errorMessage += `Raffle is ${raffleState.statusName}`;
        } else if (raffleState.isExpired) {
          errorMessage += 'Raffle has ended';
        } else if (raffleState.isSoldOut) {
          errorMessage += 'Raffle is sold out';
        } else {
          errorMessage += 'Unknown issue';
        }
        
        console.error('❌ RAFFLE STATE:', errorMessage);
        throw new Error(errorMessage);
      }
      
      console.log('✅ RAFFLE STATE: Can purchase tickets');

      // Step 5: Check user's current ticket count
      console.log('🔄 TICKET PURCHASE: Checking user ticket count...');
      onProgress({ step: 'validation', message: 'Checking ticket limits...' });
      
      const userTickets = await checkUserTickets(raffleContract, userAddress);
      console.log('🔄 TICKET PURCHASE: User ticket check completed');
      
      // Check if user can purchase more tickets
      const remainingTickets = raffleState.maxTicketsPerWallet - userTickets.ticketCount;
      console.log('🔄 TICKET PURCHASE: Max tickets per wallet =', raffleState.maxTicketsPerWallet);
      console.log('🔄 TICKET PURCHASE: User current tickets =', userTickets.ticketCount);
      console.log('🔄 TICKET PURCHASE: Remaining tickets =', remainingTickets);
      
      if (userTickets.ticketCount >= raffleState.maxTicketsPerWallet) {
        const errorMessage = `Maximum tickets per wallet reached. You have ${userTickets.ticketCount}/${raffleState.maxTicketsPerWallet} tickets.`;
        console.error('❌ TICKET LIMIT:', errorMessage);
        throw new Error(errorMessage);
      }
      
      if (ticketCount > remainingTickets) {
        const errorMessage = `Cannot purchase ${ticketCount} tickets. You can only purchase ${remainingTickets} more ticket(s).`;
        console.error('❌ TICKET LIMIT:', errorMessage);
        throw new Error(errorMessage);
      }
      
      console.log('✅ TICKET LIMIT: User can purchase tickets');

      // Step 6: Balance validation
      onProgress({ step: 'balance', message: 'Checking balance...' });
      
      const balance = await getNativeBalance(provider, userAddress);
      const tokenSymbol = 'MON';
      
      const validation = validateSufficientBalance(balance, totalCost, tokenSymbol);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Step 7: Estimate gas
      console.log('🔄 TICKET PURCHASE: Starting gas estimation...');
      onProgress({ step: 'gas', message: 'Estimating gas...' });
      
      const gasEstimate = await estimateBuyTicketsGas(
        raffleContract, 
        ticketCount, 
        totalCost
      );
      
      console.log('🔄 TICKET PURCHASE: Gas estimation completed =', gasEstimate.toString());

      // Step 8: Execute transaction
      console.log('🔄 TICKET PURCHASE: Starting transaction execution...');
      onProgress({ step: 'transaction', message: 'Submitting transaction...' });
      
      const tx = await executeBuyTickets(
        raffleContract, 
        ticketCount, 
        gasEstimate, 
        totalCost
      );
      
      console.log('🔄 TICKET PURCHASE: Transaction execution completed =', !!tx);

      setTxHash(tx.hash);
      onProgress({ 
        step: 'confirmation', 
        message: 'Transaction submitted, waiting for confirmation...', 
        txHash: tx.hash 
      });

      // Step 9: Wait for confirmation
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        const successMessage = `Successfully purchased ${ticketCount} ticket${ticketCount > 1 ? 's' : ''}!`;
        onProgress({ 
          step: 'success', 
          message: successMessage,
          txHash: tx.hash
        });

        // Call success callback
        onSuccess({
          txHash: tx.hash,
          ticketCount,
          totalCost: formatTokenAmount(totalCost.toString()),
          tokenSymbol
        });

        return {
          success: true,
          txHash: tx.hash,
          receipt,
          ticketCount,
          totalCost: formatTokenAmount(totalCost.toString()),
          tokenSymbol
        };
      } else {
        throw new Error('Transaction failed');
      }

    } catch (err) {
      console.error('Error buying tickets:', err);
      const parsedError = handleError(err);
      
      return {
        success: false,
        error: parsedError.message,
        errorType: parsedError.type
      };
    } finally {
      setLoading(false);
    }
  }, [authenticated, user?.wallet, getProviderAndSigner, handleError]);

  /**
   * Check if user can afford tickets
   * @param {Object} params - Check parameters
   * @returns {Promise<Object>} - Affordability check result
   */
  const checkAffordability = useCallback(async ({
    ticketCount,
    ticketPriceRaw
  }) => {
    try {
      if (!authenticated || !user?.wallet) {
        return { canAfford: false, reason: 'Wallet not connected' };
      }

      const { provider, userAddress } = await getProviderAndSigner();
      const ticketPriceWei = parseTicketPrice(ticketPriceRaw);
      const requiredAmount = ticketPriceWei * BigInt(ticketCount);

      const balance = await getNativeBalance(provider, userAddress);
      const validation = validateSufficientBalance(balance, requiredAmount, 'MON');
      
      return {
        canAfford: validation.isValid,
        reason: validation.error,
        balance: formatTokenAmount(balance.toString()),
        required: formatTokenAmount(requiredAmount.toString()),
        tokenSymbol: 'MON'
      };
    } catch (err) {
      console.error('Error checking affordability:', err);
      return { canAfford: false, reason: 'Failed to check balance' };
    }
  }, [authenticated, user?.wallet, getProviderAndSigner]);

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setTxHash(null);
    setProgress(null);
  }, []);

  return {
    // State
    loading,
    error,
    txHash,
    progress,
    
    // Actions
    buyTickets,
    checkAffordability,
    reset,
    
    // Computed
    isProcessing: loading,
    isConnected: authenticated && !!user?.wallet
  };
};