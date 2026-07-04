import { useState, useCallback } from 'react';
import { usePrivyOptimized } from '../../../../../context';
import { useWalletProvider } from './useWalletProvider';
import { useNetworkSwitch } from './useNetworkSwitch';
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
 * Simplified for native token payments only
 */
export const useTicketPurchase = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  
  const { user, authenticated } = usePrivyOptimized();
  const { getProviderAndSigner } = useWalletProvider();
  const { ensureCorrectNetwork } = useNetworkSwitch();

  // Create error handler (you can integrate with your toast system)
  const handleError = createBlockchainErrorHandler((message) => {
    console.error('Ticket purchase error:', message);
    setError(message);
  });

  /**
   * Buy tickets for a raffle
   * @param {Object} params - Purchase parameters
   * @param {string} params.raffleAddress - Raffle contract address
   * @param {number} params.ticketCount - Number of tickets to buy
   * @param {string|number} params.ticketPrice - Price per ticket
   * @param {string} params.ticketTokenAddress - Token contract address (or null for native)
   * @param {Function} params.onProgress - Progress callback function
   * @returns {Promise<Object>} - Purchase result
   */
  const buyTickets = useCallback(async ({
    raffleAddress,
    ticketCount,
    ticketPrice,
    ticketTokenAddress,
    onProgress = () => {}
  }) => {
    // Validation
    console.log('🔍 PURCHASE VALIDATION:', {
      authenticated,
      hasWallet: !!user?.wallet,
      raffleAddress,
      ticketCount,
      ticketPrice,
      ticketTokenAddress
    });

    if (!authenticated || !user?.wallet) {
      const error = 'Please connect your wallet first';
      console.error('❌ WALLET:', error);
      handleError(new Error(error));
      return { success: false, error };
    }

    if (!raffleAddress || !ticketCount || !ticketPrice) {
      const error = 'Invalid purchase parameters';
      console.error('❌ PARAMS:', { raffleAddress, ticketCount, ticketPrice });
      handleError(new Error(error));
      return { success: false, error };
    }

    console.log('✅ PURCHASE VALIDATION: All checks passed');

    setLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Step 1: Ensure correct network
      console.log('🌐 NETWORK CHECK: Starting network validation...');
      onProgress({ step: 'network', message: 'Checking network...' });
      
      const isCorrectNet = await ensureCorrectNetwork();
      console.log('🌐 NETWORK CHECK: Result =', isCorrectNet);
      
      if (!isCorrectNet) {
        console.error('❌ NETWORK CHECK: Failed to switch to correct network');
        throw new Error('Please switch to the correct network');
      }
      
      console.log('✅ NETWORK CHECK: Network validation passed');

      // Step 2: Get provider and signer
      onProgress({ step: 'wallet', message: 'Connecting to wallet...' });
      const { provider, signer, userAddress } = await getProviderAndSigner();

      // Step 3: Parse ticket price and calculate initial cost
      const ticketPriceWei = parseTicketPrice(ticketPrice);
      const baseCost = ticketPriceWei * BigInt(ticketCount);
      const isNative = isNativeToken(ticketTokenAddress);

      // Step 4: Get raffle contract instance
      const raffleContract = await getRaffleContract(signer, raffleAddress);

      // Step 4.5: Check raffle state and get platform fee info
      console.log('🔄 TICKET PURCHASE: Checking raffle state...');
      onProgress({ step: 'validation', message: 'Checking raffle state...' });
      
      const raffleState = await checkRaffleState(raffleContract);
      // Step 4.6: NATIVE MON - Send only ticket price (contract handles platform fee internally)
      const totalCost = baseCost; // Contract expects only ticket price
      
      console.log('💰 Purchasing', ticketCount, 'tickets for', formatTokenAmount(totalCost.toString()), 'MON');
      
      if (raffleState.platformFeePercentage > 0) {
        const estimatedFeeAmount = (baseCost * BigInt(raffleState.platformFeePercentage)) / BigInt(10000);
        console.log('💰 Platform fee:', formatTokenAmount(estimatedFeeAmount.toString()), 'MON (handled by contract)');
      }
      
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

      // Step 4.6: Check user's current ticket count
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

      // Step 5: Balance validation - NATIVE MON ONLY
      onProgress({ step: 'balance', message: 'Checking balance...' });
      
      const balance = await getNativeBalance(provider, userAddress);
      const tokenSymbol = 'MON';
      
      const validation = validateSufficientBalance(balance, totalCost, tokenSymbol);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Step 6: Estimate gas for buyTickets transaction - NATIVE MON ONLY
      console.log('🔄 TICKET PURCHASE: Starting gas estimation...');
      onProgress({ step: 'gas', message: 'Estimating gas...' });
      
      console.log('🔄 TICKET PURCHASE: Contract instance =', !!raffleContract);
      console.log('🔄 TICKET PURCHASE: Calling estimateBuyTicketsGas with params:', {
        ticketCount,
        totalCost: formatTokenAmount(totalCost.toString()) + ' MON'
      });
      
      const gasEstimate = await estimateBuyTicketsGas(
        raffleContract, 
        ticketCount, 
        totalCost
      );
      
      console.log('🔄 TICKET PURCHASE: Gas estimation completed =', gasEstimate.toString());

      // Step 7: Execute buyTickets transaction - NATIVE MON ONLY
      console.log('🔄 TICKET PURCHASE: Starting transaction execution...');
      onProgress({ step: 'transaction', message: 'Submitting transaction...' });
      
      console.log('🔄 TICKET PURCHASE: Calling executeBuyTickets with params:', {
        ticketCount,
        gasEstimate: gasEstimate.toString(),
        totalCost: formatTokenAmount(totalCost.toString()) + ' MON'
      });
      
      const tx = await executeBuyTickets(
        raffleContract, 
        ticketCount, 
        gasEstimate, 
        totalCost
      );
      
      console.log('🔄 TICKET PURCHASE: Transaction execution completed =', !!tx);
      console.log('🔄 TICKET PURCHASE: Transaction details:', {
        hash: tx.hash,
        to: tx.to,
        value: tx.value ? formatTokenAmount(tx.value.toString()) + ' MON' : '0 MON',
        data: tx.data?.substring(0, 50) + '...' // First 50 chars of data
      });

      setTxHash(tx.hash);
      onProgress({ 
        step: 'confirmation', 
        message: 'Transaction submitted, waiting for confirmation...', 
        txHash: tx.hash 
      });

      // Step 9: Wait for transaction confirmation
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        onProgress({ 
          step: 'success', 
          message: `Successfully purchased ${ticketCount} ticket${ticketCount > 1 ? 's' : ''}!`,
          txHash: tx.hash
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
  }, [authenticated, user?.wallet, getProviderAndSigner, ensureCorrectNetwork, handleError]);

  /**
   * Check if user can afford tickets - NATIVE MON ONLY
   * @param {Object} params - Check parameters
   * @returns {Promise<Object>} - Affordability check result
   */
  const checkAffordability = useCallback(async ({
    ticketCount,
    ticketPrice
  }) => {
    try {
      if (!authenticated || !user?.wallet) {
        return { canAfford: false, reason: 'Wallet not connected' };
      }

      const { provider, userAddress } = await getProviderAndSigner();
      const ticketPriceWei = parseTicketPrice(ticketPrice);
      // Only check for ticket price - contract handles platform fee internally
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
  }, []);

  return {
    // State
    loading,
    error,
    txHash,
    
    // Actions
    buyTickets,
    checkAffordability,
    reset,
    
    // Computed
    isProcessing: loading,
    isConnected: authenticated && !!user?.wallet
  };
}; 