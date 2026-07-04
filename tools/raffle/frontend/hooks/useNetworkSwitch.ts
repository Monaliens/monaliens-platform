import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useNetwork, useSwitchNetwork } from 'wagmi'
import toast from 'react-hot-toast'
import { getChainId, getBlockchainConfig } from '@/utils/deployments'
import { monadTestnet } from '@/utils/wagmi'
import { useWalletProvider } from '@/hooks/useWalletProvider'

export function useNetworkSwitch() {
  const [isCheckingNetwork, setIsCheckingNetwork] = useState(false)
  const [hasPromptedSwitch, setHasPromptedSwitch] = useState(false)
  const { authenticated, user } = usePrivy()
  const { chain: currentChain } = useNetwork()
  const { switchNetwork, isLoading: isSwitching } = useSwitchNetwork()
  const { requestAddChain, requestSwitchChain } = useWalletProvider()
  
  const requiredChainId = getChainId()
  const blockchainConfig = getBlockchainConfig()
  const isCorrectNetwork = currentChain?.id === requiredChainId



  /**
   * Add Monad testnet to user's wallet if not present
   */
  const addMonadNetwork = async () => {
    if (!user?.wallet) {
      toast.error('Wallet not available')
      return false
    }

    try {
      await requestAddChain({
        chainId: `0x${requiredChainId.toString(16)}`,
        chainName: blockchainConfig.name,
        nativeCurrency: {
          name: blockchainConfig.symbol,
          symbol: blockchainConfig.symbol,
          decimals: blockchainConfig.decimals
        },
        rpcUrls: [monadTestnet.rpcUrls.default.http[0]],
        blockExplorerUrls: [blockchainConfig.explorer.url]
      })
      return true
    } catch (error: any) {
      console.error('Failed to add Monad network:', error)
      if (error.code === 4001) {
        toast.error('User rejected adding Monad testnet')
      } else {
        toast.error('Failed to add Monad testnet to wallet')
      }
      return false
    }
  }

  /**
   * Switch to Monad testnet
   */
  const switchToMonad = async (): Promise<boolean> => {
    if (!authenticated || !user?.wallet) {
      toast.error('Please connect your wallet first')
      return false
    }

    setIsCheckingNetwork(true)

    try {
      // First try to switch using wagmi
      if (switchNetwork) {
        switchNetwork(requiredChainId)
        setIsCheckingNetwork(false)
        return true
      }

      // Fallback: Try to switch directly via wallet
      try {
        await requestSwitchChain(`0x${requiredChainId.toString(16)}`)
        setIsCheckingNetwork(false)
        return true
      } catch (switchError) {
        console.error('Direct switch failed:', switchError)
      }

      throw new Error('No switching method available')

    } catch (error: any) {
      console.error('Network switch error:', error)
      
      // If network not found (4902), try to add it
      if (error.code === 4902) {
        const added = await addMonadNetwork()
        if (added) {
          // Try switching again after adding
          return switchToMonad()
        }
      } else if (error.code === 4001) {
        toast.error('Please switch to Monad testnet to continue')
      } else {
        toast.error('Failed to switch to Monad testnet')
      }
      
      setIsCheckingNetwork(false)
      return false
    }
  }

  /**
   * Check network and prompt switch if needed
   */
  const checkAndSwitchNetwork = async () => {
    if (!authenticated || !user?.wallet || hasPromptedSwitch) {
      return
    }

    if (!isCorrectNetwork && currentChain) {
      setHasPromptedSwitch(true)
      
             // Show toast notification for wrong network
       toast.error(
         `Wrong network detected. You're on ${currentChain.name}. Please switch to ${blockchainConfig.name} to continue.`,
         {
           duration: 8000,
           style: {
             minWidth: '300px',
             backgroundColor: '#1f2937',
             color: '#f9fafb',
             border: '1px solid #374151'
           },
           id: 'network-switch-warning'
         }
       )
       
       // Auto-attempt to switch networks
       setTimeout(async () => {
         const success = await switchToMonad()
         if (success) {
           toast.success('Switched to Monad testnet')
           setHasPromptedSwitch(false)
         } else {
           setHasPromptedSwitch(false)
         }
       }, 1000)
    }
  }

  // Auto-check network when user connects or network changes
  useEffect(() => {
    if (authenticated && user?.wallet) {
      checkAndSwitchNetwork()
    }
  }, [authenticated, user?.wallet, currentChain?.id])

  // Reset prompt flag when user switches to correct network
  useEffect(() => {
    if (isCorrectNetwork) {
      setHasPromptedSwitch(false)
    }
  }, [isCorrectNetwork])

  /**
   * Ensure user is on correct network before performing blockchain operations
   * Returns true if on correct network or successfully switched
   */
  const ensureCorrectNetwork = async (): Promise<boolean> => {
    if (!authenticated || !user?.wallet) {
      toast.error('Please connect your wallet first')
      return false
    }

    if (isCorrectNetwork) {
      return true
    }

    toast.loading('Switching to Monad testnet...', { id: 'network-ensure' })
    
    const success = await switchToMonad()
    
    if (success) {
      toast.success('Switched to Monad testnet', { id: 'network-ensure' })
      return true
    } else {
      toast.error('Failed to switch network. Please manually switch to Monad testnet', { id: 'network-ensure' })
      return false
    }
  }

  return {
    isCorrectNetwork,
    currentChain,
    requiredChainId,
    isCheckingNetwork: isCheckingNetwork || isSwitching,
    switchToMonad,
    checkAndSwitchNetwork,
    ensureCorrectNetwork
  }
} 