import { useContractRead, useContractReads } from 'wagmi'
import { getContractAddress } from '@/utils/deployments'
import { RAFFLE_FACTORY_ABI } from '@/utils/contracts'
import { useMemo } from 'react'

interface RaffleDetails {
  raffleAddress: string
  owner: string
  createdAt: bigint
  isActive: boolean
}

/**
 * Hook to get all raffle addresses and basic info efficiently
 * Uses the contract functions that were missing from the ABI
 */
export function useAllRaffles() {
  const raffleFactoryAddress = getContractAddress('raffleFactory') as `0x${string}`

  // Get total number of raffles
  const { data: totalRaffles, isLoading: loadingTotal } = useContractRead({
    address: raffleFactoryAddress,
    abi: RAFFLE_FACTORY_ABI,
    functionName: 'totalRaffles',
  })

  // Get all active raffles in one call
  const { data: activeRaffles, isLoading: loadingActive, error: activeError } = useContractRead({
    address: raffleFactoryAddress,
    abi: RAFFLE_FACTORY_ABI,
    functionName: 'getAllActiveRaffles',
  })

  // Get raffle addresses for specific range (if you want to paginate)
  const raffleIds = useMemo(() => {
    if (!totalRaffles) return []
    return Array.from({ length: Number(totalRaffles) }, (_, i) => i)
  }, [totalRaffles])

  // Get multiple raffle details at once (useful for pagination)
  const { data: allRaffleDetails, isLoading: loadingDetails } = useContractReads({
    contracts: raffleIds.slice(0, 50).map((id) => ({
      address: raffleFactoryAddress,
      abi: RAFFLE_FACTORY_ABI as any,
      functionName: 'getRaffleDetails',
      args: [id],
    })),
    enabled: raffleIds.length > 0,
  })

  const processedActiveRaffles = (activeRaffles as RaffleDetails[] | undefined) || []
  const processedAllDetails = allRaffleDetails?.map((result: any, index) => ({
    raffleId: index,
    ...(result.result || {}),
  })) || []

  return {
    // All active raffles (most efficient for active ones)
    activeRaffles: processedActiveRaffles,
    loadingActive,
    activeError,

    // Total count
    totalRaffles: totalRaffles ? Number(totalRaffles) : 0,
    loadingTotal,

    // All raffle details (paginated to first 50)
    allRaffleDetails: processedAllDetails,
    loadingDetails,

    // Helper functions
    isLoading: loadingTotal || loadingActive || loadingDetails,
    
    // Get just the addresses
    activeRaffleAddresses: processedActiveRaffles.map((raffle: RaffleDetails) => raffle.raffleAddress),
    allRaffleAddresses: processedAllDetails.map((detail: any) => detail.raffleAddress).filter(Boolean),
  }
}

/**
 * Hook to get raffles for a specific user
 */
export function useUserRaffles(userAddress?: string) {
  const raffleFactoryAddress = getContractAddress('raffleFactory') as `0x${string}`

  const { data: userRaffleIds, isLoading, error } = useContractRead({
    address: raffleFactoryAddress,
    abi: RAFFLE_FACTORY_ABI,
    functionName: 'getRafflesByUser',
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    enabled: !!userAddress,
  })

  // Get details for user's raffles
  const { data: userRaffleDetails, isLoading: loadingDetails } = useContractReads({
    contracts: (userRaffleIds as number[] || []).map((id: number) => ({
      address: raffleFactoryAddress,
      abi: RAFFLE_FACTORY_ABI as any,
      functionName: 'getRaffleDetails',
      args: [id],
    })),
    enabled: !!userRaffleIds && Array.isArray(userRaffleIds) && userRaffleIds.length > 0,
  })

  const processedUserIds = (userRaffleIds as number[]) || []
  const processedUserDetails = userRaffleDetails?.map((result: any, index) => ({
    raffleId: processedUserIds[index],
    ...(result.result || {}),
  })) || []

  return {
    raffleIds: processedUserIds,
    raffleDetails: processedUserDetails,
    isLoading: isLoading || loadingDetails,
    error,
  }
}

/**
 * Hook to get raffle addresses in batches (for large datasets)
 */
export function useRaffleAddressesBatch(startId: number = 0, batchSize: number = 100) {
  const raffleFactoryAddress = getContractAddress('raffleFactory') as `0x${string}`

  // Get total count first
  const { data: totalRaffles } = useContractRead({
    address: raffleFactoryAddress,
    abi: RAFFLE_FACTORY_ABI,
    functionName: 'totalRaffles',
  })

  // Create batch of IDs
  const batchIds = useMemo(() => {
    if (!totalRaffles) return []
    const total = Number(totalRaffles)
    const endId = Math.min(startId + batchSize, total)
    return Array.from({ length: endId - startId }, (_, i) => startId + i)
  }, [totalRaffles, startId, batchSize])

  // Get batch details
  const { data: batchDetails, isLoading } = useContractReads({
    contracts: batchIds.map((id) => ({
      address: raffleFactoryAddress,
      abi: RAFFLE_FACTORY_ABI as any,
      functionName: 'getRaffleDetails',
      args: [id],
    })),
    enabled: batchIds.length > 0,
  })

  const processedBatchDetails = batchDetails?.map((result: any, index) => ({
    raffleId: batchIds[index],
    ...(result.result || {}),
  })) || []

  return {
    raffleAddresses: processedBatchDetails.map((detail: any) => detail.raffleAddress).filter(Boolean),
    raffleDetails: processedBatchDetails,
    totalRaffles: totalRaffles ? Number(totalRaffles) : 0,
    isLoading,
    hasMore: totalRaffles ? startId + batchSize < Number(totalRaffles) : false,
  }
} 