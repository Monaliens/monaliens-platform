import React, { createContext, useContext, useReducer, ReactNode } from 'react'
import { Raffle, User, StakingPool } from '@/types'

interface RaffleState {
  raffles: Raffle[]
  activeRaffles: Raffle[]
  endedRaffles: Raffle[]
  userRaffles: Raffle[]
  currentUser: User | null
  stakingPools: StakingPool[]
  loading: {
    raffles: boolean
    user: boolean
    staking: boolean
  }
  error: string | null
}

type RaffleAction =
  | { type: 'SET_RAFFLES'; payload: Raffle[] }
  | { type: 'SET_ACTIVE_RAFFLES'; payload: Raffle[] }
  | { type: 'SET_ENDED_RAFFLES'; payload: Raffle[] }
  | { type: 'SET_USER_RAFFLES'; payload: Raffle[] }
  | { type: 'SET_CURRENT_USER'; payload: User | null }
  | { type: 'SET_STAKING_POOLS'; payload: StakingPool[] }
  | { type: 'SET_LOADING'; payload: { key: keyof RaffleState['loading']; value: boolean } }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_RAFFLE'; payload: Raffle }
  | { type: 'ADD_RAFFLE'; payload: Raffle }
  | { type: 'REMOVE_RAFFLE'; payload: string }

const initialState: RaffleState = {
  raffles: [],
  activeRaffles: [],
  endedRaffles: [],
  userRaffles: [],
  currentUser: null,
  stakingPools: [],
  loading: {
    raffles: false,
    user: false,
    staking: false,
  },
  error: null,
}

function raffleReducer(state: RaffleState, action: RaffleAction): RaffleState {
  switch (action.type) {
    case 'SET_RAFFLES':
      return { ...state, raffles: action.payload }
    
    case 'SET_ACTIVE_RAFFLES':
      return { ...state, activeRaffles: action.payload }
    
    case 'SET_ENDED_RAFFLES':
      return { ...state, endedRaffles: action.payload }
    
    case 'SET_USER_RAFFLES':
      return { ...state, userRaffles: action.payload }
    
    case 'SET_CURRENT_USER':
      return { ...state, currentUser: action.payload }
    
    case 'SET_STAKING_POOLS':
      return { ...state, stakingPools: action.payload }
    
    case 'SET_LOADING':
      return {
        ...state,
        loading: {
          ...state.loading,
          [action.payload.key]: action.payload.value,
        },
      }
    
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    
    case 'UPDATE_RAFFLE': {
      const updateRaffleInArray = (raffles: Raffle[]) =>
        raffles.map(raffle =>
          raffle.raffleId === action.payload.raffleId ? action.payload : raffle
        )
      
      return {
        ...state,
        raffles: updateRaffleInArray(state.raffles),
        activeRaffles: updateRaffleInArray(state.activeRaffles),
        endedRaffles: updateRaffleInArray(state.endedRaffles),
        userRaffles: updateRaffleInArray(state.userRaffles),
      }
    }
    
    case 'ADD_RAFFLE':
      return {
        ...state,
        raffles: [action.payload, ...state.raffles],
        activeRaffles: action.payload.status === 'ACTIVE' 
          ? [action.payload, ...state.activeRaffles] 
          : state.activeRaffles,
      }
    
    case 'REMOVE_RAFFLE': {
      const filterRaffles = (raffles: Raffle[]) =>
        raffles.filter(raffle => raffle.raffleId.toString() !== action.payload)
      
      return {
        ...state,
        raffles: filterRaffles(state.raffles),
        activeRaffles: filterRaffles(state.activeRaffles),
        endedRaffles: filterRaffles(state.endedRaffles),
        userRaffles: filterRaffles(state.userRaffles),
      }
    }
    
    default:
      return state
  }
}

interface RaffleContextType {
  state: RaffleState
  dispatch: React.Dispatch<RaffleAction>
  // Helper functions
  setRaffles: (raffles: Raffle[]) => void
  setActiveRaffles: (raffles: Raffle[]) => void
  setEndedRaffles: (raffles: Raffle[]) => void
  setUserRaffles: (raffles: Raffle[]) => void
  setCurrentUser: (user: User | null) => void
  setStakingPools: (pools: StakingPool[]) => void
  setLoading: (key: keyof RaffleState['loading'], value: boolean) => void
  setError: (error: string | null) => void
  updateRaffle: (raffle: Raffle) => void
  addRaffle: (raffle: Raffle) => void
  removeRaffle: (raffleId: string) => void
}

const RaffleContext = createContext<RaffleContextType | undefined>(undefined)

export function RaffleProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(raffleReducer, initialState)

  // Helper functions
  const setRaffles = (raffles: Raffle[]) => {
    dispatch({ type: 'SET_RAFFLES', payload: raffles })
  }

  const setActiveRaffles = (raffles: Raffle[]) => {
    dispatch({ type: 'SET_ACTIVE_RAFFLES', payload: raffles })
  }

  const setEndedRaffles = (raffles: Raffle[]) => {
    dispatch({ type: 'SET_ENDED_RAFFLES', payload: raffles })
  }

  const setUserRaffles = (raffles: Raffle[]) => {
    dispatch({ type: 'SET_USER_RAFFLES', payload: raffles })
  }

  const setCurrentUser = (user: User | null) => {
    dispatch({ type: 'SET_CURRENT_USER', payload: user })
  }

  const setStakingPools = (pools: StakingPool[]) => {
    dispatch({ type: 'SET_STAKING_POOLS', payload: pools })
  }

  const setLoading = (key: keyof RaffleState['loading'], value: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: { key, value } })
  }

  const setError = (error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error })
  }

  const updateRaffle = (raffle: Raffle) => {
    dispatch({ type: 'UPDATE_RAFFLE', payload: raffle })
  }

  const addRaffle = (raffle: Raffle) => {
    dispatch({ type: 'ADD_RAFFLE', payload: raffle })
  }

  const removeRaffle = (raffleId: string) => {
    dispatch({ type: 'REMOVE_RAFFLE', payload: raffleId })
  }

  const value: RaffleContextType = {
    state,
    dispatch,
    setRaffles,
    setActiveRaffles,
    setEndedRaffles,
    setUserRaffles,
    setCurrentUser,
    setStakingPools,
    setLoading,
    setError,
    updateRaffle,
    addRaffle,
    removeRaffle,
  }

  return (
    <RaffleContext.Provider value={value}>
      {children}
    </RaffleContext.Provider>
  )
}

export function useRaffle() {
  const context = useContext(RaffleContext)
  if (context === undefined) {
    throw new Error('useRaffle must be used within a RaffleProvider')
  }
  return context
}