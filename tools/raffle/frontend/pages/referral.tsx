import { useState, useEffect } from 'react'
import Head from 'next/head'
import { motion } from 'framer-motion'
import { usePrivy } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import toast from 'react-hot-toast'
import { 
  Users, 
  Gift, 
  Copy, 
  Check,
  TrendingUp,
  Star,
  Share2,
  Award,
  DollarSign,
  Target
} from 'lucide-react'
import { CONTRACTS } from '@/utils/contracts'

// Referral contract ABI
const REFERRAL_ABI = [
  'function generateReferralCode(string memory _customCode) external returns (bytes32)',
  'function registerReferral(bytes32 _referralCode) external',
  'function getReferralStats(address _user) external view returns (address referrer, uint256 totalReferrals, uint256 totalCommissions, uint256 activeReferrals, uint256 currentCommissionRate, string memory currentTier, bytes32 referralCode)',
  'function getCurrentCommissionRate(address _referrer) public view returns (uint256)',
  'function getCurrentTierName(address _referrer) public view returns (string memory)',
  'function getCommissionTiers() external view returns (tuple(uint256 minReferrals, uint256 commissionRate, string tierName)[])',
  'function withdrawCommissions() external'
]

interface ReferralStats {
  referrer: string
  totalReferrals: number
  totalCommissions: string
  activeReferrals: number
  currentCommissionRate: number
  currentTier: string
  referralCode: string
}

interface CommissionTier {
  minReferrals: number
  commissionRate: number
  tierName: string
}

export default function ReferralPage() {
  const { user, authenticated, login } = usePrivy()
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [tiers, setTiers] = useState<CommissionTier[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copying, setCopying] = useState(false)
  const [customCode, setCustomCode] = useState('')
  const [referralLink, setReferralLink] = useState('')

  useEffect(() => {
    if (authenticated && user) {
      loadReferralData()
    }
  }, [authenticated, user])

  const loadReferralData = async () => {
    try {
      setLoading(true)
      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const signer = await provider.getSigner()
      
      const referralContract = new ethers.Contract(CONTRACTS.REFERRAL, REFERRAL_ABI, signer)
      
      // Get user's referral stats
      const userStats = await referralContract.getReferralStats(await signer.getAddress())
      
      const referralStats: ReferralStats = {
        referrer: userStats.referrer,
        totalReferrals: Number(userStats.totalReferrals),
        totalCommissions: ethers.formatUnits(userStats.totalCommissions, 18),
        activeReferrals: Number(userStats.activeReferrals),
        currentCommissionRate: Number(userStats.currentCommissionRate),
        currentTier: userStats.currentTier,
        referralCode: userStats.referralCode
      }
      
      setStats(referralStats)
      
      // Generate referral link if user has a code
      if (referralStats.referralCode && referralStats.referralCode !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        const link = `${window.location.origin}?ref=${referralStats.referralCode}`
        setReferralLink(link)
      }
      
      // Get commission tiers
      const tiersData = await referralContract.getCommissionTiers()
      const formattedTiers = tiersData.map((tier: any) => ({
        minReferrals: Number(tier.minReferrals),
        commissionRate: Number(tier.commissionRate),
        tierName: tier.tierName
      }))
      setTiers(formattedTiers)
      
    } catch (error) {
      console.error('Error loading referral data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateCode = async () => {
    if (generating) return
    
    try {
      setGenerating(true)
      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const signer = await provider.getSigner()
      
      const referralContract = new ethers.Contract(CONTRACTS.REFERRAL, REFERRAL_ABI, signer)
      
      console.log('Generating referral code...')
      const tx = await referralContract.generateReferralCode(customCode || '')
      await tx.wait()
      
      console.log('Referral code generated successfully!')
      await loadReferralData()
      setCustomCode('')
      
    } catch (error) {
      console.error('Error generating referral code:', error)
      toast.error('Failed to generate referral code. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopyLink = async () => {
    if (!referralLink) return
    
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopying(true)
      setTimeout(() => setCopying(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const getTierProgress = () => {
    if (!stats || tiers.length === 0) return { current: 0, next: 0, progress: 0 }
    
    const currentTierIndex = tiers.findIndex(tier => tier.tierName === stats.currentTier)
    const nextTier = currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : null
    
    if (!nextTier) return { current: stats.totalReferrals, next: stats.totalReferrals, progress: 100 }
    
    const progress = (stats.totalReferrals / nextTier.minReferrals) * 100
    return { 
      current: stats.totalReferrals, 
      next: nextTier.minReferrals, 
      progress: Math.min(progress, 100) 
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
          <Users className="w-16 h-16 mx-auto mb-4 text-purple-400" />
          <h1 className="text-2xl font-bold text-white mb-4">Referral Program</h1>
          <p className="text-gray-400 mb-6">Connect your wallet to start earning referral rewards</p>
          <button 
            onClick={login} 
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-300"
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
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading referral data...</p>
        </motion.div>
      </div>
    )
  }

  const tierProgress = getTierProgress()

  return (
    <>
      <Head>
        <title>Referral Program - Web3 Raffle Platform</title>
        <meta name="description" content="Earn commissions by referring friends to our raffle platform" />
      </Head>

      <div className="min-h-screen py-8 px-4 relative">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-blue-900/20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="max-w-6xl mx-auto relative">
          {/* Header */}
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              Referral Program
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Invite friends and earn commissions on their raffle purchases
            </p>
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
                <Users className="w-6 h-6 text-purple-400" />
                <span className="text-2xl font-bold text-white">{stats?.totalReferrals || 0}</span>
              </div>
              <p className="text-gray-400 text-sm">Total Referrals</p>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-6 h-6 text-green-400" />
                <span className="text-2xl font-bold text-white">{stats?.activeReferrals || 0}</span>
              </div>
              <p className="text-gray-400 text-sm">Active Referrals</p>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="w-6 h-6 text-yellow-400" />
                <span className="text-2xl font-bold text-white">{parseFloat(stats?.totalCommissions || '0').toFixed(2)}</span>
              </div>
              <p className="text-gray-400 text-sm">Commissions Earned</p>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-6 h-6 text-blue-400" />
                <span className="text-2xl font-bold text-white">{((stats?.currentCommissionRate || 0) / 100).toFixed(1)}%</span>
              </div>
              <p className="text-gray-400 text-sm">Commission Rate</p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Referral Code Section */}
            <motion.div 
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Share2 className="w-6 h-6 text-purple-400" />
                Your Referral Code
              </h2>

              {stats?.referralCode && stats.referralCode !== '0x0000000000000000000000000000000000000000000000000000000000000000' ? (
                <div className="space-y-4">
                  <div className="bg-white/10 rounded-lg p-4">
                    <p className="text-sm text-gray-400 mb-2">Referral Link</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-white font-mono text-sm break-all">{referralLink}</code>
                      <button
                        onClick={handleCopyLink}
                        className="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center gap-1"
                      >
                        {copying ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copying ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">Share this link with friends to earn commissions!</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-400">Generate your unique referral code to start earning commissions.</p>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Custom Code (optional)
                    </label>
                    <input
                      type="text"
                      value={customCode}
                      onChange={(e) => setCustomCode(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter custom code or leave empty for auto-generated"
                    />
                  </div>
                  
                  <button
                    onClick={handleGenerateCode}
                    disabled={generating}
                    className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {generating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <Gift className="w-4 h-4" />
                        Generate Referral Code
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>

            {/* Tier Progress */}
            <motion.div 
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Award className="w-6 h-6 text-yellow-400" />
                Your Tier: {stats?.currentTier || 'Bronze'}
              </h2>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Progress to next tier</span>
                    <span>{tierProgress.current} / {tierProgress.next} referrals</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-pink-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${tierProgress.progress}%` }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-3">
                  {tiers.map((tier, index) => (
                    <div 
                      key={tier.tierName}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        tier.tierName === stats?.currentTier 
                          ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30' 
                          : 'bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Star className={`w-5 h-5 ${
                          tier.tierName === stats?.currentTier ? 'text-yellow-400' : 'text-gray-400'
                        }`} />
                        <div>
                          <p className="text-white font-medium">{tier.tierName}</p>
                          <p className="text-xs text-gray-400">{tier.minReferrals}+ referrals</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold">{(tier.commissionRate / 100).toFixed(1)}%</p>
                        <p className="text-xs text-gray-400">commission</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* How it Works */}
          <motion.div 
            className="mt-8 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5 text-blue-400" />
              How It Works
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-300">
              <div className="text-center">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-white font-bold">1</span>
                </div>
                <p>Generate your unique referral code</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-white font-bold">2</span>
                </div>
                <p>Share your link with friends</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-white font-bold">3</span>
                </div>
                <p>Earn commissions on their purchases</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  )
} 