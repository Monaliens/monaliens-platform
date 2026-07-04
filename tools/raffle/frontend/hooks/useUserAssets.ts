import { useState, useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import { ERC20_ABI } from '@/utils/contracts'

export interface UserNFT {
  tokenId: string
  contractAddress: string
  name?: string
  image?: string
  collection?: {
    name: string
    contractAddress: string
  }
  attributes?: any[]
}

export interface UserToken {
  contractAddress: string
  name: string
  symbol: string
  decimals: number
  balance: string
  balanceFormatted: string
}

const MONAD_CHAIN_NAME = 'monad-testnet'
const API_BASE_URL = process.env.API_URL || 'https://your-api-url'

export function useUserAssets() {
  const { user, authenticated } = usePrivy()
  const [userNFTs, setUserNFTs] = useState<UserNFT[]>([])
  const [userTokens, setUserTokens] = useState<UserToken[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userAddress = user?.wallet?.address

  // Fetch user's NFTs from Magic Eden API
  const fetchUserNFTs = async (userAddress: string) => {
    try {
      const url = `${API_BASE_URL}/api/magic-eden/${MONAD_CHAIN_NAME}/users/${userAddress}/tokens?limit=200`
      console.log(' Fetching NFTs from:', url)
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        }
      })

      console.log(' NFT API Response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(' NFT API Error:', errorText)
        throw new Error(`Failed to fetch NFTs: ${response.statusText}`)
      }

      const data = await response.json()
      console.log(' NFT API Response:', data)
      
      // Transform API response to our NFT format
      const nfts: UserNFT[] = (data.data?.tokens || []).map((item: any) => ({
        tokenId: item.token?.tokenId,
        contractAddress: item.token?.contract,
        name: item.token?.name || `#${item.token?.tokenId}`,
        image: item.token?.image || item.token?.imageSmall,
        collection: {
          name: item.token?.collection?.name || 'Unknown Collection',
          contractAddress: item.token?.contract
        },
        attributes: item.token?.attributes || []
      }))

      return nfts
    } catch (error) {
      console.error('Error fetching user NFTs:', error)
      throw error
    }
  }

  // Fetch user's tokens from RPC
  const fetchUserTokens = async (userAddress: string) => {
    try {
      console.log(' Fetching tokens for:', userAddress)
      // Get provider
      const provider = new ethers.JsonRpcProvider('https://monad-testnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY')

      // Common token addresses on Monad Testnet
      const commonTokens = [
        {
          address: '0x23F6E092Ab996978E4a5E5cDFBA51476a6e9D945', // MON Token
          name: 'MON Token',
          symbol: 'MON'
        },
        // Add more known tokens here
      ]

      const tokens: UserToken[] = []

      console.log(' Checking native balance...')
      // Check native MON balance
      const nativeBalance = await provider.getBalance(userAddress)
      console.log(' Native balance:', ethers.formatEther(nativeBalance))
      
      // Always add native MON (even if balance is 0 for testing)
      tokens.push({
        contractAddress: '0x0000000000000000000000000000000000000000', // Native token
        name: 'MON',
        symbol: 'MON',
        decimals: 18,
        balance: nativeBalance.toString(),
        balanceFormatted: ethers.formatEther(nativeBalance)
      })

      // Check ERC20 token balances
      for (const tokenInfo of commonTokens) {
        try {
          const tokenContract = new ethers.Contract(tokenInfo.address, ERC20_ABI, provider)
          
          const [balance, decimals, symbol] = await Promise.all([
            tokenContract.balanceOf(userAddress),
            tokenContract.decimals(),
            tokenContract.symbol()
          ])

          if (balance > BigInt(0)) {
            tokens.push({
              contractAddress: tokenInfo.address,
              name: tokenInfo.name,
              symbol: symbol,
              decimals: Number(decimals),
              balance: balance.toString(),
              balanceFormatted: ethers.formatUnits(balance, decimals)
            })
          }
        } catch (error) {
          console.warn(`Failed to fetch token ${tokenInfo.symbol}:`, error)
        }
      }

      return tokens
    } catch (error) {
      console.error('Error fetching user tokens:', error)
      throw error
    }
  }

  // Fetch user's NFTs from a specific collection
  const fetchUserNFTsFromCollection = async (userAddress: string, collectionAddress: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/magic-eden/${MONAD_CHAIN_NAME}/users/${userAddress}/tokens/${collectionAddress}?limit=200&includeAttributes=true`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch collection NFTs: ${response.statusText}`)
      }

      const data = await response.json()
      
      const nfts: UserNFT[] = (data.tokens || []).map((token: any) => ({
        tokenId: token.tokenId || token.token?.tokenId,
        contractAddress: collectionAddress,
        name: token.token?.name || `#${token.tokenId}`,
        image: token.token?.image || token.token?.imageSmall,
        collection: {
          name: token.token?.collection?.name || 'Unknown Collection',
          contractAddress: collectionAddress
        },
        attributes: token.token?.attributes || []
      }))

      return nfts
    } catch (error) {
      console.error('Error fetching collection NFTs:', error)
      throw error
    }
  }

  // Load user assets
  const loadUserAssets = async () => {
    if (!userAddress || !authenticated) {
      console.log(' No user address or not authenticated:', { userAddress, authenticated })
      setUserNFTs([])
      setUserTokens([])
      return
    }

    console.log(' Loading assets for user:', userAddress)
    setLoading(true)
    setError(null)

    try {
      console.log(' Fetching NFTs and tokens...')
      const [nfts, tokens] = await Promise.all([
        fetchUserNFTs(userAddress).catch(err => {
          console.error('NFT fetch failed:', err)
          return []
        }),
        fetchUserTokens(userAddress).catch(err => {
          console.error('Token fetch failed:', err)
          return []
        })
      ])

      console.log(' Assets loaded:', { nfts: nfts.length, tokens: tokens.length })
      setUserNFTs(nfts)
      setUserTokens(tokens)
    } catch (error) {
      console.error('Error loading user assets:', error)
      setError(error instanceof Error ? error.message : 'Failed to load assets')
    } finally {
      setLoading(false)
    }
  }

  // Auto-load when user connects
  useEffect(() => {
    loadUserAssets()
  }, [userAddress, authenticated])

  return {
    userNFTs,
    userTokens,
    loading,
    error,
    refetch: loadUserAssets,
    fetchUserNFTsFromCollection
  }
}