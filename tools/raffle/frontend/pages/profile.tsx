import { useState, useEffect } from 'react'
import Head from 'next/head'
import { motion } from 'framer-motion'
import { usePrivy } from '@privy-io/react-auth'
import { 
  User, 
  Trophy, 
  Ticket, 
  DollarSign, 
  TrendingUp, 
  Settings, 
  Bell, 
  Shield, 
  Award,
  Calendar,
  Target,
  Coins,
  Activity
} from 'lucide-react'
import { getApiUrl } from '../utils/deployments'
import Link from 'next/link'

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

export default function ProfilePage() {
  const { user, authenticated, login } = usePrivy()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (authenticated && user) {
      fetchUserProfile()
    }
  }, [authenticated, user])

  const fetchUserProfile = async () => {
    try {
      setLoading(true)
              const response = await fetch(`${getApiUrl()}/api/users/${user?.wallet?.address}`)
      
      if (response.ok) {
        const data = await response.json()
        setProfile(data.data)
      } else {
        // Create new user profile if doesn't exist
        const newProfile = {
          address: user?.wallet?.address || '',
          username: '',
          email: '',
          bio: '',
          joinedAt: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          isVerified: false,
          stats: {
            totalRafflesCreated: 0,
            totalRafflesParticipated: 0,
            totalTicketsPurchased: 0,
            totalAmountSpent: '0',
            totalWins: 0,
            totalPrizesWon: '0',
            winRate: 0,
            totalStaked: '0',
            totalRewardsEarned: '0',
            activeStakes: 0,
            totalReferrals: 0,
            totalCommissionsEarned: '0'
          }
        }
        setProfile(newProfile)
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div 
          className="text-center p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <User className="w-16 h-16 mx-auto mb-4 text-blue-400" />
          <h1 className="text-2xl font-bold text-white mb-4">Profile</h1>
          <p className="text-gray-400 mb-6">Connect your wallet to view your profile</p>
          <button 
            onClick={login} 
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300"
          >
            Connect Wallet
          </button>
        </motion.div>
      </div>
    )
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
          <p className="text-gray-400">Loading profile...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Profile - Web3 Raffle Platform</title>
        <meta name="description" content="Manage your profile and view your raffle statistics" />
      </Head>

      <div className="min-h-screen py-8 px-4 relative">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-emerald-900/20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="max-w-6xl mx-auto relative">
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
                    {profile?.username || 'Unnamed User'}
                  </h1>
                  {profile?.isVerified && (
                    <Award className="w-6 h-6 text-yellow-400" />
                  )}
                </div>
                <p className="text-gray-400 font-mono text-sm mb-2">
                  {profile?.address}
                </p>
                {profile?.bio && (
                  <p className="text-gray-300">{profile.bio}</p>
                )}
                <div className="flex items-center gap-4 mt-4 text-sm text-gray-400">
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

              <div className="flex flex-col gap-2">
                <Link
                  href={`/users/${user?.wallet?.address}`}
                  className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 rounded-lg transition-all duration-300 flex items-center gap-2 text-sm"
                >
                  <User className="w-4 h-4" />
                  View Public Profile
                </Link>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg transition-all duration-300 flex items-center gap-2 text-sm"
                >
                  <Settings className="w-4 h-4" />
                  Edit Profile
                </button>
              </div>
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
                { id: 'raffles', label: 'My Raffles', icon: Trophy },
                { id: 'staking', label: 'Staking', icon: Coins },
                { id: 'settings', label: 'Settings', icon: Settings }
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

                {/* Achievements */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Award className="w-5 h-5 text-yellow-400" />
                    Achievements
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-white/5 rounded-lg">
                      <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                      <div className="text-lg font-bold text-white">First Win</div>
                      <div className="text-xs text-gray-400">
                        {(profile?.stats?.totalWins || 0) > 0 ? 'Unlocked' : 'Locked'}
                      </div>
                    </div>
                    
                    <div className="text-center p-4 bg-white/5 rounded-lg">
                      <Ticket className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                      <div className="text-lg font-bold text-white">Big Spender</div>
                      <div className="text-xs text-gray-400">
                        {parseFloat(profile?.stats?.totalAmountSpent || '0') > 1000 ? 'Unlocked' : 'Locked'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-gray-400" />
                  Profile Settings
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={profile?.username || ''}
                      onChange={(e) => setProfile(prev => prev ? {...prev, username: e.target.value} : null)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your username"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Bio
                    </label>
                    <textarea
                      value={profile?.bio || ''}
                      onChange={(e) => setProfile(prev => prev ? {...prev, bio: e.target.value} : null)}
                      rows={3}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="Tell us about yourself..."
                    />
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Bell className="w-5 h-5 text-yellow-400" />
                      Notification Preferences
                    </h4>
                    
                    <div className="space-y-3">
                      <label className="flex items-center gap-3">
                        <input type="checkbox" className="w-4 h-4 rounded" defaultChecked />
                        <span className="text-gray-300">Email notifications</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input type="checkbox" className="w-4 h-4 rounded" defaultChecked />
                        <span className="text-gray-300">Browser notifications</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input type="checkbox" className="w-4 h-4 rounded" defaultChecked />
                        <span className="text-gray-300">Raffle updates</span>
                      </label>
                    </div>
                  </div>
                  
                  <button className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300">
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </>
  )
} 