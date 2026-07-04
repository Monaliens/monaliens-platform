import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { 
  ArrowLeft, 
  Clock, 
  Users, 
  Trophy, 
  Ticket, 
  ExternalLink,
  Award,
  TrendingUp,
  Shield,
  Crown,
  Gift,
  DollarSign,
  RefreshCcw
} from 'lucide-react'
import { usePrivy } from '@privy-io/react-auth'
import { Raffle, Ticket as TicketType } from '@/types'
import PlatformFeeDisplay from '@/components/PlatformFeeDisplay'
import { TokenDisplay } from '@/components/TokenSelector'
import { useTicketPurchase } from '@/hooks/useTicketPurchase'
import { getApiUrl, getExplorerUrl, getExplorerName } from '../../utils/deployments'

interface Participant {
  address: string
  totalTickets: number
  totalSpent: number
  purchaseCount: number
  firstPurchase: string
  lastPurchase: string
  isWinning: boolean
  winChance: number
  winChanceFormatted: string
}

export default function RaffleDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const [raffle, setRaffle] = useState<Raffle | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [participantsLoading, setParticipantsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showBuyModal, setShowBuyModal] = useState(false)
  const [buyAmount, setBuyAmount] = useState(1)
  const [actionLoading, setActionLoading] = useState(false)
  const { user, authenticated, login } = usePrivy()
  const { buyTickets, loading: purchaseLoading } = useTicketPurchase()
  const isConnected = authenticated && user?.wallet
  const userAddress = user?.wallet?.address

  useEffect(() => {
    if (id) {
      fetchRaffleDetails()
    }
  }, [id])

  const fetchRaffleDetails = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${getApiUrl()}/api/raffles/${id}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Raffle not found')
        } else {
          setError('Failed to fetch raffle details')
        }
        return
      }

      const data = await response.json()
      if (data.success) {
        setRaffle(data.data)
        // Fetch participants if raffle is visible
        if (data.data.participantsVisible) {
          fetchParticipants() 
        }
      } else {
        setError(data.message || 'Failed to fetch raffle details')
      }
    } catch (err) {
      console.error('Error fetching raffle:', err)
      setError('Failed to fetch raffle details')
    } finally {
      setLoading(false)
    }
  }

  const fetchParticipants = async () => {
    if (!id) return
    
    setParticipantsLoading(true)
    try {
      const response = await fetch(`${getApiUrl()}/api/raffles/${id}/participants`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setParticipants(data.data.participants)
        }
      }
    } catch (err) {
      console.error('Error fetching participants:', err)
    } finally {
      setParticipantsLoading(false)
    }
  }

  const handleDrawWinner = async () => {
    if (!raffle || !isConnected) return
    
    setActionLoading(true)
    try {
      // Import ethers dynamically
      const { ethers } = await import('ethers')
      
      // Get provider from window.ethereum
      if (!window.ethereum) {
        throw new Error('Please install MetaMask')
      }

      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const signer = await provider.getSigner()
      
      // Simple raffle ABI for drawWinner function
      const raffleABI = [
        'function drawWinner() external',
        'function getRaffleInfo() view returns (tuple(address owner, uint8 prizeType, address prizeContractAddress, uint256 prizeTokenId, uint256 prizeAmount, bool prizeInEscrow, uint256 ticketPrice, address ticketTokenAddress, uint256 maxTicketsPerWallet, uint256 endTime, address winner, uint8 status, bool participantsVisible, bool participantCountVisible, uint256 totalTicketsSold, uint256 platformFeePercentage, address platformFeeWallet))'
      ]
      
      const raffleContract = new ethers.Contract(raffle.contractAddress, raffleABI, signer)
      
      const tx = await raffleContract.drawWinner()
      console.log('Draw winner transaction sent:', tx.hash)
      
      // Wait for confirmation
      await tx.wait()
      
      toast.success(`Winner drawn successfully! Transaction: ${tx.hash}`)
      
      // Refresh raffle data
      setTimeout(() => {
        fetchRaffleDetails()
      }, 2000)
      
    } catch (err) {
      console.error('Draw winner error:', err)
      toast.error(`Error drawing winner: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleClaimPrize = async () => {
    if (!raffle || !isConnected) return
    
    setActionLoading(true)
    try {
      // Import ethers dynamically
      const { ethers } = await import('ethers')
      
      // Get provider from window.ethereum
      if (!window.ethereum) {
        throw new Error('Please install MetaMask')
      }

      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const signer = await provider.getSigner()
      
      // Simple raffle ABI for claimPrize function
      const raffleABI = [
        'function claimPrize() external'
      ]
      
      const raffleContract = new ethers.Contract(raffle.contractAddress, raffleABI, signer)
      
      const tx = await raffleContract.claimPrize()
      console.log('Claim prize transaction sent:', tx.hash)
      
      // Wait for confirmation
      await tx.wait()
      
      toast.success(`Prize claimed successfully! Transaction: ${tx.hash}`)
      
      // Refresh raffle data
      setTimeout(() => {
        fetchRaffleDetails()
      }, 2000)
      
    } catch (err) {
      console.error('Claim prize error:', err)
      toast.error(`Error claiming prize: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleWithdrawFees = async () => {
    if (!raffle || !isConnected) return
    
    setActionLoading(true)
    try {
      // Import ethers dynamically
      const { ethers } = await import('ethers')
      
      // Get provider from window.ethereum
      if (!window.ethereum) {
        throw new Error('Please install MetaMask')
      }

      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const signer = await provider.getSigner()
      
      // Simple raffle ABI for withdrawFees function
      const raffleABI = [
        'function withdrawFees() external'
      ]
      
      const raffleContract = new ethers.Contract(raffle.contractAddress, raffleABI, signer)
      
      const tx = await raffleContract.withdrawFees()
      console.log('Withdraw fees transaction sent:', tx.hash)
      
      // Wait for confirmation
      await tx.wait()
      
      toast.success(`Fees withdrawn successfully! Transaction: ${tx.hash}`)
      
      // Refresh raffle data
      setTimeout(() => {
        fetchRaffleDetails()
      }, 2000)
      
    } catch (err) {
      console.error('Withdraw fees error:', err)
      toast.error(`Error withdrawing fees: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRefundPrize = async () => {
    if (!raffle || !isConnected) return
    
    setActionLoading(true)
    try {
      // Import ethers dynamically
      const { ethers } = await import('ethers')
      
      // Get provider from window.ethereum
      if (!window.ethereum) {
        throw new Error('Please install MetaMask')
      }

      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const signer = await provider.getSigner()
      
      // Simple raffle ABI for refundPrizeToCreator function
      const raffleABI = [
        'function refundPrizeToCreator() external'
      ]
      
      const raffleContract = new ethers.Contract(raffle.contractAddress, raffleABI, signer)
      
      const tx = await raffleContract.refundPrizeToCreator()
      console.log('Refund prize transaction sent:', tx.hash)
      
      // Wait for confirmation
      await tx.wait()
      
      toast.success(`Prize refunded successfully! Transaction: ${tx.hash}`)
      
      // Refresh raffle data
      setTimeout(() => {
        fetchRaffleDetails()
      }, 2000)
      
    } catch (err) {
      console.error('Refund prize error:', err)
      toast.error(`Error refunding prize: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setActionLoading(false)
    }
  }

  const formatTimeRemaining = () => {
    if (!raffle) return ''
    
    const now = new Date()
    const end = new Date(raffle.endTime)
    const diff = end.getTime() - now.getTime()
    
    if (diff <= 0) return 'Ended'
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (days > 0) return `${days} days, ${hours} hours`
    if (hours > 0) return `${hours} hours, ${minutes} minutes`
    return `${minutes} minutes`
  }

  const formatPrizeAmount = () => {
    if (!raffle) return ''
    
    if (raffle.prizeType === 'NFT') {
      return `NFT #${raffle.prizeTokenId}`
    }
    
    // Use formatted value if available, otherwise convert from wei
    const amount = raffle.prizeAmountFormatted || 
                  (parseFloat(raffle.prizeAmount || '0') / Math.pow(10, 18))
    return `${amount.toFixed(2)} ${raffle.ticketTokenSymbol || 'MON'}`
  }

  const formatTicketPrice = () => {
    if (!raffle) return ''
    
    // Use formatted value if available, otherwise convert from wei
    const price = raffle.ticketPriceFormatted || 
                  (parseFloat(raffle.ticketPrice) / Math.pow(10, 18))
    return `${price} ${raffle.ticketTokenSymbol || 'MON'}`
  }

  const isEnded = raffle ? new Date() > new Date(raffle.endTime) : false
  const hasWinner = raffle?.winner && raffle.winner !== '0x0000000000000000000000000000000000000000'
  const isOwner = userAddress && raffle?.owner.toLowerCase() === userAddress.toLowerCase()
  const isWinner = userAddress && raffle?.winner?.toLowerCase() === userAddress.toLowerCase()
  const canDrawWinner = isOwner && isEnded && !hasWinner && raffle?.totalTicketsSold > 0
  const canClaimPrize = isWinner && hasWinner && raffle?.status === 'DRAWN'
  const canWithdrawFees = isOwner && !raffle?.feesWithdrawn && raffle?.totalTicketsSold > 0
  const canRefundPrize = isOwner && isEnded && raffle?.totalTicketsSold === 0 && raffle?.status === 'ACTIVE'

  if (loading) {
    return (
      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-48 mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="h-64 bg-gray-300 dark:bg-gray-600 rounded-lg mb-6"></div>
                <div className="h-48 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
              </div>
              <div className="h-96 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !raffle) {
    return (
      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-8">
            <h1 className="text-2xl font-bold text-red-800 dark:text-red-200 mb-4">
              {error || 'Raffle not found'}
            </h1>
            <Link href="/raffles" className="btn-primary">
              Back to Raffles
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{raffle.prizeType} Raffle #{raffle.raffleId} - Web3 Raffle Platform</title>
        <meta name="description" content={`${raffle.prizeType} raffle with ${formatPrizeAmount()} prize`} />
      </Head>

      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-8"
          >
            <Link 
              href="/raffles"
              className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Raffles
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        raffle.status === 'REFUNDED'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                          : hasWinner 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : isEnded
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}>
                        {raffle.status === 'REFUNDED' 
                          ? '💸 Refunded' 
                          : hasWinner 
                          ? '🏆 Winner Drawn' 
                          : isEnded 
                          ? '⏰ Ended' 
                          : '🔴 Live'
                        }
                      </span>
                      <span className="inline-flex items-center px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 text-xs rounded-full">
                        {raffle.platformFeePercentage / 100}% fee
                      </span>
                    </div>
                    
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                      {raffle.prizeType} Raffle #{raffle.raffleId}
                    </h1>
                    
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <span>Created by </span>
                      <Link 
                        href={`/users/${raffle.owner}`}
                        className="mx-1 font-medium hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {raffle.owner.slice(0, 6)}...{raffle.owner.slice(-4)}
                      </Link>
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-4xl mb-2">
                      {raffle.prizeType === 'NFT' ? '🖼️' : '💰'}
                    </div>
                  </div>
                </div>

                {/* Prize Display */}
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg p-6 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        Prize Pool
                      </h3>
                      <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                        {formatPrizeAmount()}
                      </p>
                      {raffle.prizeType === 'TOKEN' && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Contract: {raffle.prizeContractAddress.slice(0, 6)}...{raffle.prizeContractAddress.slice(-4)}
                        </p>
                      )}
                    </div>
                    <Trophy className="w-16 h-16 text-yellow-500" />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <Ticket className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {formatTicketPrice()}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Ticket Price</p>
                  </div>

                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {raffle.totalTicketsSold}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Tickets Sold</p>
                  </div>

                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <Users className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {raffle.totalParticipants}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Participants</p>
                  </div>

                  <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <Clock className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {isEnded ? 'Ended' : formatTimeRemaining()}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {isEnded ? 'Time Up' : 'Remaining'}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Winner Section */}
              {hasWinner && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6"
                >
                  <div className="flex items-center justify-center mb-4">
                    <Award className="w-8 h-8 text-green-500 mr-3" />
                    <h3 className="text-xl font-bold text-green-800 dark:text-green-200">
                      🎉 Winner Announced!
                    </h3>
                  </div>
                  <div className="text-center">
                    <p className="text-lg text-green-700 dark:text-green-300 mb-2">
                      Congratulations to the winner:
                    </p>
                    <p className="text-2xl font-mono font-bold text-green-800 dark:text-green-200 mb-4">
                      {raffle.winner}
                    </p>
                    
                    {/* Settlement Timeline */}
                    {(raffle.settlementTransactionHash || raffle.feeWithdrawalTransactionHash || raffle.prizeClaimTransactionHash || raffle.prizeRefundTransactionHash) && (
                      <div className="bg-white dark:bg-gray-700 rounded-lg p-4 mb-4 border border-green-200 dark:border-green-700">
                        <div className="flex items-center justify-center mb-3">
                          <Award className="w-4 h-4 text-green-600 mr-2" />
                          <span className="text-sm font-medium text-green-800 dark:text-green-200">
                            Settlement Timeline (Blockchain Verified)
                          </span>
                        </div>
                        
                        <div className="space-y-3">
                          {/* Settlement Transaction */}
                          {raffle.settlementTransactionHash && (
                            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                                <div>
                                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                    🎲 Winner Drawn
                                  </p>
                                  <p className="text-xs text-blue-600 dark:text-blue-400">
                                    Settlement completed automatically
                                  </p>
                                </div>
                              </div>
                              <a
                                href={`${getExplorerUrl()}/tx/${raffle.settlementTransactionHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          )}
                          
                          {/* Fee Withdrawal Transaction */}
                          {raffle.feeWithdrawalTransactionHash && (
                            <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                                <div>
                                  <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
                                    💰 Fees Distributed
                                  </p>
                                  <p className="text-xs text-purple-600 dark:text-purple-400">
                                    Platform fee (10%) & creator share distributed
                                  </p>
                                </div>
                              </div>
                              <a
                                href={`${getExplorerUrl()}/tx/${raffle.feeWithdrawalTransactionHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          )}
                          
                          {/* Prize Distribution Transaction */}
                          {raffle.prizeClaimTransactionHash && (
                            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                                <div>
                                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                    🎁 Prize Distributed
                                  </p>
                                  <p className="text-xs text-green-600 dark:text-green-400">
                                    {formatPrizeAmount()} sent to winner
                                  </p>
                                </div>
                              </div>
                              <a
                                href={`${getExplorerUrl()}/tx/${raffle.prizeClaimTransactionHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          )}

                          {/* Prize Refund Transaction */}
                          {raffle.prizeRefundTransactionHash && (
                            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-amber-500 rounded-full mr-3"></div>
                                <div>
                                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                    💸 Prize Refunded to Creator
                                  </p>
                                  <p className="text-xs text-amber-600 dark:text-amber-400">
                                    {formatPrizeAmount()} returned to creator (no tickets sold)
                                  </p>
                                </div>
                              </div>
                              <a
                                href={`${getExplorerUrl()}/tx/${raffle.prizeRefundTransactionHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          )}
                        </div>
                        
                        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-3">
                          All transactions are verifiable on Monad Testnet Explorer
                        </p>
                      </div>
                    )}
                    
                    {canClaimPrize && (
                      <button
                        onClick={handleClaimPrize}
                        disabled={actionLoading}
                        className="btn-primary disabled:opacity-50"
                      >
                        {actionLoading ? (
                          <div className="flex items-center">
                            <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                            Claiming Prize...
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <Gift className="w-4 h-4 mr-2" />
                            Claim Prize
                          </div>
                        )}
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* REFUNDED Raffle Section */}
              {raffle?.status === 'REFUNDED' && raffle.prizeRefundTransactionHash && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6"
                >
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold text-amber-800 dark:text-amber-200">
                      💸 Prize Refunded
                    </h3>
                  </div>
                  
                  <div className="text-center mb-4">
                    <p className="text-lg text-amber-700 dark:text-amber-300">
                      No tickets were sold, prize returned to creator
                    </p>
                  </div>
                  
                  {/* Transaction Link */}
                  <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-700 rounded-lg border border-amber-200 dark:border-amber-700">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-amber-500 rounded-full mr-3"></div>
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                          Refund Transaction
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {formatPrizeAmount()} returned to creator
                        </p>
                      </div>
                    </div>
                    <a
                      href={`${getExplorerUrl()}/tx/${raffle.prizeRefundTransactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
                    >
                      <span className="text-xs mr-2">View on {getExplorerName()}</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </motion.div>
              )}

              {/* Raffle Ended Actions */}
              {isEnded && !hasWinner && isConnected && raffle?.status !== 'REFUNDED' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6"
                >
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-orange-800 dark:text-orange-200 mb-4">
                      ⏰ Raffle Has Ended
                    </h3>
                    {canDrawWinner ? (
                      <div>
                        <p className="text-orange-700 dark:text-orange-300 mb-4">
                          As the raffle owner, you can now draw the winner!
                        </p>
                        <button
                          onClick={handleDrawWinner}
                          disabled={actionLoading}
                          className="btn-primary disabled:opacity-50"
                        >
                          {actionLoading ? (
                            <div className="flex items-center">
                              <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                              Drawing Winner...
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <Crown className="w-4 h-4 mr-2" />
                              Draw Winner
                            </div>
                          )}
                        </button>
                      </div>
                    ) : (
                      <p className="text-orange-700 dark:text-orange-300">
                        Waiting for the raffle owner to draw the winner...
                      </p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Owner Actions */}
              {isOwner && isConnected && canWithdrawFees && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6"
                >
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4">
                      💰 Withdraw Fees
                    </h3>
                    <p className="text-blue-700 dark:text-blue-300 mb-4">
                      You can withdraw the fees collected from ticket sales.
                    </p>
                    <button
                      onClick={handleWithdrawFees}
                      disabled={actionLoading}
                      className="btn-primary disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <div className="flex items-center">
                          <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                          Withdrawing...
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <DollarSign className="w-4 h-4 mr-2" />
                          Withdraw Fees
                        </div>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Refund Prize for Creator */}
              {isOwner && isConnected && canRefundPrize && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6"
                >
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-amber-800 dark:text-amber-200 mb-4">
                      💸 Refund Prize
                    </h3>
                    <p className="text-amber-700 dark:text-amber-300 mb-4">
                      No tickets were sold. You can get your prize back.
                    </p>
                    <button
                      onClick={handleRefundPrize}
                      disabled={actionLoading}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <div className="flex items-center">
                          <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                          Refunding...
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          Refund Prize
                        </div>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Participants List */}
              {raffle.participantsVisible && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      🎫 Participants & Win Chances
                    </h3>
                    <button
                      onClick={fetchParticipants}
                      disabled={participantsLoading}
                      className="btn-outline btn-sm"
                    >
                      {participantsLoading ? (
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCcw className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {participantsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : participants.length > 0 ? (
                    <div className="space-y-3">
                      {participants.map((participant, index) => (
                        <div 
                          key={participant.address} 
                          className={`p-4 rounded-lg border transition-all ${
                            participant.isWinning
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                              : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              {/* Rank */}
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                index === 0 
                                  ? 'bg-yellow-500 text-white' 
                                  : index === 1 
                                  ? 'bg-gray-400 text-white'
                                  : index === 2
                                  ? 'bg-orange-400 text-white'
                                  : 'bg-blue-500 text-white'
                              }`}>
                                {index + 1}
                              </div>

                              {/* Address */}
                              <div>
                                <div className="flex items-center space-x-2">
                                  <p className="font-mono font-medium text-gray-900 dark:text-gray-100">
                                    {participant.address.slice(0, 6)}...{participant.address.slice(-4)}
                                  </p>
                                  {participant.isWinning && (
                                    <Crown className="w-4 h-4 text-green-500" />
                                  )}
                                  {participant.address.toLowerCase() === userAddress?.toLowerCase() && (
                                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                                      You
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {participant.purchaseCount} purchase{participant.purchaseCount !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>

                            {/* Stats */}
                            <div className="text-right">
                              <div className="flex items-center space-x-4">
                                {/* Tickets */}
                                <div className="text-center">
                                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                    {participant.totalTickets}
                                  </p>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    tickets
                                  </p>
                                </div>

                                {/* Spent */}
                                <div className="text-center">
                                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                    {participant.totalSpent.toFixed(2)}
                                  </p>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    {raffle.ticketTokenSymbol}
                                  </p>
                                </div>

                                {/* Win Chance */}
                                <div className="text-center">
                                  <p className={`text-lg font-bold ${
                                    participant.winChance >= 50 
                                      ? 'text-green-600 dark:text-green-400'
                                      : participant.winChance >= 25
                                      ? 'text-yellow-600 dark:text-yellow-400'
                                      : participant.winChance >= 10
                                      ? 'text-orange-600 dark:text-orange-400'
                                      : 'text-gray-600 dark:text-gray-400'
                                  }`}>
                                    {participant.winChanceFormatted}
                                  </p>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    win chance
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Show total stats */}
                      <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                              {participants.length}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Total Participants
                            </p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                              {raffle.totalTicketsSold}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Total Tickets
                            </p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                              {participants.length > 0 ? (raffle.totalTicketsSold / participants.length).toFixed(1) : '0'}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Avg. Tickets
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-400">
                        No participants yet. Be the first to buy tickets!
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Buy Tickets Card */}
              {!isEnded && !hasWinner && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
                >
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    Buy Tickets
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Number of tickets
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={raffle.maxTicketsPerWallet || 100}
                        value={buyAmount}
                        onChange={(e) => setBuyAmount(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {raffle.maxTicketsPerWallet > 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Max {raffle.maxTicketsPerWallet} tickets per wallet
                        </p>
                      )}
                    </div>

                    <PlatformFeeDisplay
                      ticketPrice={raffle.ticketPrice}
                      ticketCount={buyAmount}
                      platformFeePercentage={raffle.platformFeePercentage}
                      tokenSymbol={raffle.ticketTokenSymbol}
                      tokenDecimals={18}
                      showBreakdown={false}
                    />

                    {isConnected ? (
                      <button
                        onClick={() => setShowBuyModal(true)}
                        className="w-full btn-primary text-lg py-3"
                      >
                        Buy {buyAmount} Ticket{buyAmount > 1 ? 's' : ''}
                      </button>
                    ) : (
                      <button
                        onClick={login}
                        className="w-full btn-primary text-lg py-3"
                      >
                        Connect Wallet to Buy Tickets
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Raffle Details */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
              >
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Raffle Details
                </h3>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Contract:</span>
                    <Link 
                      href={`${getExplorerUrl()}/address/${raffle.contractAddress}`}
                      target="_blank"
                      className="font-mono text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {raffle.contractAddress.slice(0, 6)}...{raffle.contractAddress.slice(-4)}
                    </Link>
                  </div>

                  {raffle.transactionHash && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Creation TX:</span>
                      <Link 
                        href={`${getExplorerUrl()}/tx/${raffle.transactionHash}`}
                        target="_blank"
                        className="font-mono text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {raffle.transactionHash.slice(0, 6)}...{raffle.transactionHash.slice(-4)}
                      </Link>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Network:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      Monad Testnet
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Started:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {new Date(raffle.startTime).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Ends:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {new Date(raffle.endTime).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Payment Token:</span>
                    <TokenDisplay 
                      tokenSymbol={raffle.ticketTokenSymbol || 'MON'} 
                      className="text-sm"
                    />
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Platform Fee:</span>
                    <span className="font-medium text-orange-600 dark:text-orange-400">
                      {raffle.platformFeePercentage / 100}%
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Shield className="w-4 h-4 mr-2" />
                    <span>Powered by smart contracts</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Buy Modal - Simple placeholder */}
      {showBuyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              Buy {buyAmount} Ticket{buyAmount > 1 ? 's' : ''}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This would connect to your wallet and execute the ticket purchase transaction.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowBuyModal(false)}
                className="flex-1 btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!raffle) return
                  
                  const success = await buyTickets(
                    raffle.contractAddress,
                    buyAmount,
                    raffle.ticketPrice, // Already in wei format from API
                    raffle.ticketTokenAddress,
                    raffle.ticketTokenAddress === '0x0000000000000000000000000000000000000000'
                  )
                  
                  if (success) {
                    setShowBuyModal(false)
                    // Refresh raffle data
                    setTimeout(() => {
                      fetchRaffleDetails()
                    }, 2000)
                  }
                }}
                disabled={purchaseLoading}
                className="flex-1 btn-primary disabled:opacity-50"
              >
                {purchaseLoading ? 'Processing...' : 'Confirm Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}