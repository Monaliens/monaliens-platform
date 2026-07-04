import { useState, useCallback } from 'react';
import { useTicketPurchase } from './useTicketPurchase';
import { PARTICIPATION_CONFIG } from '../data/participationConfig';
import { 
  calculateTotalCost, 
  validateQuantity, 
  getUpdatedQuantity,
  canBuyMoreTickets,
  canBuyFewerTickets
} from '../utils/priceUtils';

export const useParticipation = (raffle, authenticated, onParticipate) => {
  const [ticketQuantity, setTicketQuantity] = useState(PARTICIPATION_CONFIG.defaultQuantity);
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [progress, setProgress] = useState(null);
  
  // Use blockchain ticket purchase hook
  const { 
    buyTickets, 
    loading, 
    error: purchaseError,
    txHash: purchaseTxHash,
    reset: resetPurchase 
  } = useTicketPurchase();

  // Calculate total cost
  const totalCost = calculateTotalCost(
    raffle?.ticketPrice || raffle?.ticketPriceFormatted, 
    ticketQuantity
  );

  // Handle quantity change with validation
  const handleQuantityChange = useCallback((change) => {
    const newQuantity = getUpdatedQuantity(ticketQuantity, change, raffle?.maxTicketsPerWallet);
    setTicketQuantity(newQuantity);
    setError(null); // Clear any previous errors
  }, [ticketQuantity, raffle?.maxTicketsPerWallet]);

  // Handle direct quantity input
  const handleQuantityInput = useCallback((value) => {
    const validatedQuantity = validateQuantity(value, raffle?.maxTicketsPerWallet);
    setTicketQuantity(validatedQuantity);
    setError(null); // Clear any previous errors
  }, [raffle?.maxTicketsPerWallet]);

  // Enhanced error handling
  const getErrorMessage = (error) => {
    const { errorHandling } = PARTICIPATION_CONFIG;
    
    if (error.code === 4001 || error.message?.includes('rejected')) {
      return errorHandling.messages.REJECTED;
    }
    
    if (error.message?.includes('insufficient funds') || error.message?.includes('Insufficient balance')) {
      return errorHandling.messages.INSUFFICIENT_FUNDS;
    }
    
    if (error.message?.includes('network') || error.status >= 500) {
      return errorHandling.messages.NETWORK_ERROR;
    }
    
    if (error.message?.includes('ended') || error.message?.includes('Raffle ended')) {
      return errorHandling.messages.RAFFLE_ENDED;
    }
    
    if (error.message?.includes('not active') || error.message?.includes('inactive')) {
      return errorHandling.messages.RAFFLE_INACTIVE;
    }
    
    if (error.message?.includes('max tickets') || error.message?.includes('Exceeds max')) {
      return errorHandling.messages.MAX_TICKETS_EXCEEDED;
    }
    
    if (error.message?.includes('timeout') || error.status === 408) {
      return errorHandling.messages.TIMEOUT;
    }
    
    return error.message || errorHandling.messages.UNKNOWN;
  };

  // Enhanced validation for blockchain integration
  const validateParticipation = () => {
    const { validation } = PARTICIPATION_CONFIG;
    
    console.log('🔍 VALIDATION DEBUG:', {
      authenticated,
      contractAddress: raffle?.contractAddress,
      ticketPrice: raffle?.ticketPrice,
      ticketPriceFormatted: raffle?.ticketPriceFormatted,
      ticketTokenAddress: raffle?.ticketTokenAddress,
      status: raffle?.status,
      endTime: raffle?.endTime
    });
    
    if (!authenticated) {
      return { isValid: false, error: 'Please connect your wallet to participate' };
    }

    // For blockchain integration, we need contractAddress instead of raffleId
    const contractAddress = raffle?.contractAddress;
    if (!contractAddress) {
      console.error('❌ Missing contract address');
      return { isValid: false, error: 'Raffle contract address not found' };
    }

    if (!raffle?.ticketPrice && !raffle?.ticketPriceFormatted) {
      console.error('❌ Missing ticket price');
      return { isValid: false, error: 'Ticket price not found' };
    }

    if (ticketQuantity < validation.minQuantity) {
      return { isValid: false, error: validation.messages.minQuantity(validation.minQuantity) };
    }

    if (raffle.maxTicketsPerWallet && ticketQuantity > raffle.maxTicketsPerWallet) {
      return { isValid: false, error: validation.messages.maxQuantity(raffle.maxTicketsPerWallet) };
    }

    // Check if raffle is still active
    if (raffle.status !== 'ACTIVE') {
      return { isValid: false, error: 'Raffle is not active' };
    }

    // Check if raffle has ended
    if (raffle.endTime && new Date() > new Date(raffle.endTime)) {
      return { isValid: false, error: 'Raffle has ended' };
    }

    console.log('✅ Validation passed');
    return { isValid: true, error: null };
  };

  // Handle participation submission with blockchain integration
  const handleParticipate = async () => {
    // Validate before processing
    const validation = validateParticipation();
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    // Clear previous state
    setError(null);
    setTxHash(null);
    setProgress(null);
    resetPurchase();

    try {
      // Prepare purchase parameters
      const purchaseParams = {
        raffleAddress: raffle?.contractAddress,
        ticketCount: ticketQuantity,
        ticketPrice: raffle?.ticketPrice || raffle?.ticketPriceFormatted,
        ticketTokenAddress: raffle?.ticketTokenAddress,
        onProgress: (progressData) => {
          setProgress(progressData);
          console.log('🚀 Purchase progress:', progressData);
        }
      };

      console.log('📋 PURCHASE PARAMS:', purchaseParams);

      // Execute blockchain purchase
      console.log('🔄 Starting buyTickets...');
      const result = await buyTickets(purchaseParams);
      console.log('📊 Purchase result:', result);

      if (result.success) {
        setTxHash(result.txHash);
        
        // Call the parent's onParticipate callback if provided
        if (typeof onParticipate === 'function') {
          onParticipate({
            txHash: result.txHash,
            ticketCount: result.ticketCount,
            totalCost: result.totalCost,
            tokenSymbol: result.tokenSymbol
          });
        }

        // Reset form on success
        setTicketQuantity(PARTICIPATION_CONFIG.defaultQuantity);
        setProgress({ 
          step: 'complete', 
          message: 'Purchase completed successfully!' 
        });
      } else {
        throw new Error(result.error || 'Transaction failed');
      }
      
    } catch (err) {
      console.error('Error participating in raffle:', err);
      const userFriendlyError = getErrorMessage(err);
      setError(userFriendlyError);
      setProgress(null);
    }
  };

  // Check if user can buy more/fewer tickets
  const canIncreaseQuantity = canBuyMoreTickets(ticketQuantity, raffle?.maxTicketsPerWallet);
  const canDecreaseQuantity = canBuyFewerTickets(ticketQuantity);

  // Get participation button text
  const getButtonText = () => {
    if (loading) {
      return PARTICIPATION_CONFIG.buttonTexts.processing;
    }
    
    if (!authenticated) {
      return PARTICIPATION_CONFIG.buttonTexts.notAuthenticated;
    }
    
    // Check raffle status
    if (raffle?.status !== 'ACTIVE') {
      return PARTICIPATION_CONFIG.buttonTexts.ended;
    }
    
    // Check if raffle has ended
    if (raffle?.endTime && new Date() > new Date(raffle.endTime)) {
      return PARTICIPATION_CONFIG.buttonTexts.ended;
    }
    
    // Check max tickets
    if (raffle?.maxTicketsPerWallet && ticketQuantity > raffle.maxTicketsPerWallet) {
      return PARTICIPATION_CONFIG.buttonTexts.maxTicketsReached;
    }
    
    return PARTICIPATION_CONFIG.buttonTexts.participate(ticketQuantity);
  };

  // Check if button should be disabled
  const raffleAddress = raffle?.contractAddress;
  const isButtonDisabled = 
    loading || 
    !authenticated || 
    !raffleAddress ||
    ticketQuantity < PARTICIPATION_CONFIG.minQuantity ||
    (raffle?.maxTicketsPerWallet && ticketQuantity > raffle.maxTicketsPerWallet) ||
    raffle?.status !== 'ACTIVE' ||
    (raffle?.endTime && new Date() > new Date(raffle.endTime));

  // Reset state
  const resetState = () => {
    setTicketQuantity(PARTICIPATION_CONFIG.defaultQuantity);
    setLoading(false);
    setError(null);
  };

  // Combine errors from different sources
  const combinedError = error || purchaseError;

  return {
    // State
    ticketQuantity,
    loading,
    error: combinedError,
    totalCost,
    txHash: txHash || purchaseTxHash,
    progress,
    
    // Actions
    handleQuantityChange,
    handleQuantityInput,
    handleParticipate,
    resetState: () => {
      setTicketQuantity(PARTICIPATION_CONFIG.defaultQuantity);
      setError(null);
      setTxHash(null);
      setProgress(null);
      resetPurchase();
    },
    
    // Computed values
    canIncreaseQuantity,
    canDecreaseQuantity,
    buttonText: getButtonText(),
    isButtonDisabled,
    isProcessing: loading,
    
    // Setters for external control
    setTicketQuantity,
    setError
  };
}; 