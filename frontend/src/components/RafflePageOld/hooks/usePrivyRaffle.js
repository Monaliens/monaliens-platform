import { useState, useCallback } from 'react';
import { usePrivyOptimized } from '../../../context';
import { useWalletClient } from 'wagmi';
import toast from 'react-hot-toast';
import { useNetworkSwitch } from '../components/RaffleDetailsModal/hooks/useNetworkSwitch';
import {
  getSigner,
  testContractConnectivity,
  getCreationFee,
  approveERC20Token,
  approveERC721NFT,
  estimateGasForRaffleCreation,
  createRaffleTransaction,
  prepareContractParameters,
  calculateTransactionValue,
  handleBlockchainError,
  validateFormForBlockchain
} from '../utils/blockchainHelpers';
import { CONTRACT_ADDRESSES, PRIZE_TYPES } from '../utils/constants';

/**
 * Custom hook for managing raffle creation with Privy wallet integration
 * 
 * @returns {Object} Raffle creation controls and state
 */
const usePrivyRaffle = () => {
  const { authenticated, user, isConnected, walletAddress } = usePrivyOptimized();
  const { data: walletClient } = useWalletClient();
  const { ensureCorrectNetwork } = useNetworkSwitch();
  // console.log('=== DEBUG: Active wallet ===');
  // console.log('Active wallet:', activeWallet);
  // console.log('Authenticated:', authenticated);
  // console.log('User:', user);
  // console.log('Wallets:', wallets);
  // console.log('=== DEBUG: End of usePrivyRaffle ===');
  
  // State for raffle creation process
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('idle'); // 'idle', 'validating', 'approving', 'creating', 'success', 'error'
  const [error, setError] = useState(null);
  
  // Create raffle with Privy integration
  const createRaffle = useCallback(async (formData) => {
    console.log('=== DEBUG: Starting Privy raffle creation ===');
    console.log('Form data:', formData);
    
    if (!isConnected || !walletAddress) {
      toast.error('Please connect your wallet first');
      return { success: false, error: 'Wallet not connected' };
    }
    
    if (!walletClient) {
      toast.error('Wallet client not available. Please refresh and try again.');
      return { success: false, error: 'No active wallet' };
    }
    
    if (!user?.wallet?.address) {
      toast.error('Could not get user address from wallet');
      return { success: false, error: 'No user address' };
    }
    
    setLoading(true);
    setError(null);
    setStep('validating');

    try {
      // Step 1: Ensure correct network (Monad Testnet)
      console.log('🌐 NETWORK CHECK: Starting network validation...');
      toast.loading('Checking network...', { id: 'create-raffle' });
      
      const isCorrectNetwork = await ensureCorrectNetwork(true);
      
      if (!isCorrectNetwork) {
        const errorMessage = 'Please switch to Monad Testnet to create raffles';
        console.error('❌ NETWORK CHECK: Failed to switch to correct network');
        toast.error(errorMessage, { id: 'create-raffle' });
        setError(errorMessage);
        setLoading(false);
        setStep('error');
        return { success: false, error: errorMessage };
      }
      
      console.log('✅ NETWORK CHECK: Network validation passed');
      toast.success('Connected to Monad Testnet', { id: 'create-raffle' });
      
      const userAddress = user.wallet.address;
      
      // Step 2: Get wallet client
      toast.loading('Connecting to wallet...', { id: 'create-raffle' });
      console.log('=== DEBUG: Getting wallet client ===');
      console.log('Wallet client available:', !!walletClient);
      
      // Use wagmi wallet client with getSigner helper
      const signer = await getSigner(walletClient);
      console.log('Signer created successfully');
      
      // Step 3: Prepare form data for blockchain
      const blockchainFormData = {
        ...formData,
        prizeContractAddress: formData.prizeType === PRIZE_TYPES.TOKEN ? 
          CONTRACT_ADDRESSES.ZERO_ADDRESS : // Native MON token
          formData.selectedAsset.contractAddress,
        prizeTokenId: formData.prizeType === PRIZE_TYPES.NFT ? 
          formData.selectedAsset.tokenId : '0',
        prizeAmount: formData.prizeType === PRIZE_TYPES.TOKEN ? 
          formData.prizeAmount : '0',
        ticketTokenAddress: CONTRACT_ADDRESSES.ZERO_ADDRESS, // Native MON token
        maxTicketsPerWallet: formData.maxTicketsPerWallet || '10',
        maxTotalTickets: formData.maxTotalTickets || '100',
        participantsVisible: true,
        participantCountVisible: true
      };

      console.log('=== DEBUG: Blockchain form data ===');
      console.log('Blockchain form data:', blockchainFormData);

      // Step 4: Blockchain validation
      console.log('=== DEBUG: Starting blockchain validation ===');
      
      // Create mock asset for TOKEN type
      const prizeAsset = formData.prizeType === PRIZE_TYPES.TOKEN ? {
        address: CONTRACT_ADDRESSES.ZERO_ADDRESS,
        symbol: 'MON',
        decimals: 18,
        isNative: true
      } : formData.selectedAsset;
      
      const { isValid, errors: blockchainErrors } = validateFormForBlockchain(
        blockchainFormData, 
        prizeAsset,
        { symbol: 'MON', decimals: 18 } // Default ticket token
      );
      
      console.log('Blockchain validation result:', { isValid, blockchainErrors });
      
      if (!isValid) {
        console.log('=== DEBUG: Blockchain validation failed ===');
        console.log('Blockchain errors:', blockchainErrors);
        const errorMessage = `Validation failed: ${Object.values(blockchainErrors).join(', ')}`;
        toast.error(errorMessage, { id: 'create-raffle' });
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      console.log('=== DEBUG: Blockchain validation passed ===');

      // Step 5: Test contract connectivity
      toast.loading('Testing contract connection...', { id: 'create-raffle' });
      const contractTest = await testContractConnectivity(signer);
      toast.success(`Contract OK - Total raffles: ${contractTest.totalRaffles}`, { id: 'create-raffle' });

      // Step 6: Get creation fee
      toast.loading('Getting creation fee...', { id: 'create-raffle' });
      const creationFee = await getCreationFee(signer);
      console.log('Creation fee:', creationFee.toString());

      // Step 7: Prepare contract parameters
      const params = await prepareContractParameters(
        blockchainFormData, 
        prizeAsset,
        { symbol: 'MON', decimals: 18 }
      );

      // Step 8: Calculate total transaction value
      const totalValue = await calculateTransactionValue(
        walletClient, 
        blockchainFormData, 
        prizeAsset, 
        creationFee
      );

      // Step 9: Handle approvals
      setStep('approving');
      if (blockchainFormData.prizeType === PRIZE_TYPES.TOKEN) {
        // Token approval (only if not native token)
        const isNativeToken = blockchainFormData.prizeContractAddress === CONTRACT_ADDRESSES.ZERO_ADDRESS || 
                             prizeAsset?.isNative === true;
        
        if (!isNativeToken) {
          toast.loading('Approving tokens...', { id: 'create-raffle' });
          const approvalResult = await approveERC20Token(
            signer, 
            blockchainFormData.prizeContractAddress, 
            params.prizeAmount, 
            CONTRACT_ADDRESSES.RAFFLE_FACTORY,
            walletAddress
          );
          
          if (approvalResult.alreadyApproved) {
            toast.success('Tokens already approved', { id: 'create-raffle' });
          } else {
            toast.success('Tokens approved successfully!', { id: 'create-raffle' });
          }
        }
      } else {
        // NFT approval
        toast.loading('Approving NFT...', { id: 'create-raffle' });
        const approvalResult = await approveERC721NFT(
          signer, 
          blockchainFormData.prizeContractAddress, 
          blockchainFormData.prizeTokenId, 
          CONTRACT_ADDRESSES.RAFFLE_FACTORY,
          walletAddress
        );
        
        if (approvalResult.alreadyApproved) {
          toast.success('NFT already approved', { id: 'create-raffle' });
        } else {
          toast.success('NFT approved successfully!', { id: 'create-raffle' });
        }
      }

      // Step 10: Gas estimation
      toast.loading('Estimating gas...', { id: 'create-raffle' });
      await estimateGasForRaffleCreation(signer, params, totalValue, walletAddress);
      toast.success('Gas estimation successful!', { id: 'create-raffle' });

      // Step 11: Create raffle transaction
      setStep('creating');
      toast.loading('Creating raffle transaction...', { id: 'create-raffle' });
      const result = await createRaffleTransaction(signer, params, totalValue, walletAddress);
      
      if (result.success) {
        setStep('success');
        toast.dismiss('create-raffle');
        
        return { 
          success: true, 
          txHash: result.txHash, 
          receipt: result.receipt,
          raffleData: {
            title: formData.title.trim(),
            description: formData.description.trim(),
            prizeType: formData.prizeType,
            prizeContractAddress: blockchainFormData.prizeContractAddress,
            prizeTokenId: blockchainFormData.prizeTokenId,
            prizeAmount: blockchainFormData.prizeAmount,
            ticketPrice: formData.ticketPrice,
            maxTicketsPerWallet: blockchainFormData.maxTicketsPerWallet,
            duration: formData.duration,
            creatorAddress: userAddress,
            transactionHash: result.txHash
          }
        };
      }
    } catch (error) {
      console.error('Error creating raffle:', error);
      const errorMessage = handleBlockchainError(error);
      toast.error(`Error creating raffle: ${errorMessage}`, { id: 'create-raffle' });
      setError(errorMessage);
      setStep('error');
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [isConnected, walletClient, user, ensureCorrectNetwork]);

  // Reset state
  const reset = useCallback(() => {
    setLoading(false);
    setStep('idle');
    setError(null);
  }, []);

  return {
    loading,
    step,
    error,
    createRaffle,
    reset,
    isWalletConnected: isConnected && !!walletAddress,
    userAddress: walletAddress || null,
    walletClient,
    user
  };
};

export default usePrivyRaffle; 