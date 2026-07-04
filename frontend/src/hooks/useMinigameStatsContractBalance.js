import { useMemo } from 'react';
import { useBalance } from 'wagmi';
import { MINIGAME_STATS_CONTRACT_BALANCE_ADDRESS } from '../config/minigameStatsBalanceAddress';

/**
 * On-chain native balance for the shared minigame stats treasury address (Stats → Contract Balance).
 */
export function useMinigameStatsContractBalance() {
  const { data, isPending } = useBalance({
    address: MINIGAME_STATS_CONTRACT_BALANCE_ADDRESS,
    query: {
      staleTime: 15_000,
      refetchInterval: 30_000,
    },
  });

  const formattedMon = useMemo(() => {
    if (data?.formatted === undefined) return null;
    return parseFloat(data.formatted).toFixed(2);
  }, [data?.formatted]);

  return { formattedMon, isPending };
}
