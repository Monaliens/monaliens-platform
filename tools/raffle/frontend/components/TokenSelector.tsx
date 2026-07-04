import React, { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { usePrivy } from '@privy-io/react-auth'
import { Search, RefreshCw, Plus, Wallet, AlertCircle, Check } from 'lucide-react'
import { getBlockchainConfig } from '@/utils/deployments'

interface ApiToken {
  contractAddress: string
  name: string
  symbol: string
  decimals: number
  balance: string
  balanceFormatted: string
  logo: string | null
  isNative: boolean
  portfolioPercentage: string
}

interface ApiResponse {
  success: boolean
  data: {
    address: string
    tokens: ApiToken[]
    summary: {
      totalTokenTypes: number
      totalBalance: string
      includesNative: boolean
      nativeBalance: string
      erc20Count: number
    }
    meta: {
      fetchedAt: string
      sortBy: string
      sortDirection: string
      includeZeroBalances: boolean
      requestedAt: string
    }
  }
}

interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  balance?: string
  balanceFormatted?: string
  logo?: string | null
  isNative?: boolean
}

interface TokenSelectorProps {
  value: string
  onChange: (tokenAddress: string, tokenData: Token) => void
  className?: string
  placeholder?: string
  allowCustom?: boolean
  chainId?: number
  showBalance?: boolean
}

// Common fallback tokens on Monad Testnet
const FALLBACK_TOKENS: Token[] = [
  {
    address: 'native',
    symbol: 'MON',
    name: 'Monad',
    decimals: 18,
    isNative: true
  },
  {
    address: '0x45CFc625D98a42a223c5C054a4007B76C77216bb',
    symbol: 'MON',
    name: 'Monad Token',
    decimals: 18,
    isNative: false
  }
]

export default function TokenSelector({
  value,
  onChange,
  className = '',
  placeholder = 'Select a token...',
  allowCustom = true,
  chainId = 10143,
  showBalance = true
}: TokenSelectorProps) {
  const { user, authenticated } = usePrivy()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [userTokens, setUserTokens] = useState<Token[]>([])
  const [customToken, setCustomToken] = useState('')
  const [customTokenData, setCustomTokenData] = useState<Token | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingCustom, setLoadingCustom] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch user's tokens from Monaliens API
  const fetchUserTokens = useCallback(async (userAddress: string) => {
    if (!userAddress) return

    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(
        `https://api.monaliens.xyz/api/tokens/${userAddress}`
      )
      
      if (!response.ok) {
        throw new Error('Failed to fetch tokens')
      }
      
      const data: ApiResponse = await response.json()
      
      if (data.success && data.data.tokens) {
        const tokens: Token[] = data.data.tokens.map(token => ({
          address: token.contractAddress,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          balance: token.balance,
          balanceFormatted: token.balanceFormatted,
          logo: token.logo,
          isNative: token.isNative
        }))
        
        setUserTokens(tokens)
        console.log(`Loaded ${tokens.length} tokens for user:`, tokens)
      } else {
        // Fallback to common tokens if API fails
        setUserTokens(FALLBACK_TOKENS)
      }
    } catch (error) {
      console.error('Error fetching user tokens:', error)
      // Use fallback tokens on error
      setUserTokens(FALLBACK_TOKENS)
      setError('Failed to load wallet tokens, showing common tokens')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load user tokens when wallet is connected
  useEffect(() => {
    if (authenticated && user?.wallet?.address) {
      fetchUserTokens(user.wallet.address)
    } else {
      // Show fallback tokens when not connected
      setUserTokens(FALLBACK_TOKENS)
    }
  }, [authenticated, user?.wallet?.address])

  // Set selected token when value changes
  useEffect(() => {
    if (value) {
      const foundToken = userTokens.find(token => 
        token.address.toLowerCase() === value.toLowerCase()
      )
      
      if (foundToken) {
        setSelectedToken(foundToken)
      } else if (customTokenData && customTokenData.address.toLowerCase() === value.toLowerCase()) {
        setSelectedToken(customTokenData)
      } else {
        // Try to fetch custom token data
        fetchCustomTokenData(value)
      }
    } else {
      setSelectedToken(null)
    }
  }, [value, userTokens, customTokenData])

  // Fetch custom token data
  const fetchCustomTokenData = async (tokenAddress: string) => {
    if (!ethers.isAddress(tokenAddress)) {
      setError('Invalid token address')
      return
    }

    setLoadingCustom(true)
    setError(null)

    try {
      // First try to get token info from API
      if (user?.wallet?.address) {
        try {
          const response = await fetch(
            `https://api.monaliens.xyz/api/tokens/${user.wallet.address}`
          )
          
          if (response.ok) {
            const data: ApiResponse = await response.json()
            const foundToken = data.data.tokens.find(
              token => token.contractAddress.toLowerCase() === tokenAddress.toLowerCase()
            )
            
            if (foundToken) {
              const customToken: Token = {
                address: foundToken.contractAddress,
                symbol: foundToken.symbol,
                name: foundToken.name,
                decimals: foundToken.decimals,
                balance: foundToken.balance,
                balanceFormatted: foundToken.balanceFormatted,
                logo: foundToken.logo,
                isNative: foundToken.isNative
              }
              setCustomTokenData(customToken)
              return
            }
          }
        } catch (err) {
          console.warn('Failed to fetch from API, falling back to contract call')
        }
      }

      // Fallback: Try to get basic token info from contract
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum as any)
        const tokenContract = new ethers.Contract(
          tokenAddress,
          [
            'function symbol() view returns (string)',
            'function name() view returns (string)',
            'function decimals() view returns (uint8)',
          ],
          provider
        )

        const [symbol, name, decimals] = await Promise.all([
          tokenContract.symbol().catch(() => 'UNKNOWN'),
          tokenContract.name().catch(() => 'Unknown Token'),
          tokenContract.decimals().catch(() => 18)
        ])

        const customToken: Token = {
          address: tokenAddress,
          symbol,
          name,
          decimals: Number(decimals)
        }

        setCustomTokenData(customToken)
      } else {
        // Create basic token info without contract call
        const customToken: Token = {
          address: tokenAddress,
          symbol: 'CUSTOM',
          name: 'Custom Token',
          decimals: 18
        }
        setCustomTokenData(customToken)
      }
    } catch (err) {
      setError('Failed to fetch token data')
      console.error('Error fetching custom token data:', err)
    } finally {
      setLoadingCustom(false)
    }
  }

  const handleTokenSelect = (token: Token) => {
    setSelectedToken(token)
    onChange(token.address, token)
    setIsOpen(false)
    setError(null)
    setSearchQuery('')
  }

  const handleCustomTokenSubmit = () => {
    if (!customToken.trim()) return
    fetchCustomTokenData(customToken.trim())
  }

  const handleRefresh = () => {
    if (authenticated && user?.wallet?.address) {
      fetchUserTokens(user.wallet.address)
    }
  }

  // Filter tokens based on search query
  const filteredTokens = userTokens.filter(token =>
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.address.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getTokenIcon = (token: Token) => {
    if (token.logo) {
      return (
        <img
          src={token.logo}
          alt={token.symbol}
          className="w-6 h-6 rounded-full"
          onError={(e) => {
            // Fallback to gradient icon if image fails
            e.currentTarget.style.display = 'none'
            e.currentTarget.nextElementSibling?.classList.remove('hidden')
          }}
        />
      )
    }
    
    return (
      <div className="w-6 h-6 bg-gradient-to-r from-blue-400 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
        {token.symbol.charAt(0)}
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {selectedToken ? (
              <>
                <div className="flex items-center mr-3">
                  {getTokenIcon(selectedToken)}
                  <div className="hidden" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {selectedToken.symbol}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                    {selectedToken.name}
                    {showBalance && selectedToken.balanceFormatted && (
                      <span className="ml-2 text-green-600 dark:text-green-400 font-medium">
                        {selectedToken.balanceFormatted}
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">{placeholder}</span>
            )}
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-96 overflow-hidden">
          {/* Header with search and refresh */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-600">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tokens..."
                  className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-64">
            {/* Wallet info */}
            {authenticated && user?.wallet?.address && (
              <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-600">
                <div className="flex items-center text-xs text-blue-600 dark:text-blue-400">
                  <Wallet className="w-3 h-3 mr-1" />
                  <span className="font-mono">{user.wallet.address.slice(0, 6)}...{user.wallet.address.slice(-4)}</span>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border-b border-gray-200 dark:border-gray-600">
                <div className="flex items-center text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {error}
                </div>
              </div>
            )}

            {/* Loading state */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-500 mr-2" />
                <span className="text-gray-600 dark:text-gray-400">Loading tokens...</span>
              </div>
            ) : (
              <>
                {/* Wallet Tokens */}
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-700/50">
                  {authenticated ? 'Your Tokens' : 'Common Tokens'} ({filteredTokens.length})
                </div>
                
                {filteredTokens.length === 0 ? (
                  <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                    {searchQuery ? 'No tokens found matching your search' : 'No tokens found'}
                  </div>
                ) : (
                  filteredTokens.map((token) => (
                    <button
                      key={token.address}
                      onClick={() => handleTokenSelect(token)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between group transition-colors"
                    >
                      <div className="flex items-center">
                        <div className="mr-3">
                          {getTokenIcon(token)}
                          <div className="hidden" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center">
                            {token.symbol}
                            {token.isNative && (
                              <span className="ml-1 px-1 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded">
                                Native
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {token.name}
                          </div>
                        </div>
                      </div>
                      
                      {showBalance && token.balanceFormatted && (
                        <div className="text-right">
                          <div className="text-sm font-medium text-green-600 dark:text-green-400">
                            {token.balanceFormatted}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {token.symbol}
                          </div>
                        </div>
                      )}
                    </button>
                  ))
                )}
              </>
            )}

            {/* Custom Token Section */}
            {allowCustom && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-600"></div>
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-700/50">
                  Add Custom Token
                </div>
                <div className="px-4 py-3">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={customToken}
                      onChange={(e) => setCustomToken(e.target.value)}
                      placeholder="0x... token contract address"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                    <button
                      onClick={handleCustomTokenSubmit}
                      disabled={loadingCustom || !customToken.trim()}
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {loadingCustom ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  
                  {customTokenData && (
                    <button
                      onClick={() => handleTokenSelect(customTokenData)}
                      className="w-full mt-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center rounded border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20"
                    >
                      <div className="mr-3">
                        {getTokenIcon(customTokenData)}
                        <div className="hidden" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center">
                          {customTokenData.symbol}
                          <Check className="w-4 h-4 ml-1 text-green-600" />
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {customTokenData.name}
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Simple token display component
export function TokenDisplay({ 
  tokenSymbol, 
  tokenName, 
  className = '' 
}: { 
  tokenSymbol: string
  tokenName?: string
  className?: string 
}) {
  return (
    <div className={`inline-flex items-center ${className}`}>
      <div className="w-5 h-5 bg-gradient-to-r from-blue-400 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2">
        {tokenSymbol.charAt(0)}
      </div>
      <span className="text-sm font-medium">{tokenSymbol}</span>
      {tokenName && (
        <span className="text-xs text-gray-500 ml-1">({tokenName})</span>
      )}
    </div>
  )
}