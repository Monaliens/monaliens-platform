import React from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useNetworkSwitch } from '@/hooks/useNetworkSwitch'

interface NetworkGuardProps {
  children: React.ReactNode
  showNetworkIndicator?: boolean
}

/**
 * NetworkGuard component that automatically handles network switching
 * and optionally shows network status indicator
 */
export default function NetworkGuard({ 
  children, 
  showNetworkIndicator = true 
}: NetworkGuardProps) {
  const { authenticated } = usePrivy()
  const { 
    isCorrectNetwork, 
    currentChain, 
    isCheckingNetwork,
    switchToMonad 
  } = useNetworkSwitch()

  // If user is not authenticated, show children without network checks
  if (!authenticated) {
    return <>{children}</>
  }

  return (
    <>
      {/* Optional network status indicator */}
      {showNetworkIndicator && authenticated && currentChain && (
        <div className="fixed top-16 right-4 z-50">
          <div
            className={`
              px-3 py-2 rounded-lg text-sm font-medium shadow-lg transition-all duration-300
              ${isCorrectNetwork 
                ? 'bg-green-600 text-white' 
                : 'bg-red-600 text-white cursor-pointer hover:bg-red-700'
              }
              ${isCheckingNetwork ? 'opacity-50 animate-pulse' : ''}
            `}
            onClick={!isCorrectNetwork ? switchToMonad : undefined}
            title={!isCorrectNetwork ? 'Click to switch to Monad testnet' : undefined}
          >
            <div className="flex items-center gap-2">
              <div
                className={`
                  w-2 h-2 rounded-full
                  ${isCorrectNetwork ? 'bg-green-200' : 'bg-red-200'}
                  ${isCheckingNetwork ? 'animate-pulse' : ''}
                `}
              />
              <span>
                {isCheckingNetwork 
                  ? 'Switching...' 
                  : isCorrectNetwork 
                    ? 'Monad Testnet' 
                    : currentChain.name
                }
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Show children - network switching happens automatically via the hook */}
      {children}
    </>
  )
}

/**
 * Hook to get network status for conditional rendering
 */
export function useNetworkStatus() {
  const { authenticated } = usePrivy()
  const { 
    isCorrectNetwork, 
    currentChain, 
    isCheckingNetwork 
  } = useNetworkSwitch()

  return {
    authenticated,
    isCorrectNetwork,
    currentChain,
    isCheckingNetwork,
    shouldShowNetworkWarning: authenticated && !isCorrectNetwork && currentChain
  }
} 