import { usePrivy, useWallets } from '@privy-io/react-auth'
import { ethers } from 'ethers'

/**
 * Hook to get the correct wallet provider for transactions
 * This ensures transactions go to the correct wallet (Phantom, MetaMask, etc.)
 */
export function useWalletProvider() {
  const { user } = usePrivy()
  const { wallets } = useWallets()

  /**
   * Get the current wallet's provider
   */
  const getCurrentWalletProvider = () => {
    // Get the user's active wallet from Privy
    const activeWallet = wallets.find(w => w.address === user?.wallet?.address)
    
    if (!activeWallet) {
      console.error('No active wallet found for provider')
      console.log('Available wallets:', wallets)
      console.log('User wallet address:', user?.wallet?.address)
      return null
    }

    console.log('Getting provider for wallet:', {
      type: activeWallet.walletClientType,
      address: activeWallet.address
    })

    let provider = null

    // For external wallets, use their specific provider
    if (activeWallet.walletClientType === 'metamask') {
      provider = window.ethereum
      console.log('Using MetaMask provider for transactions')
    } else if (activeWallet.walletClientType === 'phantom') {
      provider = (window as any).phantom?.ethereum
      console.log('Using Phantom provider for transactions')
    } else if (activeWallet.walletClientType === 'coinbase_wallet') {
      provider = (window as any).coinbaseWalletExtension || window.ethereum
      console.log('Using Coinbase Wallet provider for transactions')
    } else if (activeWallet.walletClientType === 'wallet_connect') {
      // For WalletConnect, use the generic ethereum provider
      provider = window.ethereum
      console.log('Using WalletConnect provider for transactions')
    } else {
      // For embedded wallets or unknown types, try window.ethereum as fallback
      provider = window.ethereum
      console.log('Using fallback provider for wallet type:', activeWallet.walletClientType)
    }

    if (!provider) {
      console.error('No provider found for wallet type:', activeWallet.walletClientType)
      throw new Error(`Provider not available for ${activeWallet.walletClientType}`)
    }

    return provider
  }

  /**
   * Get an ethers provider and signer for the current wallet
   */
  const getProviderAndSigner = async () => {
    const provider = getCurrentWalletProvider()
    
    if (!provider) {
      throw new Error('No wallet provider available')
    }

    try {
      const ethersProvider = new ethers.BrowserProvider(provider)
      const signer = await ethersProvider.getSigner()
      
      console.log('Provider and signer ready for wallet:', await signer.getAddress())
      
      return { provider: ethersProvider, signer }
    } catch (error) {
      console.error('Failed to get provider and signer:', error)
      throw new Error('Failed to connect to wallet for transactions')
    }
  }

  /**
   * Request wallet to add a network
   */
  const requestAddChain = async (chainParams: any) => {
    const provider = getCurrentWalletProvider()
    
    if (!provider) {
      throw new Error('No wallet provider available')
    }

    return await (provider as any).request({
      method: 'wallet_addEthereumChain',
      params: [chainParams]
    })
  }

  /**
   * Request wallet to switch chains
   */
  const requestSwitchChain = async (chainId: string) => {
    const provider = getCurrentWalletProvider()
    
    if (!provider) {
      throw new Error('No wallet provider available')
    }

    return await (provider as any).request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }]
    })
  }

  return {
    getCurrentWalletProvider,
    getProviderAndSigner,
    requestAddChain,
    requestSwitchChain
  }
} 