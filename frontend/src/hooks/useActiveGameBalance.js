import { useCallback, useMemo } from 'react';
import { useAppKitBalance } from '@reown/appkit/react';
import { formatEther } from 'viem';
import { useGameWallet } from '../context';

export const clearAppKitBalanceCache = () => {
  try {
    localStorage.removeItem('@appkit/native_balance_cache');
  } catch (e) {
    // Silent fail
  }
};

export const useActiveGameBalance = ({ balanceData, refetchBalance, isConnected }) => {
  const { fetchBalance } = useAppKitBalance();
  const {
    balance: gameWalletBalance,
    isUsingGameWallet,
    refreshBalance: refreshGameWalletBalance
  } = useGameWallet();

  const mainWalletBalance = useMemo(
    () => (balanceData ? formatEther(balanceData.value) : null),
    [balanceData]
  );

  const activeBalance = isUsingGameWallet ? gameWalletBalance : mainWalletBalance;

  const refreshBalances = useCallback(() => {
    refetchBalance?.();
    refreshGameWalletBalance?.();
    clearAppKitBalanceCache();
    fetchBalance();
  }, [fetchBalance, refetchBalance, refreshGameWalletBalance]);

  return {
    activeBalance: isConnected ? activeBalance : '0',
    mainWalletBalance,
    isUsingGameWallet,
    refreshBalances
  };
};
