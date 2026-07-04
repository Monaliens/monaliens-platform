import { useState, useEffect } from 'react'
import { ChevronDown, Search, Image as ImageIcon } from 'lucide-react'
import { UserNFT } from '@/hooks/useUserAssets'

interface NFTSelectorProps {
  userNFTs: UserNFT[]
  selectedNFT: UserNFT | null
  onSelect: (nft: UserNFT) => void
  loading?: boolean
  placeholder?: string
  disabled?: boolean
}

export default function NFTSelector({
  userNFTs,
  selectedNFT,
  onSelect,
  loading = false,
  placeholder = "Select an NFT...",
  disabled = false
}: NFTSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredNFTs = userNFTs.filter(nft => 
    nft.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    nft.collection?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    nft.tokenId.includes(searchTerm)
  )

  const handleSelect = (nft: UserNFT) => {
    onSelect(nft)
    setIsOpen(false)
    setSearchTerm('')
  }

  if (loading) {
    return (
      <div className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400">
        Loading NFTs...
      </div>
    )
  }

  if (userNFTs.length === 0) {
    return (
      <div className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400">
        No NFTs found in your wallet
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
          {selectedNFT ? (
            <>
              {selectedNFT.image ? (
                <img 
                  src={selectedNFT.image} 
                  alt={selectedNFT.name}
                  className="w-8 h-8 rounded object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                  }}
                />
              ) : (
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-gray-400" />
                </div>
              )}
              <div>
                <p className="text-gray-900 dark:text-gray-100 font-medium">
                  {selectedNFT.name} #{selectedNFT.tokenId}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedNFT.collection?.name}
                </p>
              </div>
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
                placeholder="Search NFTs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* NFT List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredNFTs.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                No NFTs match your search
              </div>
            ) : (
              filteredNFTs.map((nft) => (
                <button
                  key={`${nft.contractAddress}-${nft.tokenId}`}
                  onClick={() => handleSelect(nft)}
                  className="w-full p-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-3 text-left transition-colors"
                >
                  {nft.image ? (
                    <img 
                      src={nft.image} 
                      alt={nft.name}
                      className="w-10 h-10 rounded object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 dark:text-gray-100 font-medium truncate">
                      {nft.name} #{nft.tokenId}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {nft.collection?.name}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                      {nft.contractAddress.slice(0, 6)}...{nft.contractAddress.slice(-4)}
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