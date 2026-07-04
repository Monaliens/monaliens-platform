import { useWallet } from '@solana/wallet-adapter-react';
import { useMemo, useCallback, useState, useEffect } from 'react';
import bs58 from 'bs58';

/**
 * Custom hook for Solana wallet connection in VerifyPage
 * Provides a unified interface for Solana wallet state and actions
 *
 * @returns {Object} Solana wallet state and functions
 */
export const useSolanaWallet = () => {
  const {
    publicKey,
    connected,
    connecting,
    disconnect,
    select,
    wallets,
    wallet,
    signMessage: walletSignMessage,
  } = useWallet();

  const [isSigningMessage, setIsSigningMessage] = useState(false);
  const [, forceUpdate] = useState(0);

  // Filter out MetaMask from Solana wallets (it incorrectly registers as a Solana wallet)
  const isMetaMaskWallet = wallet?.adapter?.name?.toLowerCase().includes('metamask');
  const filteredWallets = useMemo(() => {
    return wallets.filter(w => !w.adapter.name.toLowerCase().includes('metamask'));
  }, [wallets]);

  // Use adapter's connected state as fallback (for Standard Wallets like Phantom)
  // Ignore MetaMask as it's not a real Solana wallet
  const isAdapterConnected = !isMetaMaskWallet && (wallet?.adapter?.connected ?? false);
  const adapterPublicKey = !isMetaMaskWallet ? wallet?.adapter?.publicKey : null;

  // Effective connection state - use adapter state if context is out of sync
  const effectiveConnected = connected || isAdapterConnected;
  const effectivePublicKey = publicKey || adapterPublicKey;

  // Listen to adapter connection changes for Standard Wallets
  useEffect(() => {
    const adapter = wallet?.adapter;
    if (!adapter) return;

    const handleConnect = () => forceUpdate(n => n + 1);
    const handleDisconnect = () => forceUpdate(n => n + 1);

    adapter.on('connect', handleConnect);
    adapter.on('disconnect', handleDisconnect);

    return () => {
      adapter.off('connect', handleConnect);
      adapter.off('disconnect', handleDisconnect);
    };
  }, [wallet]);

  // Auto-connect when wallet is selected from modal but not yet connected
  // Skip MetaMask as it incorrectly registers as a Solana wallet
  useEffect(() => {
    const adapter = wallet?.adapter;
    const isMetaMask = adapter?.name?.toLowerCase().includes('metamask');
    if (adapter && !isMetaMask && !adapter.connected && !connecting && adapter.readyState === 'Installed') {
      adapter.connect().catch(() => {});
    }
  }, [wallet, connecting]);

  // Get the wallet address as a string
  const solanaAddress = useMemo(() => {
    return effectivePublicKey ? effectivePublicKey.toBase58() : null;
  }, [effectivePublicKey]);

  // Shortened address for display
  const displayAddress = useMemo(() => {
    if (!solanaAddress) return '';
    return `${solanaAddress.slice(0, 4)}...${solanaAddress.slice(-4)}`;
  }, [solanaAddress]);

  // Disconnect wallet
  const disconnectSolana = useCallback(async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Error disconnecting Solana wallet:', error);
    }
  }, [disconnect]);

  // Sign a message and return base58 encoded signature
  // Use adapter's signMessage as fallback for Standard Wallets
  const signMessage = useCallback(async (message) => {
    const adapter = wallet?.adapter;
    const hasContextSign = !!walletSignMessage;
    const hasAdapterSign = !!adapter?.signMessage;

    if (!hasContextSign && !hasAdapterSign) {
      throw new Error('Wallet does not support message signing');
    }

    setIsSigningMessage(true);
    try {
      // Convert message to Uint8Array
      const messageBytes = new TextEncoder().encode(message);
      // Sign the message - use context function if available, otherwise use adapter directly
      let signatureBytes;
      if (hasContextSign) {
        signatureBytes = await walletSignMessage(messageBytes);
      } else {
        signatureBytes = await adapter.signMessage(messageBytes);
      }
      // Return base58 encoded signature
      return bs58.encode(signatureBytes);
    } finally {
      setIsSigningMessage(false);
    }
  }, [walletSignMessage, wallet]);

  // Manual connect function (for when wallet is already selected)
  const connectWallet = useCallback(async () => {
    if (wallet && !effectiveConnected && !connecting) {
      try {
        await wallet.adapter.connect();
      } catch {
        // User may have rejected
      }
    }
  }, [wallet, effectiveConnected, connecting]);

  return {
    // Connection state (using effective state for Standard Wallet compatibility)
    isConnected: effectiveConnected,
    isConnecting: connecting,

    // Address
    solanaAddress,
    displayAddress,

    // Wallet info (MetaMask filtered out)
    wallets: filteredWallets,
    selectedWallet: isMetaMaskWallet ? null : wallet,

    // Actions
    selectWallet: select,
    disconnect: disconnectSolana,
    signMessage,
    isSigningMessage,
    connectWallet,

    // Type identifier
    walletType: 'solana',
  };
};

export default useSolanaWallet;
