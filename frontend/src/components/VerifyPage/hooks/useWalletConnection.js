import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

/**
 * Custom hook for wallet connection management
 * Handles MetaMask/Web3 wallet connection and account changes
 *
 * @returns {Object} Wallet connection state and functions
 */
export const useWalletConnection = () => {
  const [userAddress, setUserAddress] = useState('0x0');
  const [isConnecting, setIsConnecting] = useState(false);
  const [buttonText, setButtonText] = useState('Connect Wallet');

  // Check for already connected wallet on mount
  useEffect(() => {
    const checkConnectedWallet = async () => {
      if (!window.ethereum) return;

      try {
        const accounts = await window.ethereum.request({
          method: 'eth_accounts',
        });

        if (accounts.length > 0) {
          setUserAddress(accounts[0]);
          setButtonText('Disconnect Wallet');
        }
      } catch (error) {
        console.error('Error checking connected wallet:', error);
      }
    };

    checkConnectedWallet();
  }, []);

  // Handle account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      console.log('Accounts changed:', accounts);

      if (accounts.length === 0) {
        // User disconnected
        setUserAddress('0x0');
        setButtonText('Connect Wallet');
      } else {
        // User switched accounts
        setUserAddress(accounts[0]);
        setButtonText('Disconnect Wallet');
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, []);

  // Connect wallet function
  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      toast.error('No web3 wallet detected. Please install MetaMask.');
      return;
    }

    setIsConnecting(true);

    try {
      // If already connected, toggle disconnect
      if (userAddress !== '0x0') {
        if (buttonText === 'Connect Wallet') {
          toast.success('Connected!');
          setButtonText('Disconnect Wallet');
        } else {
          setButtonText('Connect Wallet');
        }
        setIsConnecting(false);
        return;
      }

      const toastId = toast.loading('Connecting wallet...');

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      const account = accounts[0];

      if (account) {
        setButtonText('Disconnect Wallet');
        setUserAddress(account);
        toast.dismiss(toastId);
        toast.success('Wallet connected!');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  }, [userAddress, buttonText]);

  return {
    userAddress,
    isConnected: userAddress !== '0x0',
    isConnecting,
    buttonText,
    connectWallet,
  };
};
