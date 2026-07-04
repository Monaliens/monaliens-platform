import { useState } from 'react'
import { ChevronDown, Search, Coins } from 'lucide-react'
import { UserToken } from '@/hooks/useUserAssets'

interface UserTokenSelectorProps {
  userTokens: UserToken[]
  selectedToken: UserToken | null
  onSelect: (token: UserToken) => void
  loading?: boolean
  placeholder?: string
  disabled?: boolean
  showBalance?: boolean
}

export default function UserTokenSelector({
  userTokens,
  selectedToken,
  onSelect,
  loading = false,
  placeholder = "Select a token...",
  disabled = false,
  showBalance = true
}: UserTokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredTokens = userTokens.filter(token => 
    token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.contractAddress.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelect = (token: UserToken) => {
    onSelect(token)
    setIsOpen(false)
    setSearchTerm('')
  }

  const formatBalance = (token: UserToken) => {
    const balance = parseFloat(token.balanceFormatted)
    if (balance < 0.0001) {
      return '< 0.0001'
    }
    return balance.toFixed(4)
  }

  if (loading) {
    return (
      <div className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400">
        Loading tokens...
      </div>
    )
  }

  if (userTokens.length === 0) {
    return (
      <div className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400">
        No tokens found in your wallet
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400 dark:hover:border-gray-500'
        }`}
      >
        <div className="flex items-center space-x-3">
          {selectedToken ? (
            <>
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <Coins className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-gray-900 dark:text-gray-100 font-medium">
                  {selectedToken.symbol}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedToken.name}
                </p>
              </div>
              {showBalance && (
                <div className="ml-auto text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatBalance(selectedToken)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Balance
                  </p>
                </div>
              )}
            </>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-96 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tokens..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Token List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredTokens.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                No tokens match your search
              </div>
            ) : (
              filteredTokens.map((token) => (
                <button
                  key={token.contractAddress}
                  onClick={() => handleSelect(token)}
                  className="w-full p-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-3 text-left transition-colors"
                >
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <Coins className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-900 dark:text-gray-100 font-medium">
                          {token.symbol}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {token.name}
                        </p>
                      </div>
                      {showBalance && (
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {formatBalance(token)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Balance
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                      {token.contractAddress === '0x0000000000000000000000000000000000000000' 
                        ? 'Native Token' 
                        : `${token.contractAddress.slice(0, 6)}...${token.contractAddress.slice(-4)}`
                      }
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}