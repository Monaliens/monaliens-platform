import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  User, 
  Trophy, 
  Ticket, 
  DollarSign, 
  TrendingUp, 
  ArrowLeft, 
  Shield, 
  Award,
  Calendar,
  Target,
  Coins,
  Activity,
  Copy,
  ExternalLink
} from 'lucide-react'
import { getApiUrl, getExplorerUrl, getExplorerName } from '../../utils/deployments'

interface UserStats {
  totalRafflesCreated: number
  totalRafflesParticipated: number
  totalTicketsPurchased: number
  totalAmountSpent: string
  totalWins: number
  totalPrizesWon: string
  winRate: number
  totalStaked: string
  totalRewardsEarned: string
  activeStakes: number
  totalReferrals: number
  totalCommissionsEarned: string
}

interface UserProfile {
  address: string
  username?: string
  email?: string
  bio?: string
  avatar?: string
  joinedAt: string
  lastActive: string
  isVerified: boolean
  stats: UserStats
}

interface Raffle {
  raffleId: string
  prizeType: 'TOKEN' | 'NFT'
  prizeAmount?: string
  prizeMetadata: any
  status: string
  endTime: string
  createdAt: string
  totalTicketsSold: number
  totalParticipants: number
  winner?: string
}

export default function UserProfilePage() {
  const router = useRouter()
  const { address } = router.query
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [raffles, setRaffles] = useState<Raffle[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (address && typeof address === 'string') {
      fetchUserData(address)
    }
  }, [address])

  const fetchUserData = async (userAddress: string) => {
    try {
      setLoading(true)
      
      // Fetch user profile and raffles in parallel
      const [profileResponse, rafflesResponse] = await Promise.all([
        fetch(`${getApiUrl()}/api/users/${userAddress}`),
        fetch(`${getApiUrl()}/api/users/${userAddress}/raffles?limit=10`)
      ])

      if (profileResponse.ok) {
        const profileData = await profileResponse.json()
        setProfile(profileData.data)
      }

      if (rafflesResponse.ok) {
        const rafflesData = await rafflesResponse.json()
        setRaffles(rafflesData.data?.raffles || [])
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address as string)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading user profile...</p>
        </motion.div>
      </div>
    )
  }

  if (!profile && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div 
          className="text-center p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <User className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h1 className="text-2xl font-bold text-white mb-4">User Not Found</h1>
          <p className="text-gray-400 mb-6">The requested user profile could not be found</p>
          <Link 
            href="/"
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Home
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{profile?.username || formatAddress(address as string)} - User Profile</title>
        <meta name="description" content={`View ${profile?.username || 'user'}'s raffle profile and statistics`} />
      </Head>

      <div className="min-h-screen py-8 px-4 relative">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-emerald-900/20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="max-w-6xl mx-auto relative">
          {/* Back Button */}
          <motion.div 
            className="mb-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-300"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </motion.div>

          {/* Profile Header */}
          <motion.div 
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <User className="w-12 h-12 text-white" />
                </div>
                {profile?.isVerified && (
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-white">
                    {profile?.username || 'Anonymous User'}
                  </h1>
                  {profile?.isVerified && (
                    <Award className="w-6 h-6 text-yellow-400" />
                  )}
                </div>
                
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-gray-400 font-mono text-sm">
                    {formatAddress(address as string)}
                  </p>
                  <button
                    onClick={copyAddress}
                    className="p-1 hover:bg-white/10 rounded transition-colors duration-300"
                    title="Copy address"
                  >
                    <Copy className="w-4 h-4 text-gray-400 hover:text-white" />
                  </button>
                  {copied && (
                    <span className="text-green-400 text-xs">Copied!</span>
                  )}
                </div>

                {profile?.bio && (
                  <p className="text-gray-300 mb-4">{profile.bio}</p>
                )}
                
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Joined {new Date(profile?.joinedAt || '').toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1">
                    <Activity className="w-4 h-4" />
                    Last active {new Date(profile?.lastActive || '').toLocaleDateString()}
                  </div>
                </div>
              </div>

              <a
                href={`${getExplorerUrl()}/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg transition-all duration-300 flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                View on {getExplorerName()}
              </a>
            </div>
          </motion.div>

          {/* Stats Grid */}
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Trophy className="w-6 h-6 text-yellow-400" />
                <span className="text-2xl font-bold text-white">{profile?.stats?.totalWins || 0}</span>
              </div>
              <p className="text-gray-400 text-sm">Total Wins</p>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Ticket className="w-6 h-6 text-blue-400" />
                <span className="text-2xl font-bold text-white">{profile?.stats?.totalTicketsPurchased || 0}</span>
              </div>
              <p className="text-gray-400 text-sm">Tickets Bought</p>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-6 h-6 text-purple-400" />
                <span className="text-2xl font-bold text-white">{profile?.stats?.totalRafflesParticipated || 0}</span>
              </div>
              <p className="text-gray-400 text-sm">Raffles Joined</p>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-6 h-6 text-green-400" />
                <span className="text-2xl font-bold text-white">{(profile?.stats?.winRate || 0).toFixed(1)}%</span>
              </div>
              <p className="text-gray-400 text-sm">Win Rate</p>
            </div>
          </motion.div>

          {/* Tab Navigation */}
          <motion.div 
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-2 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex gap-2">
              {[
                { id: 'overview', label: 'Overview', icon: User },
                { id: 'raffles', label: 'Created Raffles', icon: Trophy },
                { id: 'activity', label: 'Activity', icon: Activity }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                    activeTab === tab.id
                      ? 'bg-white/20 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Tab Content */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Activity Summary */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    Activity Summary
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Raffles Created</span>
                      <span className="text-white font-semibold">{profile?.stats?.totalRafflesCreated || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Total Spent</span>
                      <span className="text-white font-semibold">{parseFloat(profile?.stats?.totalAmountSpent || '0').toFixed(2)} MON</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Total Won</span>
                      <span className="text-green-400 font-semibold">{parseFloat(profile?.stats?.totalPrizesWon || '0').toFixed(2)} MON</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Active Stakes</span>
                      <span className="text-white font-semibold">{profile?.stats?.activeStakes || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Award className="w-5 h-5 text-yellow-400" />
                    Recent Activity
                  </h3>
                  
                  <div className="space-y-4">
                    {raffles.length > 0 ? (
                      raffles.slice(0, 5).map((raffle) => (
                        <div key={raffle.raffleId} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Trophy className="w-4 h-4 text-yellow-400" />
                            <div>
                              <p className="text-white text-sm font-medium">
                                Created Raffle #{raffle.raffleId}
                              </p>
                              <p className="text-gray-400 text-xs">
                                {new Date(raffle.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            raffle.status === 'ACTIVE' 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {raffle.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 text-center py-8">No recent activity</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'raffles' && (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Created Raffles ({raffles.length})
                </h3>
                
                {raffles.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {raffles.map((raffle) => (
                      <Link
                        key={raffle.raffleId}
                        href={`/raffles/${raffle.raffleId}`}
                        className="block p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-all duration-300 border border-white/10 hover:border-white/20"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <Trophy className="w-5 h-5 text-yellow-400" />
                          <span className="text-white font-semibold">Raffle #{raffle.raffleId}</span>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Prize:</span>
                            <span className="text-white">
                              {raffle.prizeType === 'TOKEN' 
                                ? `${raffle.prizeAmount} MON`
                                : 'NFT'
                              }
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Tickets Sold:</span>
                            <span className="text-white">{raffle.totalTicketsSold}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Status:</span>
                            <span className={`${
                              raffle.status === 'ACTIVE' 
                                ? 'text-green-400' 
                                : 'text-gray-400'
                            }`}>
                              {raffle.status}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">No raffles created yet</p>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </>
  )
} 