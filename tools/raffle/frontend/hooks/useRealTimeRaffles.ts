import { useEffect, useRef } from 'react'
import { useRaffle } from '@/context/RaffleContext'
import { Raffle } from '@/types'
import { getApiUrl } from '../utils/deployments'

const API_BASE_URL = getApiUrl()

export function useRealTimeRaffles() {
  const { state, setRaffles, setActiveRaffles, setEndedRaffles, updateRaffle, addRaffle, setLoading, setError } = useRaffle()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastUpdateRef = useRef<Date>(new Date())

  // Fetch raffles from API
  const fetchRaffles = async (): Promise<Raffle[]> => {
    const response = await fetch(`${API_BASE_URL}/api/raffles`)
    if (!response.ok) {
      throw new Error(`Failed to fetch raffles: ${response.statusText}`)
    }
    const data = await response.json()
    return data.success ? data.data.raffles : []
  }

  // Fetch active raffles
  const fetchActiveRaffles = async (): Promise<Raffle[]> => {
    const response = await fetch(`${API_BASE_URL}/api/raffles/active`)
    if (!response.ok) {
      throw new Error(`Failed to fetch active raffles: ${response.statusText}`)
    }
    const data = await response.json()
    return data.success ? data.data.raffles : []
  }

  // Fetch ended raffles
  const fetchEndedRaffles = async (): Promise<Raffle[]> => {
    const response = await fetch(`${API_BASE_URL}/api/raffles/ended`)
    if (!response.ok) {
      throw new Error(`Failed to fetch ended raffles: ${response.statusText}`)
    }
    const data = await response.json()
    return data.success ? data.data.raffles : []
  }

  // Fetch updates since last check
  const fetchUpdates = async () => {
    try {
      const timestamp = lastUpdateRef.current.toISOString()
      const response = await fetch(`${API_BASE_URL}/api/raffles/updates?since=${timestamp}`)
      if (!response.ok) {
        if (response.status === 404) {
          console.log('Updates endpoint not available, skipping...')
          return
        }
        throw new Error(`Failed to fetch updates: ${response.statusText}`)
      }
      
      const updates = await response.json()
      
      // Process updates
      if (Array.isArray(updates)) {
        updates.forEach((raffle: Raffle) => {
          updateRaffle(raffle)
        })
      }
      
      lastUpdateRef.current = new Date()
    } catch (error) {
      console.error('Error fetching raffle updates:', error)
    }
  }

  // Load initial data
  const loadInitialData = async () => {
    setLoading('raffles', true)
    setError(null)
    
    try {
      const [allRaffles, activeRaffles, endedRaffles] = await Promise.all([
        fetchRaffles(),
        fetchActiveRaffles(),
        fetchEndedRaffles()
      ])
      
      setRaffles(allRaffles)
      setActiveRaffles(activeRaffles)
      setEndedRaffles(endedRaffles)
      
      lastUpdateRef.current = new Date()
    } catch (error) {
      console.error('Error loading initial raffle data:', error)
      setError(error instanceof Error ? error.message : 'Failed to load raffles')
    } finally {
      setLoading('raffles', false)
    }
  }

  // Start polling for updates
  const startPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    // Poll every 10 seconds for updates
    intervalRef.current = setInterval(fetchUpdates, 10000)
  }

  // Stop polling
  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  // Refresh all data
  const refreshData = async () => {
    await loadInitialData()
  }

  // Handle new raffle creation
  const handleNewRaffle = (raffle: Raffle) => {
    addRaffle(raffle)
    lastUpdateRef.current = new Date()
  }

  // Initialize on mount
  useEffect(() => {
    loadInitialData()
    startPolling()
    
    return () => {
      stopPolling()
    }
  }, [])

  // Listen for visibility changes to pause/resume polling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        fetchUpdates()
        startPolling()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return {
    raffles: state.raffles,
    activeRaffles: state.activeRaffles,
    endedRaffles: state.endedRaffles,
    loading: state.loading.raffles,
    error: state.error,
    refreshData,
    handleNewRaffle,
    startPolling,
    stopPolling
  }
}