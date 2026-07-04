import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { useMemo, useCallback } from 'react'

// Utility function to shorten address (show only last 4 characters)
const shortenAddress = (address) => {
  if (!address) return ''
  return `${address.slice(-4)}`
}

export const useReownWallet = () => {
  const { address, isConnected, isConnecting, isReconnecting, status } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { signMessageAsync, isPending: isSigningMessage } = useSignMessage()
  const { open, close } = useAppKit()

  // Sign a message with the connected wallet
  const signMessage = useCallback(async (message) => {
    if (!address) {
      throw new Error('No wallet connected')
    }
    return signMessageAsync({ message })
  }, [address, signMessageAsync])

  const contextValue = useMemo(() => {
    const ready = status !== 'connecting' && status !== 'reconnecting'
    const authenticated = isConnected && address
    const walletAddress = address || null
    const displayAddress = address ? shortenAddress(address) : ''

    return {
      // Core state matching Privy API
      ready,
      authenticated: Boolean(authenticated),
      isConnected: Boolean(isConnected),
      
      // Address data
      walletAddress,
      displayAddress,
      
      // Derived values
      hasWallet: Boolean(walletAddress),
      
      // Connection functions - using AppKit modal
      login: () => open(),
      logout: () => disconnect(),
      
      // Additional wallet functions (keeping for compatibility)
      linkWallet: () => open(),
      unlinkWallet: () => disconnect(),
      createWallet: () => open(),
      
      // Utility
      shortenAddress,
      
      // User object for backward compatibility
      user: authenticated ? {
        wallet: {
          address: walletAddress
        }
      } : null,
      
      // Additional wagmi specific states
      isConnecting,
      isReconnecting,
      status,
      
      // Direct access to AppKit functions
      openModal: () => open(),
      closeModal: () => close(),
      
      // Available connectors
      connectors,
      connect,

      // Message signing
      signMessage,
      isSigningMessage,
    }
  }, [
    address,
    isConnected,
    isConnecting,
    isReconnecting,
    status,
    connect,
    disconnect,
    open,
    close,
    connectors,
    signMessage,
    isSigningMessage,
  ])

  return contextValue
}