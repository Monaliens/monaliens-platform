import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Clock, Users, Trophy, Ticket } from 'lucide-react'
import { Raffle } from '@/types'
import { getBlockchainConfig } from '@/utils/deployments'
import { PlatformFeeCompact } from './PlatformFeeDisplay'
import { TokenDisplay } from './TokenSelector'

interface RaffleCardProps {
  raffle: Raffle
  showActions?: boolean
  compact?: boolean
  className?: string
}

export default function RaffleCard({ 
  raffle, 
  showActions = true, 
  compact = false,
  className = '' 
}: RaffleCardProps) {
  const isEnded = new Date() > new Date(raffle.endTime)
  const hasWinner = raffle.winner && raffle.winner !== '0x0000000000000000000000000000000000000000'
  
  // Get native token symbol from config
  const blockchainConfig = getBlockchainConfig()
  const nativeTokenSymbol = blockchainConfig.symbol
  
  const getStatusColor = () => {
    if (raffle.status === 'REFUNDED') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    if (hasWinner) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    if (isEnded) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
  }

  const getStatusText = () => {
    if (raffle.status === 'REFUNDED') return 'Refunded'
    if (hasWinner) return 'Winner Drawn'
    if (isEnded) return 'Ended'
    return 'Active'
  }

  const formatTimeRemaining = () => {
    const now = new Date()
    const end = new Date(raffle.endTime)
    const diff = end.getTime() - now.getTime()
    
    if (diff <= 0) return 'Ended'
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const formatPrizeAmount = () => {
    if (raffle.prizeType === 'NFT') {
      return `NFT #${raffle.prizeTokenId}`
    }
    
    const amount = parseFloat(raffle.prizeAmount || '0') / Math.pow(10, 18)
    
    // Determine prize token symbol
    let prizeTokenSymbol = 'Tokens'
    
    // If prize contract address is zero address (native token), use native symbol
    if (raffle.prizeContractAddress === '0x0000000000000000000000000000000000000000') {
      prizeTokenSymbol = nativeTokenSymbol
    } else {
      // For ERC20 tokens, we'd need the prize token symbol from backend
      // For now, check if it's same as ticket token address
      if (raffle.prizeContractAddress.toLowerCase() === raffle.ticketTokenAddress.toLowerCase()) {
        prizeTokenSymbol = raffle.ticketTokenSymbol || nativeTokenSymbol
      } else {
        // Different token, use generic name for now
        prizeTokenSymbol = 'Tokens'
      }
    }
    
    return `${amount.toFixed(2)} ${prizeTokenSymbol}`
  }

  const formatTicketPrice = () => {
    const price = parseFloat(raffle.ticketPrice) / Math.pow(10, 18)
    return `${price} ${raffle.ticketTokenSymbol || nativeTokenSymbol}`
  }

  if (compact) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
              <PlatformFeeCompact feePercentage={raffle.platformFeePercentage} />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {raffle.prizeType} Raffle #{raffle.raffleId}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Prize: {formatPrizeAmount()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {formatTicketPrice()}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              per ticket
            </p>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 ${className}`}
    >
      {/* Header */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
              <PlatformFeeCompact feePercentage={raffle.platformFeePercentage} />
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              {raffle.prizeType} Raffle #{raffle.raffleId}
            </h3>
            
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <span className="truncate">by {raffle.owner.slice(0, 6)}...{raffle.owner.slice(-4)}</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {raffle.prizeType === 'NFT' ? '🖼️' : '💰'}
            </div>
          </div>
        </div>

        {/* Prize Info */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Prize
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {formatPrizeAmount()}
              </p>
            </div>
            <Trophy className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center justify-center text-blue-500 mb-1">
              <Ticket className="w-4 h-4 mr-1" />
              <span className="text-sm font-medium">Price</span>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {formatTicketPrice()}
            </p>
          </div>

          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center justify-center text-green-500 mb-1">
              <Users className="w-4 h-4 mr-1" />
              <span className="text-sm font-medium">Sold</span>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {raffle.totalTicketsSold}
            </p>
          </div>
        </div>

        {/* Time Remaining */}
        <div className={`flex items-center justify-center p-3 rounded-lg mb-4 ${
          raffle.status === 'REFUNDED' 
            ? 'bg-amber-50 dark:bg-amber-900/20' 
            : 'bg-orange-50 dark:bg-orange-900/20'
        }`}>
          <Clock className={`w-4 h-4 mr-2 ${
            raffle.status === 'REFUNDED' ? 'text-amber-500' : 'text-orange-500'
          }`} />
          <span className={`text-sm font-medium ${
            raffle.status === 'REFUNDED' 
              ? 'text-amber-700 dark:text-amber-300' 
              : 'text-orange-700 dark:text-orange-300'
          }`}>
            {raffle.status === 'REFUNDED' 
              ? 'Prize Refunded' 
              : isEnded 
              ? 'Ended' 
              : `${formatTimeRemaining()} remaining`
            }
          </span>
        </div>

        {/* Payment Token */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">Payment Token:</span>
          <TokenDisplay 
            tokenSymbol={raffle.ticketTokenSymbol || nativeTokenSymbol} 
            className="text-sm"
          />
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
          <div className="flex space-x-3">
            <Link 
              href={`/raffles/${raffle.raffleId}`}
              className="flex-1 btn-outline text-center py-2 text-sm"
            >
              View Details
            </Link>
            
            {!isEnded && !hasWinner && raffle.status !== 'REFUNDED' && (
              <Link 
                href={`/raffles/${raffle.raffleId}/buy`}
                className="flex-1 btn-primary text-center py-2 text-sm"
              >
                Buy Tickets
              </Link>
            )}
            
            {hasWinner && (
              <div className="flex-1 text-center py-2 text-sm font-medium text-green-600 dark:text-green-400">
                🏆 Winner: {raffle.winner?.slice(0, 6)}...{raffle.winner?.slice(-4)}
              </div>
            )}

            {raffle.status === 'REFUNDED' && (
              <div className="flex-1 text-center py-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                💸 Prize refunded to creator
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// Loading skeleton for raffle cards
export function RaffleCardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24 mb-2"></div>
            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
          </div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-20 mb-2"></div>
            <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-40 mb-2"></div>
            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
          </div>
          <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
        </div>

        <div className="h-20 bg-gray-300 dark:bg-gray-600 rounded-lg mb-4"></div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="h-16 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
          <div className="h-16 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
        </div>

        <div className="h-12 bg-gray-300 dark:bg-gray-600 rounded-lg mb-4"></div>
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
      </div>

      <div className="px-6 py-4 bg-gray-100 dark:bg-gray-700">
        <div className="flex space-x-3">
          <div className="flex-1 h-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
          <div className="flex-1 h-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
        </div>
      </div>
    </div>
  )
}