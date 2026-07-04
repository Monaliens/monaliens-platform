import { useState, useCallback } from 'react';
import { usePrivyOptimized } from '../../../../../context';
import { useWalletClient, useSwitchChain } from 'wagmi';

/**
 * Hook for managing wallet provider and signer
 * Integrates with Privy for wallet management
 */
export const useWalletProvider = () => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { user, authenticated, isConnected, walletAddress } = usePrivyOptimized();
  const { data: walletClient } = useWalletClient();
  const { switchChain } = useSwitchChain();

  /**
   * Get provider and signer instances
   * @returns {Promise<Object>} - Provider and signer objects
   */
  const getProviderAndSigner = useCallback(async () => {
    console.log('🔗 GET PROVIDER: Starting provider setup...');
    console.log('🔗 GET PROVIDER: Authenticated =', authenticated);
    console.log('🔗 GET PROVIDER: Connected =', isConnected);
    console.log('🔗 GET PROVIDER: Wallet client =', !!walletClient);
    
    if (!isConnected || !walletAddress) {
      const error = 'Wallet not connected';
      console.error('❌ GET PROVIDER:', error);
      throw new Error(error);
    }

    if (!walletClient) {
      const error = 'Wallet client not available';
      console.error('❌ GET PROVIDER:', error);
      throw new Error(error);
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔗 GET PROVIDER: Using Wagmi wallet client...');
      const { ethers } = await import('ethers');

      // Get provider from wagmi wallet client
      const web3Provider = new ethers.BrowserProvider(walletClient.transport);
      const web3Signer = await web3Provider.getSigner();

      console.log('✅ GET PROVIDER: Provider created successfully');
      console.log('✅ GET PROVIDER: Signer address =', await web3Signer.getAddress());

      // Cache instances
      setProvider(web3Provider);
      setSigner(web3Signer);

      console.log('✅ GET PROVIDER: Setup completed successfully');
      return {
        provider: web3Provider,
        signer: web3Signer,
        userAddress: walletAddress,
        wallet: walletClient
      };
    } catch (err) {
      console.error('❌ GET PROVIDER: Error getting provider and signer:', err);
      
      // Add timeout handling
      if (err.message.includes('timeout') || err.message.includes('Time out')) {
        setError('Connection timeout. Please try again.');
      } else if (err.message.includes('rejected') || err.code === 4001) {
        setError('User rejected the connection request.');
      } else {
        setError(err.message);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [authenticated, isConnected, walletAddress, walletClient]);

  /**
   * Get current user address
   * @returns {Promise<string>} - User's wallet address
   */
  const getUserAddress = useCallback(async () => {
    try {
      // Return wallet address directly from ReOwn context
      if (walletAddress) {
        console.log('🏠 GET ADDRESS: Using ReOwn wallet address:', walletAddress);
        return walletAddress;
      }
      
      // Fallback to cached signer if needed
      if (signer) {
        console.log('🏠 GET ADDRESS: Using cached signer...');
        return await signer.getAddress();
      }
      
      // Try to get from ReOwn wallet address if available
      if (walletAddress) {
        console.log('🏠 GET ADDRESS: Using ReOwn wallet address directly...');
        return walletAddress;
      }
      
      // Fallback to full provider setup
      console.log('🏠 GET ADDRESS: Fallback to provider setup...');
      const { signer: newSigner } = await getProviderAndSigner();
      return await newSigner.getAddress();
    } catch (err) {
      console.error('❌ GET ADDRESS: Error getting user address:', err);
      throw err;
    }
  }, [signer, walletAddress, getProviderAndSigner]);

  /**
   * Get current network information
   * @returns {Promise<Object>} - Network information
   */
  const getNetworkInfo = useCallback(async () => {
    console.log('📡 GET NETWORK INFO: Starting...');
    try {
      console.log('📡 GET NETWORK INFO: Current provider =', !!provider);
      
      let currentProvider = provider;
      if (!currentProvider) {
        console.log('📡 GET NETWORK INFO: Getting provider...');
        const result = await getProviderAndSigner();
        currentProvider = result.provider;
      }
      
      console.log('📡 GET NETWORK INFO: Provider obtained =', !!currentProvider);
      
      const network = await currentProvider.getNetwork();
      console.log('📡 GET NETWORK INFO: Raw network =', network);
      
      const networkInfo = {
        chainId: Number(network.chainId),
        name: network.name,
        isTestnet: network.chainId !== 1n // Mainnet chainId is 1
      };
      
      console.log('📡 GET NETWORK INFO: Processed network info =', networkInfo);
      return networkInfo;
    } catch (err) {
      console.error('❌ GET NETWORK INFO: Error getting network info:', err);
      throw err;
    }
  }, [provider, getProviderAndSigner]);

  /**
   * Check if wallet is connected to correct network
   * @param {number} expectedChainId - Expected chain ID
   * @returns {Promise<boolean>} - Whether on correct network
   */
  const isCorrectNetwork = useCallback(async (expectedChainId) => {
    console.log('🔎 IS CORRECT NETWORK: Checking network for chain ID =', expectedChainId);
    try {
      const networkInfo = await getNetworkInfo();
      console.log('🔎 IS CORRECT NETWORK: Current network =', networkInfo);
      
      const isCorrect = networkInfo.chainId === expectedChainId;
      console.log('🔎 IS CORRECT NETWORK: Is correct =', isCorrect);
      
      return isCorrect;
    } catch (err) {
      console.error('❌ IS CORRECT NETWORK: Error checking network:', err);
      return false;
    }
  }, [getNetworkInfo]);

  /**
   * Request network switch with better Privy support
   * @param {number} targetChainId - Target chain ID
   * @returns {Promise<boolean>} - Whether switch was successful
   */
  const switchNetwork = useCallback(async (targetChainId) => {
    console.log('🔄 SWITCH NETWORK: Starting network switch to', targetChainId);
    try {
      // Use Wagmi's switchChain hook (ReOwn compatible)
      if (switchChain) {
        console.log('🔄 SWITCH NETWORK: Using Wagmi switchChain...');
        
        await switchChain({ chainId: targetChainId });
        
        // Wait for network switch to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Clear cache to force refresh
        setProvider(null);
        setSigner(null);
        
        // Verify the switch
        const isCorrect = await isCorrectNetwork(targetChainId);
        console.log('🔄 SWITCH NETWORK: Switch successful =', isCorrect);
        return isCorrect;
      }

      // Fallback to window.ethereum
      console.log('🔄 SWITCH NETWORK: Fallback to window.ethereum...');
      if (!window.ethereum) {
        throw new Error('No wallet provider found');
      }

      const hexChainId = `0x${targetChainId.toString(16)}`;
      
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }]
      });

      // Wait a bit for the network switch to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Clear cached instances to force refresh
      setProvider(null);
      setSigner(null);
      
      // Verify the switch
      const isCorrect = await isCorrectNetwork(targetChainId);
      console.log('🔄 SWITCH NETWORK: Final verification =', isCorrect);
      
      return isCorrect;
    } catch (err) {
      console.error('❌ SWITCH NETWORK: Error switching network:', err);
      
      // Handle specific error codes
      if (err.code === 4902) {
        throw new Error('Network not found in wallet. Please add it manually.');
      } else if (err.code === 4001) {
        throw new Error('Network switch rejected by user');
      } else {
        throw new Error(`Failed to switch network: ${err.message}`);
      }
    }
  }, [switchChain, isCorrectNetwork]);

  /**
   * Clear cached provider and signer
   */
  const clearCache = useCallback(() => {
    console.log('🧹 CLEAR CACHE: Clearing provider and signer cache...');
    setProvider(null);
    setSigner(null);
    setError(null);
  }, []);

  /**
   * Check if provider is available
   * @returns {boolean} - Whether provider is available
   */
  const isProviderAvailable = useCallback(() => {
    const hasWallet = isConnected && !!walletAddress;
    const hasWalletClient = !!walletClient;
    const hasEthereum = !!window.ethereum;
    
    // Remove excessive logging - only log when state changes
    const result = hasWallet && (hasWalletClient || hasEthereum);
    return result;
  }, [isConnected, walletAddress, walletClient]);

  return {
    // State
    provider,
    signer,
    loading,
    error,
    
    // Actions
    getProviderAndSigner,
    getUserAddress,
    getNetworkInfo,
    isCorrectNetwork,
    switchNetwork,
    clearCache,
    
    // Computed
    isProviderAvailable: isProviderAvailable(),
    isConnected: isConnected && !!walletAddress,
    connectorsCount: walletClient ? 1 : 0,
    activeWallet: walletClient || null
  };
}; 