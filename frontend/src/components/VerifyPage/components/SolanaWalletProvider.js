import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { getSolanaWallets, solanaEndpoint } from '../../../config/solanaConfig';

// Import default styles for wallet adapter
import '@solana/wallet-adapter-react-ui/styles.css';

/**
 * SolanaWalletProvider Component
 * Provides Solana wallet context only for the VerifyPage
 */
const SolanaWalletProvider = ({ children }) => {
  const wallets = useMemo(() => getSolanaWallets(), []);

  return (
    <ConnectionProvider endpoint={solanaEndpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default SolanaWalletProvider;
