import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  verifyNFTOwnership,
  addWallet as apiAddWallet,
  getUserWallets,
  removeWallet as apiRemoveWallet,
  addSolanaWallet as apiAddSolanaWallet,
  getSolanaWallets,
  removeSolanaWallet as apiRemoveSolanaWallet,
  getWalletNonce,
  getPrimaryWallet as apiGetPrimaryWallet,
  setPrimaryWallet as apiSetPrimaryWallet,
} from '../utils/api';
import { getWalletType } from '../../../config/solanaConfig';

/**
 * Custom hook for wallet management operations
 * Handles wallet CRUD operations and NFT verification for both EVM and Solana wallets
 *
 * @param {Object} discordUser - Discord user object
 * @param {string} discordToken - Discord authorization token
 * @param {string} userAddress - Connected EVM wallet address
 * @param {string} solanaAddress - Connected Solana wallet address
 * @returns {Object} Wallet management state and functions
 */
export const useWalletManagement = (discordUser, discordToken, userAddress, solanaAddress = null) => {
  const [userWallets, setUserWallets] = useState([]); // Combined EVM + Solana wallets
  const [userRoles, setUserRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [primaryWallet, setPrimaryWallet] = useState(null);
  const [isSettingPrimary, setIsSettingPrimary] = useState(false);

  // Fetch both EVM and Solana wallets on mount
  useEffect(() => {
    const fetchAllWallets = async () => {
      if (!discordUser.id || !discordToken) return;

      setIsLoading(true);
      try {
        // Fetch EVM, Solana wallets and primary wallet in parallel
        const [evmResponse, solanaResponse, primaryResponse] = await Promise.all([
          getUserWallets(discordUser.id, discordToken).catch(() => ({ wallets: [] })),
          getSolanaWallets(discordUser.id, discordToken).catch(() => ({ wallets: [] })),
          apiGetPrimaryWallet(discordUser.id, discordToken).catch(() => ({ primaryWallet: null })),
        ]);

        // Set primary wallet
        setPrimaryWallet(primaryResponse.primaryWallet || null);

        // Process EVM wallets with type marker
        const evmWallets = (evmResponse.wallets || []).map(wallet => ({
          ...wallet,
          address: typeof wallet === 'string' ? wallet : wallet.address,
          walletType: 'evm',
        }));

        // Process Solana wallets with type marker
        const solanaWallets = (solanaResponse.wallets || []).map(address => ({
          address: address,
          walletType: 'solana',
          nftCount: 0, // Solana NFTs not tracked on backend for now
        }));

        // Combine and sort by NFT count (descending)
        const combinedWallets = [...evmWallets, ...solanaWallets].sort(
          (a, b) => (b.nftCount || 0) - (a.nftCount || 0)
        );

        setUserWallets(combinedWallets);
      } catch (error) {
        console.error('Error fetching wallets:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllWallets();
  }, [discordUser.id, discordToken]);

  // Verify NFT ownership when wallet is connected
  useEffect(() => {
    const verifyNFT = async () => {
      if (userAddress === '0x0' || !discordUser.username) return;

      const toastId = toast.loading('Verifying NFT ownership...');

      try {
        const userData = {
          userName: discordUser.username,
          userId: discordUser.id,
          walletAddress: userAddress,
        };

        const response = await verifyNFTOwnership(userData, discordToken);

        const gotRoles = response.roles?.length || 0;

        // Combine and sort roles
        if (response.allRoles && response.allRoles.length > 0) {
          // Get priority roles (from roles array) - sorted by requiredAmount
          const priorityRoles = response.roles || [];
          const sortedPriorityRoles = priorityRoles
            .filter(role => role.roleName !== '@everyone')
            .sort((a, b) => (a.requiredAmount || 0) - (b.requiredAmount || 0));

          // Get priority role IDs to filter them out from allRoles
          const priorityRoleIds = new Set(sortedPriorityRoles.map(r => r.roleId));

          // Get remaining roles from allRoles (excluding priority roles and @everyone)
          const remainingRoles = response.allRoles
            .filter(role =>
              role.roleName !== '@everyone' &&
              !priorityRoleIds.has(role.roleId)
            );

          // Combine: priority roles first (with names from allRoles), then remaining roles
          const combinedRoles = [
            ...sortedPriorityRoles.map(role => {
              // Find matching role in allRoles to get real name and color
              const matchingRole = response.allRoles.find(r => r.roleId === role.roleId);
              return {
                roleId: role.roleId,
                roleName: matchingRole?.roleName || role.roleName, // Use allRoles name
                color: matchingRole?.color || 'var(--text-secondary)'
              };
            }),
            ...remainingRoles
          ];

          setUserRoles(combinedRoles);
        }

        toast.dismiss(toastId);

        // Fetch saved wallets first to check if user has NFTs in other wallets
        const [evmResponse, solanaResponse] = await Promise.all([
          getUserWallets(discordUser.id, discordToken).catch(() => ({ wallets: [] })),
          getSolanaWallets(discordUser.id, discordToken).catch(() => ({ wallets: [] })),
        ]);

        const evmWallets = (evmResponse.wallets || []).map(wallet => ({
          ...wallet,
          address: typeof wallet === 'string' ? wallet : wallet.address,
          walletType: 'evm',
        }));

        const solanaWallets = (solanaResponse.wallets || []).map(address => ({
          address: address,
          walletType: 'solana',
          nftCount: 0,
        }));

        const combinedWallets = [...evmWallets, ...solanaWallets].sort(
          (a, b) => (b.nftCount || 0) - (a.nftCount || 0)
        );

        setUserWallets(combinedWallets);

        // Check if any saved wallet has NFTs
        const hasNFTsInSavedWallets = evmWallets.some(w => (w.nftCount || 0) > 0);

        if (gotRoles > 0) {
          toast.success('Verified! You will get verified role(s) soon.');
        } else if (!hasNFTsInSavedWallets) {
          // Only show error if no saved wallets have NFTs
          toast.error("You don't have the required NFT(s)!");
        }

      } catch (error) {
        console.error('Verification error:', error);
        toast.dismiss(toastId);
        toast.error(error.message || 'Something went wrong!');
      }
    };

    verifyNFT();
  }, [userAddress, discordUser.username, discordUser.id, discordToken]);

  // Helper to refresh all wallets
  const refreshWallets = useCallback(async () => {
    if (!discordUser.id || !discordToken) return;

    try {
      const [evmResponse, solanaResponse] = await Promise.all([
        getUserWallets(discordUser.id, discordToken).catch(() => ({ wallets: [] })),
        getSolanaWallets(discordUser.id, discordToken).catch(() => ({ wallets: [] })),
      ]);

      const evmWallets = (evmResponse.wallets || []).map(wallet => ({
        ...wallet,
        address: typeof wallet === 'string' ? wallet : wallet.address,
        walletType: 'evm',
      }));

      const solanaWallets = (solanaResponse.wallets || []).map(address => ({
        address: address,
        walletType: 'solana',
        nftCount: 0,
      }));

      const combinedWallets = [...evmWallets, ...solanaWallets].sort(
        (a, b) => (b.nftCount || 0) - (a.nftCount || 0)
      );

      setUserWallets(combinedWallets);
    } catch (error) {
      console.error('Error refreshing wallets:', error);
    }
  }, [discordUser.id, discordToken]);

  // Add EVM wallet with signature verification
  const addWallet = useCallback(async (walletAddress, signMessageFn) => {
    if (!discordUser.id || !discordToken) {
      toast.error('Please connect with Discord first');
      return;
    }

    if (!walletAddress || walletAddress === '0x0') {
      toast.error('Please connect a wallet first');
      return;
    }

    if (!signMessageFn) {
      toast.error('Wallet signing not available');
      return;
    }

    const toastId = toast.loading('Requesting signature...');

    try {
      // Step 1: Get nonce from server
      const nonceResponse = await getWalletNonce(
        discordUser.id,
        walletAddress,
        'evm',
        discordToken
      );
      const { nonce } = nonceResponse;

      // Step 2: Sign the nonce with wallet
      toast.loading('Please sign the message in your wallet...', { id: toastId });
      const signature = await signMessageFn(nonce);

      // Step 3: Add wallet with signature
      toast.loading('Verifying signature...', { id: toastId });
      await apiAddWallet(discordUser.id, walletAddress, signature, discordToken);

      toast.dismiss(toastId);
      toast.success('EVM wallet added successfully!');

      // Refresh wallet list
      await refreshWallets();
    } catch (error) {
      toast.dismiss(toastId);

      // Handle user rejection
      if (error.code === 4001 || error.message?.includes('rejected')) {
        toast.error('Signature request was rejected');
        return;
      }

      // Handle expired nonce
      if (error.message?.includes('expired') || error.message?.includes('nonce')) {
        toast.error('Verification expired. Please try again.');
        return;
      }

      toast.error(error.message || 'Error adding wallet');
      console.error(error);
    }
  }, [discordUser.id, discordToken, refreshWallets]);

  // Add Solana wallet with signature verification
  const addSolanaWallet = useCallback(async (solanaAddr, signMessageFn) => {
    if (!discordUser.id || !discordToken) {
      toast.error('Please connect with Discord first');
      return;
    }

    if (!solanaAddr) {
      toast.error('Please connect a Solana wallet first');
      return;
    }

    if (!signMessageFn) {
      toast.error('Wallet signing not available');
      return;
    }

    const toastId = toast.loading('Requesting signature...');

    try {
      // Step 1: Get nonce from server
      const nonceResponse = await getWalletNonce(
        discordUser.id,
        solanaAddr,
        'solana',
        discordToken
      );
      const { nonce } = nonceResponse;

      // Step 2: Sign the nonce with wallet (returns base58 encoded signature)
      toast.loading('Please sign the message in your wallet...', { id: toastId });
      const signature = await signMessageFn(nonce);

      // Step 3: Add wallet with signature
      toast.loading('Verifying signature...', { id: toastId });
      await apiAddSolanaWallet(discordUser.id, solanaAddr, signature, discordToken);

      toast.dismiss(toastId);
      toast.success('Solana wallet added successfully!');

      // Refresh wallet list
      await refreshWallets();
    } catch (error) {
      toast.dismiss(toastId);

      // Handle user rejection
      if (error.message?.includes('rejected') || error.message?.includes('User rejected')) {
        toast.error('Signature request was rejected');
        return;
      }

      // Handle expired nonce
      if (error.message?.includes('expired') || error.message?.includes('nonce')) {
        toast.error('Verification expired. Please try again.');
        return;
      }

      toast.error(error.message || 'Error adding Solana wallet');
      console.error(error);
    }
  }, [discordUser.id, discordToken, refreshWallets]);

  // Remove wallet (supports both EVM and Solana)
  const removeWallet = useCallback(async (walletData) => {
    if (!discordUser.id || !discordToken) {
      toast.error('Please connect with Discord first');
      return;
    }

    const addressToRemove = typeof walletData === 'string' ? walletData : walletData.address;
    const walletType = typeof walletData === 'object' ? walletData.walletType : getWalletType(addressToRemove);

    const toastId = toast.loading(`Removing ${walletType === 'solana' ? 'Solana' : 'EVM'} wallet...`);

    try {
      if (walletType === 'solana') {
        await apiRemoveSolanaWallet(discordUser.id, addressToRemove, discordToken);
      } else {
        await apiRemoveWallet(discordUser.id, addressToRemove, discordToken);
      }
      toast.dismiss(toastId);
      toast.success('Wallet removed successfully!');

      // Refresh wallet list
      await refreshWallets();
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(error.message || 'Error removing wallet');
      console.error(error);
    }
  }, [discordUser.id, discordToken, refreshWallets]);

  // Check if EVM wallet is already added
  const isWalletAdded = useCallback((address) => {
    if (!address) return false;
    return userWallets.some(w => {
      const walletAddr = typeof w === 'string' ? w : w.address;
      return walletAddr?.toLowerCase() === address?.toLowerCase();
    });
  }, [userWallets]);

  // Check if Solana wallet is already added
  const isSolanaWalletAdded = useCallback((address) => {
    if (!address) return false;
    return userWallets.some(w => {
      if (w.walletType !== 'solana') return false;
      const walletAddr = typeof w === 'string' ? w : w.address;
      return walletAddr === address; // Solana addresses are case-sensitive
    });
  }, [userWallets]);

  // Set primary wallet for receiving rewards
  const setAsPrimaryWallet = useCallback(async (walletAddress) => {
    if (!discordUser.id || !discordToken) {
      toast.error('Please connect with Discord first');
      return;
    }

    if (!walletAddress) {
      toast.error('Invalid wallet address');
      return;
    }

    setIsSettingPrimary(true);
    const toastId = toast.loading('Setting primary wallet...');

    try {
      await apiSetPrimaryWallet(discordUser.id, walletAddress, discordToken);
      setPrimaryWallet(walletAddress.toLowerCase());
      toast.dismiss(toastId);
      toast.success('Primary wallet set!');
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(error.message || 'Failed to set primary wallet');
      console.error(error);
    } finally {
      setIsSettingPrimary(false);
    }
  }, [discordUser.id, discordToken]);

  // Check if wallet is primary
  const isPrimaryWallet = useCallback((address) => {
    if (!address || !primaryWallet) return false;
    return address.toLowerCase() === primaryWallet.toLowerCase();
  }, [primaryWallet]);

  return {
    userWallets,
    userRoles,
    isLoading,
    addWallet,
    addSolanaWallet,
    removeWallet,
    isWalletAdded,
    isSolanaWalletAdded,
    refreshWallets,
    primaryWallet,
    setAsPrimaryWallet,
    isPrimaryWallet,
    isSettingPrimary,
  };
};
