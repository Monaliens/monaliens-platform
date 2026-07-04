import React from 'react';
import WalletItem from './WalletItem';
import { WalletListContainer } from '../styles';

/**
 * WalletList Component
 * Displays a list of connected wallets
 *
 * @param {Object} props - Component props
 * @param {Array} props.wallets - Array of wallet data
 * @param {Function} props.onRemove - Remove wallet handler
 * @param {string} props.primaryWallet - Primary wallet address
 * @param {Function} props.onSetPrimary - Set primary wallet handler
 * @param {Function} props.isPrimaryWallet - Check if wallet is primary
 * @param {boolean} props.isSettingPrimary - Whether setting primary is in progress
 */
const WalletList = ({ wallets, onRemove, primaryWallet, onSetPrimary, isPrimaryWallet, isSettingPrimary }) => {
  if (!wallets || wallets.length === 0) {
    return null;
  }

  return (
    <WalletListContainer>
      {wallets.map((wallet, index) => (
        <WalletItem
          key={index}
          wallet={wallet}
          index={index}
          onRemove={onRemove}
          isPrimary={isPrimaryWallet(wallet.address)}
          onSetPrimary={onSetPrimary}
          isSettingPrimary={isSettingPrimary}
        />
      ))}
    </WalletListContainer>
  );
};

export default WalletList;
