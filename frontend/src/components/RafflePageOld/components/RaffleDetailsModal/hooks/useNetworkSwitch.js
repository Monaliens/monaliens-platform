import { useState, useCallback } from 'react';
import { useWalletProvider } from './useWalletProvider';

// Network configurations
const NETWORK_CONFIG = {
  // Monad Testnet
  10143: {
    chainId: 10143,
    chainName: 'Monad Testnet',
    nativeCurrency: {
      name: 'Monad',
      symbol: 'MON',
      decimals: 18
    },
    rpcUrls: ['https://testnet-rpc.monad.xyz'],
    blockExplorerUrls: ['https://explorer.testnet.monad.xyz']
  },
  // Add other networks as needed
  1: {
    chainId: 1,
    chainName: 'Ethereum Mainnet',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: ['https://mainnet.infura.io/v3/'],
    blockExplorerUrls: ['https://etherscan.io']
  }
};

// Default target network (Monad Testnet)
const DEFAULT_CHAIN_ID = 10143;

/**
 * Hook for managing network validation and switching
 */
export const useNetworkSwitch = () => {
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);
  
  const { 
    isCorrectNetwork, 
    switchNetwork, 
    getNetworkInfo,
    isProviderAvailable 
  } = useWalletProvider();

  /**
   * Get target chain ID from environment or default
   * @returns {number} - Target chain ID
   */
  const getTargetChainId = useCallback(() => {
    // You can get this from environment variables if needed
    return process.env.REACT_APP_CHAIN_ID ? 
      parseInt(process.env.REACT_APP_CHAIN_ID) : 
      DEFAULT_CHAIN_ID;
  }, []);

  /**
   * Check if user is on correct network
   * @returns {Promise<boolean>} - Whether on correct network
   */
  const checkNetwork = useCallback(async () => {
    console.log('🔍 CHECK NETWORK: Starting network check...');
    try {
      if (!isProviderAvailable) {
        console.log('❌ CHECK NETWORK: Provider not available');
        return false;
      }

      const targetChainId = getTargetChainId();
      console.log('🔍 CHECK NETWORK: Target chain ID =', targetChainId);
      
      const result = await isCorrectNetwork(targetChainId);
      console.log('🔍 CHECK NETWORK: Is correct =', result);
      
      return result;
    } catch (err) {
      console.error('❌ CHECK NETWORK: Error checking network:', err);
      return false;
    }
  }, [isProviderAvailable, isCorrectNetwork, getTargetChainId]);

  /**
   * Get current network information
   * @returns {Promise<Object>} - Current network info
   */
  const getCurrentNetwork = useCallback(async () => {
    try {
      return await getNetworkInfo();
    } catch (err) {
      console.error('Error getting current network:', err);
      return null;
    }
  }, [getNetworkInfo]);

  /**
   * Add network to wallet if not present
   * @param {number} chainId - Chain ID to add
   * @returns {Promise<boolean>} - Whether network was added
   */
  const addNetwork = useCallback(async (chainId) => {
    try {
      if (!window.ethereum) {
        throw new Error('No wallet provider found');
      }

      const networkConfig = NETWORK_CONFIG[chainId];
      if (!networkConfig) {
        throw new Error(`Network configuration not found for chain ID: ${chainId}`);
      }

      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [networkConfig]
      });

      return true;
    } catch (err) {
      console.error('Error adding network:', err);
      
      if (err.code === 4001) {
        throw new Error('Network addition rejected by user');
      } else {
        throw new Error(`Failed to add network: ${err.message}`);
      }
    }
  }, []);

  /**
   * Ensure user is on correct network, switch if needed
   * @param {boolean} showToast - Whether to show toast messages
   * @returns {Promise<boolean>} - Whether on correct network after check/switch
   */
  const ensureCorrectNetwork = useCallback(async (showToast = true) => {
    console.log('🔧 ENSURE NETWORK: Starting network check...');
    console.log('🔧 ENSURE NETWORK: Provider available =', isProviderAvailable);
    
    if (!isProviderAvailable) {
      const error = 'Wallet not connected';
      console.error('❌ ENSURE NETWORK: Provider not available:', error);
      if (showToast) {
        // You can integrate with your toast system here
        console.error(error);
      }
      setError(error);
      return false;
    }

    setSwitching(true);
    setError(null);

    try {
      const targetChainId = getTargetChainId();
      console.log('🔧 ENSURE NETWORK: Target chain ID =', targetChainId);
      
      const isCorrect = await checkNetwork();
      console.log('🔧 ENSURE NETWORK: Is correct network =', isCorrect);

      if (isCorrect) {
        console.log('✅ ENSURE NETWORK: Already on correct network');
        return true;
      }

      // Network switch needed
      console.log('🔄 ENSURE NETWORK: Network switch needed');
      if (showToast) {
        console.log('Switching to correct network...');
      }

      try {
        console.log('🔄 ENSURE NETWORK: Attempting to switch network...');
        const switchSuccess = await switchNetwork(targetChainId);
        console.log('🔄 ENSURE NETWORK: Switch result =', switchSuccess);
        
        if (switchSuccess) {
          console.log('✅ ENSURE NETWORK: Successfully switched network');
          if (showToast) {
            console.log('Successfully switched network');
          }
          return true;
        } else {
          throw new Error('Network switch failed');
        }
      } catch (switchErr) {
        console.error('❌ ENSURE NETWORK: Switch error:', switchErr);
        // If switch fails, try adding the network
        if (switchErr.message?.includes('not found')) {
          if (showToast) {
            console.log('Adding network to wallet...');
          }
          
          await addNetwork(targetChainId);
          
          // Try switching again after adding
          const retrySwitchSuccess = await switchNetwork(targetChainId);
          
          if (retrySwitchSuccess) {
            if (showToast) {
              console.log('Successfully added and switched network');
            }
            return true;
          }
        }
        
        throw switchErr;
      }
    } catch (err) {
      console.error('Error ensuring correct network:', err);
      setError(err.message);
      
      if (showToast) {
        console.error(`Network error: ${err.message}`);
      }
      
      return false;
    } finally {
      setSwitching(false);
    }
  }, [
    isProviderAvailable,
    checkNetwork,
    getTargetChainId,
    switchNetwork,
    addNetwork
  ]);

  /**
   * Get network display name
   * @param {number} chainId - Chain ID
   * @returns {string} - Network display name
   */
  const getNetworkDisplayName = useCallback((chainId) => {
    const config = NETWORK_CONFIG[chainId];
    return config ? config.chainName : `Chain ${chainId}`;
  }, []);

  /**
   * Get expected network info
   * @returns {Object} - Expected network configuration
   */
  const getExpectedNetwork = useCallback(() => {
    const targetChainId = getTargetChainId();
    return NETWORK_CONFIG[targetChainId] || null;
  }, [getTargetChainId]);

  return {
    // State
    switching,
    error,
    
    // Actions
    checkNetwork,
    ensureCorrectNetwork,
    getCurrentNetwork,
    addNetwork,
    
    // Utilities
    getTargetChainId,
    getNetworkDisplayName,
    getExpectedNetwork,
    
    // Computed
    isProviderAvailable
  };
}; 