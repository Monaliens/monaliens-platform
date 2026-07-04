import { useState, useEffect } from 'react'
import Head from 'next/head'
import { motion } from 'framer-motion'
import { usePrivy } from '@privy-io/react-auth'
import toast from 'react-hot-toast'
import PlatformFeeDashboard from '@/components/PlatformFeeDashboard'
import { getPlatformWallet, getContractAddress, getRpcUrl } from '@/utils/deployments'
import { STAKING_ABI, ERC20_ABI } from '@/utils/contracts'
import { 
  DollarSign, 
  Download, 
  Wallet, 
  TrendingUp,
  AlertCircle,
  RefreshCcw,
  Settings,
  Coins,
  Gift,
  Plus,
  Edit,
  ToggleLeft,
  ToggleRight,
  Trash2
  } from 'lucide-react'

interface StakingPool {
  poolId: number
  stakingToken: string
  rewardRate: string
  totalStaked: string
  totalRewards: string
  minStakingPeriod: number
  isActive: boolean
  stakeType: number
  apy: number
}

export default function PlatformDashboardPage() {
  const { user, authenticated, login } = usePrivy()
  const [withdrawing, setWithdrawing] = useState(false)
  const [balance, setBalance] = useState<string>('0')
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [currentPlatformWallet, setCurrentPlatformWallet] = useState<string>('')
  const [newWalletAddress, setNewWalletAddress] = useState<string>('')
  const [updatingWallet, setUpdatingWallet] = useState(false)
  
  // Pool Management State
  const [pools, setPools] = useState<StakingPool[]>([])
  const [poolsLoading, setPoolsLoading] = useState(false)
  const [showCreatePool, setShowCreatePool] = useState(false)
  const [newPool, setNewPool] = useState({
    stakingToken: '',
    rewardRate: '',
    minStakingPeriod: '0',
    stakeType: '0'
  })
  const [creatingPool, setCreatingPool] = useState(false)
  
  // Get platform wallet from deployments
  const PLATFORM_ADMIN_ADDRESS = getPlatformWallet()
  const MON_TOKEN_ADDRESS = getContractAddress('monToken')
  const RAFFLE_FACTORY_ADDRESS = getContractAddress('raffleFactory')
  const STAKING_ADDRESS = getContractAddress('staking')
  
  const userAddress = user?.wallet?.address
  const isAdmin = userAddress && userAddress.toLowerCase() === PLATFORM_ADMIN_ADDRESS.toLowerCase()

  useEffect(() => {
    if (isAdmin) {
      checkPlatformBalance()
      getCurrentPlatformWallet()
      loadStakingPools()
    }
  }, [isAdmin])

  const getCurrentPlatformWallet = async () => {
    try {
      const { ethers } = await import('ethers')
      const provider = new ethers.JsonRpcProvider(getRpcUrl())
      
      const factoryABI = ['function platformFeeWallet() view returns (address)']
      const factory = new ethers.Contract(RAFFLE_FACTORY_ADDRESS, factoryABI, provider)
      
      const platformWallet = await factory.platformFeeWallet()
      setCurrentPlatformWallet(platformWallet)
      
    } catch (error) {
      console.error('Error getting current platform wallet:', error)
    }
  }

  const loadStakingPools = async () => {
    setPoolsLoading(true)
    try {
      const { ethers } = await import('ethers')
      const provider = new ethers.JsonRpcProvider(getRpcUrl())
      
      const stakingContract = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, provider)
      
      const totalPools = await stakingContract.totalPools()
      const poolsData: StakingPool[] = []
      
      for (let i = 0; i < totalPools; i++) {
        try {
          const poolInfo = await stakingContract.stakingPools(i)
          
          // Calculate APY (simplified - can be made more complex)
          const apy = poolInfo.stakingToken.toLowerCase() === MON_TOKEN_ADDRESS.toLowerCase() ? 10 : 5
          
          poolsData.push({
            poolId: i,
            stakingToken: poolInfo.stakingToken,
            rewardRate: poolInfo.rewardRate.toString(),
            totalStaked: ethers.formatUnits(poolInfo.totalStaked, 18),
            totalRewards: ethers.formatUnits(poolInfo.totalRewards, 18),
            minStakingPeriod: Number(poolInfo.minStakingPeriod),
            isActive: poolInfo.isActive,
            stakeType: Number(poolInfo.stakeType),
            apy: apy
          })
        } catch (error) {
          console.error(`Error loading pool ${i}:`, error)
        }
      }
      
      setPools(poolsData)
      
    } catch (error) {
      console.error('Error loading staking pools:', error)
    } finally {
      setPoolsLoading(false)
    }
  }

  const checkPlatformBalance = async () => {
    if (!userAddress) return
    
    setBalanceLoading(true)
    try {
      const { ethers } = await import('ethers')
      const provider = new ethers.JsonRpcProvider(getRpcUrl())
      
      const ERC20_ABI = [
        'function balanceOf(address owner) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)'
      ]
      
      const monContract = new ethers.Contract(MON_TOKEN_ADDRESS, ERC20_ABI, provider)
      const [tokenBalance, decimals] = await Promise.all([
        monContract.balanceOf(currentPlatformWallet || PLATFORM_ADMIN_ADDRESS),
        monContract.decimals()
      ])
      
      const formattedBalance = ethers.formatUnits(tokenBalance, decimals)
      setBalance(formattedBalance)
      
    } catch (error) {
      console.error('Error checking platform balance:', error)
    } finally {
      setBalanceLoading(false)
    }
  }

  const createPool = async () => {
    if (!isAdmin || !newPool.stakingToken || !newPool.rewardRate) return
    
    setCreatingPool(true)
    try {
      const { ethers } = await import('ethers')
      
      if (!window.ethereum) {
        throw new Error('Please install MetaMask')
      }

      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const signer = await provider.getSigner()
      
      const stakingContract = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, signer)
      
      // Validate address
      if (!ethers.isAddress(newPool.stakingToken)) {
        throw new Error('Invalid token address')
      }
      
      // Convert reward rate (assuming APY to rate per second)
      const rewardRatePerSecond = ethers.parseUnits(newPool.rewardRate, 18)
      
      const tx = await stakingContract.createStakingPool(
        newPool.stakingToken,
        rewardRatePerSecond,
        Number(newPool.minStakingPeriod),
        Number(newPool.stakeType),
        { gasLimit: 500000 }
      )
      
      console.log('Create pool transaction sent:', tx.hash)
      await tx.wait()
      
      toast.success(`Pool created successfully! Transaction: ${tx.hash}`)
      
      // Reset form and reload pools
      setNewPool({
        stakingToken: '',
        rewardRate: '',
        minStakingPeriod: '0',
        stakeType: '0'
      })
      setShowCreatePool(false)
      await loadStakingPools()
      
    } catch (error) {
      console.error('Create pool error:', error)
      toast.error(`Error creating pool: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setCreatingPool(false)
    }
  }

  const togglePool = async (poolId: number) => {
    if (!isAdmin) return
    
    try {
      const { ethers } = await import('ethers')
      
      if (!window.ethereum) {
        throw new Error('Please install MetaMask')
      }

      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const signer = await provider.getSigner()
      
      const stakingContract = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, signer)
      
      const tx = await stakingContract.togglePool(poolId, { gasLimit: 300000 })
      console.log('Toggle pool transaction sent:', tx.hash)
      
      await tx.wait()
      
      toast.success(`Pool ${poolId} toggled successfully! Transaction: ${tx.hash}`)
      
      // Reload pools
      await loadStakingPools()
      
    } catch (error) {
      console.error('Toggle pool error:', error)
      toast.error(`Error toggling pool: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const updatePlatformWallet = async () => {
    if (!isAdmin || !newWalletAddress) return
    
    setUpdatingWallet(true)
    try {
      const { ethers } = await import('ethers')
      
      if (!window.ethereum) {
        throw new Error('Please install MetaMask')
      }

      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const signer = await provider.getSigner()
      
      const factoryABI = [
        'function setPlatformFeeWallet(address _platformFeeWallet) external',
        'function platformFeeWallet() view returns (address)'
      ]
      
      const factory = new ethers.Contract(RAFFLE_FACTORY_ADDRESS, factoryABI, signer)
      
      // Validate address
      if (!ethers.isAddress(newWalletAddress)) {
        throw new Error('Invalid wallet address')
      }
      
      const tx = await factory.setPlatformFeeWallet(newWalletAddress)
      console.log('Update wallet transaction sent:', tx.hash)
      
      await tx.wait()
      
      toast.success(`Platform wallet updated successfully! New wallet: ${newWalletAddress}. Transaction: ${tx.hash}`)
      
      // Refresh current wallet
      await getCurrentPlatformWallet()
      setNewWalletAddress('')
      
    } catch (error) {
      console.error('Update wallet error:', error)
      toast.error(`Error updating platform wallet: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUpdatingWallet(false)
    }
  }

  const handleWithdrawPlatformFees = async () => {
    if (!isAdmin) return
    
    setWithdrawing(true)
    try {
      toast('Platform fee withdrawal functionality will be implemented here. Current balance can be transferred manually using the transfer script.', { icon: 'ℹ️' })
    } catch (error) {
      console.error('Withdrawal error:', error)
      toast.error('Error withdrawing platform fees')
    } finally {
      setWithdrawing(false)
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Platform Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Connect your wallet to access the platform dashboard
          </p>
          <button onClick={login} className="btn-primary">
            Connect Wallet
          </button>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Only platform administrators can access this dashboard.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-6 font-mono">
            Admin: {PLATFORM_ADMIN_ADDRESS}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-6 font-mono">
            You: {userAddress}
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Platform Dashboard - Web3 Raffle Platform</title>
        <meta name="description" content="Platform administration dashboard" />
      </Head>

      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  Platform Dashboard
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Monitor platform performance and manage fees
                </p>
              </div>
              
              {/* Platform Balance Card */}
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Platform Balance</p>
                    <p className="text-2xl font-bold">
                      {balanceLoading ? (
                        <div className="flex items-center">
                          <RefreshCcw className="w-5 h-5 animate-spin mr-2" />
                          Loading...
                        </div>
                      ) : (
                        `${parseFloat(balance).toLocaleString()} MON`
                      )}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={checkPlatformBalance}
                      disabled={balanceLoading}
                      className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                    >
                      <RefreshCcw className={`w-4 h-4 ${balanceLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={handleWithdrawPlatformFees}
                      disabled={withdrawing}
                      className="flex items-center px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                    >
                      {withdrawing ? (
                        <RefreshCcw className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Withdraw
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Platform Wallet Management */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Current Platform Wallet */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3" />
                  <h3 className="text-lg font-medium text-blue-800 dark:text-blue-200">
                    Current Platform Wallet
                  </h3>
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-mono break-all">
                  {currentPlatformWallet || 'Loading...'}
                </p>
                <p className="text-xs text-blue-500 dark:text-blue-300 mt-2">
                  Platform fees are collected in this wallet
                </p>
              </div>

              {/* Update Platform Wallet */}
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <Settings className="w-5 h-5 text-orange-600 dark:text-orange-400 mr-3" />
                  <h3 className="text-lg font-medium text-orange-800 dark:text-orange-200">
                    Update Platform Wallet
                  </h3>
                </div>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="New wallet address (0x...)"
                    value={newWalletAddress}
                    onChange={(e) => setNewWalletAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-sm"
                  />
                  <button
                    onClick={updatePlatformWallet}
                    disabled={updatingWallet || !newWalletAddress}
                    className="w-full btn-primary disabled:opacity-50"
                  >
                    {updatingWallet ? (
                      <div className="flex items-center justify-center">
                        <RefreshCcw className="w-4 h-4 animate-spin mr-2" />
                        Updating...
                      </div>
                    ) : (
                      'Update Platform Wallet'
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Platform Fee Dashboard */}
            <PlatformFeeDashboard />

            {/* Pool Management */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                    <Coins className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                    Staking Pool Management
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Create and manage staking pools
                  </p>
                </div>
                <button
                  onClick={() => setShowCreatePool(!showCreatePool)}
                  className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Pool
                </button>
              </div>

              {/* Create Pool Form */}
              {showCreatePool && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-4">
                    Create New Staking Pool
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Token Address
                      </label>
                      <input
                        type="text"
                        placeholder="0x..."
                        value={newPool.stakingToken}
                        onChange={(e) => setNewPool({...newPool, stakingToken: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Reward Rate (per second)
                      </label>
                      <input
                        type="text"
                        placeholder="0.000000003170979198"
                        value={newPool.rewardRate}
                        onChange={(e) => setNewPool({...newPool, rewardRate: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Min Staking Period (seconds)
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={newPool.minStakingPeriod}
                        onChange={(e) => setNewPool({...newPool, minStakingPeriod: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Stake Type
                      </label>
                      <select
                        value={newPool.stakeType}
                        onChange={(e) => setNewPool({...newPool, stakeType: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="0">TOKEN (ERC20)</option>
                        <option value="1">NFT (ERC721)</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={createPool}
                      disabled={creatingPool || !newPool.stakingToken || !newPool.rewardRate}
                      className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                    >
                      {creatingPool ? (
                        <>
                          <RefreshCcw className="w-4 h-4 animate-spin mr-2" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Create Pool
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowCreatePool(false)}
                      className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Pools List */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                      Staking Pools ({pools.length})
                    </h3>
                    <button
                      onClick={loadStakingPools}
                      disabled={poolsLoading}
                      className="flex items-center px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                    >
                      <RefreshCcw className={`w-4 h-4 mr-2 ${poolsLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>
                </div>

                {poolsLoading ? (
                  <div className="p-8 text-center">
                    <RefreshCcw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500 dark:text-gray-400">Loading pools...</p>
                  </div>
                ) : pools.length === 0 ? (
                  <div className="p-8 text-center">
                    <Coins className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500 dark:text-gray-400">No staking pools found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-600">
                    {pools.map((pool) => (
                      <div key={pool.poolId} className="p-6">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              {pool.stakeType === 0 ? (
                                <Coins className="w-5 h-5 text-green-600 dark:text-green-400" />
                              ) : (
                                <Gift className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                              )}
                              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                Pool #{pool.poolId}
                              </h4>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                pool.isActive 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}>
                                {pool.isActive ? 'Active' : 'Inactive'}
                              </span>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                pool.stakeType === 0
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                              }`}>
                                {pool.stakeType === 0 ? 'TOKEN' : 'NFT'}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Token Address</p>
                                <p className="font-mono text-xs text-gray-900 dark:text-gray-100 break-all">
                                  {pool.stakingToken}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Total Staked</p>
                                <p className="font-semibold text-gray-900 dark:text-gray-100">
                                  {parseFloat(pool.totalStaked).toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">APY</p>
                                <p className="font-semibold text-green-600 dark:text-green-400">
                                  {pool.apy.toFixed(1)}%
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Min Period</p>
                                <p className="font-semibold text-gray-900 dark:text-gray-100">
                                  {pool.minStakingPeriod}s
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="ml-4">
                            <button
                              onClick={() => togglePool(pool.poolId)}
                              className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                                pool.isActive
                                  ? 'bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900 dark:hover:bg-red-800 dark:text-red-200'
                                  : 'bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900 dark:hover:bg-green-800 dark:text-green-200'
                              }`}
                            >
                              {pool.isActive ? (
                                <>
                                  <ToggleRight className="w-4 h-4 mr-2" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <ToggleLeft className="w-4 h-4 mr-2" />
                                  Activate
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Contract Information */}
            <div className="mt-8 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                📋 Contract Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">MON Token:</p>
                  <p className="font-mono text-gray-900 dark:text-gray-100">{MON_TOKEN_ADDRESS}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Raffle Factory:</p>
                  <p className="font-mono text-gray-900 dark:text-gray-100">{RAFFLE_FACTORY_ADDRESS}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Staking Contract:</p>
                  <p className="font-mono text-gray-900 dark:text-gray-100">{STAKING_ADDRESS}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Platform Admin:</p>
                  <p className="font-mono text-gray-900 dark:text-gray-100">{PLATFORM_ADMIN_ADDRESS}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Current Fee Wallet:</p>
                  <p className="font-mono text-gray-900 dark:text-gray-100">{currentPlatformWallet}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  )
} 