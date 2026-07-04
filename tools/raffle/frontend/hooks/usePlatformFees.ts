import { useState, useEffect, useCallback } from 'react'
import { PlatformFee, PlatformFeeStats, PlatformDashboard, ApiResponse, PaginatedResponse } from '@/types'
import { getApiUrl } from '../utils/deployments'

const API_BASE_URL = getApiUrl()

interface UsePlatformFeesReturn {
  fees: PlatformFee[]
  stats: PlatformFeeStats | null
  dashboard: PlatformDashboard | null
  loading: boolean
  error: string | null
  fetchFees: (params?: {
    page?: number
    limit?: number
    tokenAddress?: string
    startDate?: string
    endDate?: string
    raffleId?: string
    isWithdrawn?: boolean
  }) => Promise<void>
  fetchStats: (params?: {
    tokenAddress?: string
    period?: '7d' | '30d' | '90d' | '1y'
  }) => Promise<void>
  fetchDashboard: () => Promise<void>
  fetchFeesByWallet: (walletAddress: string) => Promise<PlatformFee[]>
  recordFee: (feeData: Omit<PlatformFee, '_id' | 'createdAt' | 'updatedAt'>) => Promise<void>
}

export function usePlatformFees(): UsePlatformFeesReturn {
  const [fees, setFees] = useState<PlatformFee[]>([])
  const [stats, setStats] = useState<PlatformFeeStats | null>(null)
  const [dashboard, setDashboard] = useState<PlatformDashboard | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchFees = useCallback(async (params?: {
    page?: number
    limit?: number
    tokenAddress?: string
    startDate?: string
    endDate?: string
    raffleId?: string
    isWithdrawn?: boolean
  }) => {
    try {
      setLoading(true)
      setError(null)

      const queryParams = new URLSearchParams()
      if (params?.page) queryParams.append('page', params.page.toString())
      if (params?.limit) queryParams.append('limit', params.limit.toString())
      if (params?.tokenAddress) queryParams.append('tokenAddress', params.tokenAddress)
      if (params?.startDate) queryParams.append('startDate', params.startDate)
      if (params?.endDate) queryParams.append('endDate', params.endDate)
      if (params?.raffleId) queryParams.append('raffleId', params.raffleId)
      if (params?.isWithdrawn !== undefined) queryParams.append('isWithdrawn', params.isWithdrawn.toString())

      const response = await fetch(`${API_BASE_URL}/api/platform-fees?${queryParams}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch platform fees')
      }

      if (data.success && data.data.fees) {
        setFees(data.data.fees)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Error fetching platform fees:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchStats = useCallback(async (params?: {
    tokenAddress?: string
    period?: '7d' | '30d' | '90d' | '1y'
  }) => {
    try {
      setLoading(true)
      setError(null)

      const queryParams = new URLSearchParams()
      if (params?.tokenAddress) queryParams.append('tokenAddress', params.tokenAddress)
      if (params?.period) queryParams.append('period', params.period)

      const response = await fetch(`${API_BASE_URL}/api/platform-fees/stats?${queryParams}`)
      const data: ApiResponse<PlatformFeeStats> = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch platform fee stats')
      }

      if (data.success && data.data) {
        setStats(data.data)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Error fetching platform fee stats:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`${API_BASE_URL}/api/platform-fees/dashboard`)
      const data: ApiResponse<PlatformDashboard> = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch platform dashboard')
      }

      if (data.success && data.data) {
        setDashboard(data.data)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Error fetching platform dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchFeesByWallet = useCallback(async (walletAddress: string): Promise<PlatformFee[]> => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`${API_BASE_URL}/api/platform-fees/wallet/${walletAddress}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch fees by wallet')
      }

      if (data.success && data.data.fees) {
        return data.data.fees
      }
      return []
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Error fetching fees by wallet:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const recordFee = useCallback(async (feeData: Omit<PlatformFee, '_id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`${API_BASE_URL}/api/platform-fees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feeData),
      })

      const data: ApiResponse<PlatformFee> = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to record platform fee')
      }

      if (data.success && data.data) {
        // Add the new fee to the beginning of the list
        setFees(prev => [data.data!, ...prev])
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Error recording platform fee:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // Calculate formatted values for display
  const formatFeeAmount = useCallback((amount: string, decimals: number, symbol: string) => {
    const formattedAmount = (parseFloat(amount) / Math.pow(10, decimals)).toFixed(4)
    return `${formattedAmount} ${symbol}`
  }, [])

  const formatFeePercentage = useCallback((percentage: number) => {
    return `${percentage / 100}%`
  }, [])

  return {
    fees,
    stats,
    dashboard,
    loading,
    error,
    fetchFees,
    fetchStats,
    fetchDashboard,
    fetchFeesByWallet,
    recordFee,
  }
}

// Hook for platform fee utilities
export function usePlatformFeeUtils() {
  const calculatePlatformFee = useCallback((ticketPrice: string, ticketCount: number, feePercentage: number) => {
    const totalRevenue = parseFloat(ticketPrice) * ticketCount
    const platformFee = totalRevenue * (feePercentage / 10000)
    const ownerFee = totalRevenue - platformFee
    
    return {
      totalRevenue,
      platformFee,
      ownerFee,
      platformFeePercentage: feePercentage / 100
    }
  }, [])

  const formatTokenAmount = useCallback((amount: string | number, decimals: number = 18, symbol: string = '') => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    const formatted = (numAmount / Math.pow(10, decimals)).toFixed(4)
    return symbol ? `${formatted} ${symbol}` : formatted
  }, [])

  return {
    calculatePlatformFee,
    formatTokenAmount,
  }
}