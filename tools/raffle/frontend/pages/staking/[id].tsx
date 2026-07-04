import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { usePrivy } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import toast from 'react-hot-toast'
import { 
  Coins, 
  Gift, 
  TrendingUp, 
  ArrowLeft, 
  Plus, 
  Minus, 
  Loader2,
  CheckCircle,
  Clock,
  Info,
  Settings,
  Shield,
  Activity
} from 'lucide-react'
import { CONTRACTS, STAKING_ABI, ERC20_ABI, ERC721_ABI } from '@/utils/contracts'

interface PoolInfo {
  stakingToken: string
  totalStaked: string
  totalRewards: string
  minStakingPeriod: number
  isActive: boolean
  isNFTPool: boolean
}

interface UserStake {
  stakedAmount: string
  stakedNFTs: string[]
  pendingRewards: string
  stakingStartTime: number
  isActive: boolean
}

interface TokenInfo {
  address: string
  name: string
  symbol: string
  decimals: number
  balance: string
  logoURI?: string
}

interface NFTInfo {
  address: string
  name: string
  symbol: string
  balance: string
  tokenIds: string[]
  logoURI?: string
}

const APY_RATE = 5
const NFT_TOKEN_VALUE = 10000

export default function PoolDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const { authenticated, login } = usePrivy()
  
  const [pool, setPool] = useState<PoolInfo | null>(null)
  const [userStake, setUserStake] = useState<UserStake | null>(null)
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | NFTInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [stakeAmount, setStakeAmount] = useState('')
  const [unstakeAmount, setUnstakeAmount] = useState('')
  const [selectedNFTs, setSelectedNFTs] = useState<string[]>([])
  const [selectedUnstakeNFTs, setSelectedUnstakeNFTs] = useState<string[]>([])
  const [isStaking, setIsStaking] = useState(false)
  const [isUnstaking, setIsUnstaking] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)

  useEffect(() => {
    if (authenticated && id) {
      loadPoolData()
    }
  }, [authenticated, id])

  const loadPoolData = async () => {
    try {
      setLoading(true)
      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const signer = await provider.getSigner()
      const userAddress = await signer.getAddress()
      
      const stakingContract = new ethers.Contract(CONTRACTS.STAKING, STAKING_ABI, signer)
      const poolId = parseInt(id as string)
      
      // Get all pools and find the specific one
      const allPools = await stakingContract.getAllPools()
      if (poolId >= allPools.length) {
        router.push('/staking')
        return
      }
      
      const poolData = allPools[poolId]
      const userStakeData = await stakingContract.getUserStakeInfo(poolId, userAddress)
      
      const poolInfo: PoolInfo = {
        stakingToken: poolData.stakingToken,
        totalStaked: poolData.isNFTPool 
          ? poolData.totalStaked.toString() 
          : ethers.formatUnits(poolData.totalStaked, 18),
        totalRewards: ethers.formatUnits(poolData.totalRewards, 18),
        minStakingPeriod: Number(poolData.minStakingPeriod),
        isActive: poolData.isActive,
        isNFTPool: poolData.isNFTPool
      }
      
      const stake: UserStake = {
        stakedAmount: poolData.isNFTPool 
          ? userStakeData.stakedAmount.toString()
          : ethers.formatUnits(userStakeData.stakedAmount, 18),
        stakedNFTs: userStakeData.stakedNFTs.map((id: any) => id.toString()),
        pendingRewards: ethers.formatUnits(userStakeData.pendingRewards, 18),
        stakingStartTime: Number(userStakeData.stakingStartTime),
        isActive: userStakeData.isActive
      }
      
      // Load token/NFT info
      await loadTokenInfo(poolData.stakingToken, poolData.isNFTPool, signer, userAddress)
      
      setPool(poolInfo)
      setUserStake(stake)
      
    } catch (error) {
      console.error('Error loading pool data:', error)
      toast.error('Failed to load pool data')
      router.push('/staking')
    } finally {
      setLoading(false)
    }
  }

  const loadTokenInfo = async (tokenAddress: string, isNFT: boolean, signer: any, userAddress: string) => {
    try {
      if (isNFT) {
        // Try to get NFT info from MonAliens API first
        let foundInAPI = false
        
        try {
          const response = await fetch(
            `https://api.monaliens.xyz/api/magic-eden/monad-testnet/users/${userAddress}/tokens`
          )
          
          if (response.ok) {
            const data = await response.json()
            
            if (data.success && data.data.tokens) {
              // Find NFTs for this contract
              const nftItems = data.data.tokens.filter((item: any) => 
                item.token.contract.toLowerCase() === tokenAddress.toLowerCase()
              )
              
              if (nftItems.length > 0) {
                const tokenIds = nftItems.map((item: any) => item.token.tokenId)
                const firstItem = nftItems[0]
                
                setTokenInfo({
                  address: tokenAddress,
                  name: firstItem.token.collection.name || 'Unknown NFT',
                  symbol: firstItem.token.collection.symbol || 'NFT',
                  balance: tokenIds.length.toString(),
                  tokenIds,
                  logoURI: firstItem.token.image || firstItem.token.imageSmall
                } as NFTInfo)
                
                foundInAPI = true
              }
            }
          }
        } catch (apiError) {
          console.error('Error fetching NFTs from API, falling back to contract calls:', apiError)
        }
        
        // Fallback to contract calls if not found in API
        if (!foundInAPI) {
          const nftContract = new ethers.Contract(tokenAddress, ERC721_ABI, signer)
          const balance = await nftContract.balanceOf(userAddress)
          
          // Get owned token IDs
          const tokenIds = []
          const balanceNum = Number(balance)
          if (balanceNum > 0) {
            for (let i = 1; i <= 1000 && tokenIds.length < balanceNum; i++) {
              try {
                const owner = await nftContract.ownerOf(i)
                if (owner.toLowerCase() === userAddress.toLowerCase()) {
                  tokenIds.push(i.toString())
                }
              } catch {
                // Continue
              }
              if (tokenIds.length >= balanceNum) break
            }
          }
          
          // Try to get name/symbol
          let name = 'Unknown NFT'
          let symbol = 'NFT'
          try {
            name = await nftContract.name()
            symbol = await nftContract.symbol()
          } catch {
            // Use defaults
          }
          
          setTokenInfo({
            address: tokenAddress,
            name,
            symbol,
            balance: balance.toString(),
            tokenIds
          } as NFTInfo)
        }
      } else {
        // For tokens, only use MON token - no API needed
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer)
        const balance = await tokenContract.balanceOf(userAddress)
        
        // Try to get token details
        let name = 'MON Token'
        let symbol = 'MON'
        let decimals = 18
        try {
          name = await tokenContract.name()
          symbol = await tokenContract.symbol()
          decimals = await tokenContract.decimals()
        } catch {
          // Use defaults
        }
        
        setTokenInfo({
          address: tokenAddress,
          name,
          symbol,
          decimals,
          balance: ethers.formatUnits(balance, decimals)
        } as TokenInfo)
      }
    } catch (error) {
      console.error('Error loading token info:', error)
    }
  }

  const handleStakeTokens = async () => {
    if (!stakeAmount || isStaking || !pool || !tokenInfo) return
    
    try {
      setIsStaking(true)
      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const signer = await provider.getSigner()
      
      const stakingContract = new ethers.Contract(CONTRACTS.STAKING, STAKING_ABI, signer)
      const tokenContract = new ethers.Contract(pool.stakingToken, ERC20_ABI, signer)
      
      const amount = ethers.parseUnits(stakeAmount, (tokenInfo as TokenInfo).decimals)
      
      // Check allowance
      const allowance = await tokenContract.allowance(await signer.getAddress(), CONTRACTS.STAKING)
      if (allowance < amount) {
        toast.loading('Approving tokens...')
        const approveTx = await tokenContract.approve(CONTRACTS.STAKING, amount)
        await approveTx.wait()
        toast.dismiss()
      }
      
      // Stake tokens
      toast.loading('Staking tokens...')
      const stakeTx = await stakingContract.stakeTokens(pool.stakingToken, amount)
      await stakeTx.wait()
      
      toast.dismiss()
      toast.success('Tokens staked successfully!')
      setStakeAmount('')
      await loadPoolData()
      
    } catch (error: any) {
      console.error('Staking failed:', error)
      toast.dismiss()
      toast.error(error.reason || 'Staking failed. Please try again.')
    } finally {
      setIsStaking(false)
    }
  }

  const handleStakeNFTs = async () => {
    if (selectedNFTs.length === 0 || isStaking || !pool) return
    
    try {
      setIsStaking(true)
      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const signer = await provider.getSigner()
      
      const stakingContract = new ethers.Contract(CONTRACTS.STAKING, STAKING_ABI, signer)
      const nftContract = new ethers.Contract(pool.stakingToken, ERC721_ABI, signer)
      
      // Check approvals
      const userAddress = await signer.getAddress()
      const isApprovedForAll = await nftContract.isApprovedForAll(userAddress, CONTRACTS.STAKING)
      
      if (!isApprovedForAll) {
        toast.loading('Approving NFTs...')
        const approveTx = await nftContract.setApprovalForAll(CONTRACTS.STAKING, true)
        await approveTx.wait()
        toast.dismiss()
      }
      
      // Stake NFTs
      toast.loading('Staking NFTs...')
      const tokenIds = selectedNFTs.map(id => parseInt(id))
      const stakeTx = await stakingContract.stakeNFTs(pool.stakingToken, tokenIds)
      await stakeTx.wait()
      
      toast.dismiss()
      toast.success(`${selectedNFTs.length} NFTs staked successfully!`)
      setSelectedNFTs([])
      await loadPoolData()
      
    } catch (error: any) {
      console.error('NFT staking failed:', error)
      toast.dismiss()
      toast.error(error.reason || 'NFT staking failed. Please try again.')
    } finally {
      setIsStaking(false)
    }
  }

  const handleUnstakeTokens = async () => {
    if (!unstakeAmount || isUnstaking || !pool || !tokenInfo) return
    
    try {
      setIsUnstaking(true)
      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const signer = await provider.getSigner()
      
      const stakingContract = new ethers.Contract(CONTRACTS.STAKING, STAKING_ABI, signer)
      const amount = ethers.parseUnits(unstakeAmount, (tokenInfo as TokenInfo).decimals)
      
      toast.loading('Unstaking tokens...')
      const unstakeTx = await stakingContract.unstakeTokens(pool.stakingToken, amount)
      await unstakeTx.wait()
      
      toast.dismiss()
      toast.success('Tokens unstaked successfully!')
      setUnstakeAmount('')
      await loadPoolData()
      
    } catch (error: any) {
      console.error('Unstaking failed:', error)
      toast.dismiss()
      toast.error(error.reason || 'Unstaking failed. Please try again.')
    } finally {
      setIsUnstaking(false)
    }
  }

  const handleUnstakeNFTs = async () => {
    if (selectedUnstakeNFTs.length === 0 || isUnstaking || !pool) return
    
    try {
      setIsUnstaking(true)
      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const signer = await provider.getSigner()
      
      const stakingContract = new ethers.Contract(CONTRACTS.STAKING, STAKING_ABI, signer)
      
      toast.loading('Unstaking NFTs...')
      const unstakeTx = await stakingContract.unstakeNFTs(pool.stakingToken, selectedUnstakeNFTs.map(id => parseInt(id)))
      await unstakeTx.wait()
      
      toast.dismiss()
      toast.success(`${selectedUnstakeNFTs.length} NFTs unstaked successfully!`)
      setSelectedUnstakeNFTs([])
      await loadPoolData()
      
    } catch (error: any) {
      console.error('NFT unstaking failed:', error)
      toast.dismiss()
      toast.error(error.reason || 'NFT unstaking failed. Please try again.')
    } finally {
      setIsUnstaking(false)
    }
  }

  const handleClaimRewards = async () => {
    if (isClaiming || !pool) return
    
    try {
      setIsClaiming(true)
      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const signer = await provider.getSigner()
      
      const stakingContract = new ethers.Contract(CONTRACTS.STAKING, STAKING_ABI, signer)
      
      toast.loading('Claiming rewards...')
      const claimTx = await stakingContract.claimRewards(parseInt(id as string))
      await claimTx.wait()
      
      toast.dismiss()
      toast.success('Rewards claimed successfully!')
      await loadPoolData()
      
    } catch (error: any) {
      console.error('Claiming rewards failed:', error)
      toast.dismiss()
      toast.error(error.reason || 'Claiming rewards failed. Please try again.')
    } finally {
      setIsClaiming(false)
    }
  }

  const formatTimeRemaining = (stakingStartTime: number, minPeriod: number) => {
    if (stakingStartTime === 0) return 'Not staking'
    
    const endTime = stakingStartTime + minPeriod
    const now = Math.floor(Date.now() / 1000)
    const remaining = endTime - now
    
    if (remaining <= 0) return 'Can unstake'
    
    const hours = Math.floor(remaining / 3600)
    const minutes = Math.floor((remaining % 3600) / 60)
    
    return `${hours}h ${minutes}m remaining`
  }

  const canUnstake = () => {
    if (!userStake || !pool) return false
    return Date.now() / 1000 >= userStake.stakingStartTime + pool.minStakingPeriod
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div 
          className="text-center p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Shield className="w-16 h-16 mx-auto mb-4 text-blue-400" />
          <h1 className="text-2xl font-bold text-white mb-4">Authentication Required</h1>
          <p className="text-gray-400 mb-6">Connect your wallet to manage your staking positions</p>
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
          <p className="text-gray-400">Loading pool details...</p>
        </motion.div>
      </div>
    )
  }

  if (!pool || !tokenInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div 
          className="text-center p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Info className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
          <h1 className="text-2xl font-bold text-white mb-4">Pool Not Found</h1>
          <p className="text-gray-400 mb-6">The requested staking pool could not be found</p>
          <Link 
            href="/staking"
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300"
          >
            Back to Staking
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{tokenInfo.name} Staking Pool - Web3 Raffle</title>
        <meta name="description" content={`Stake ${tokenInfo.name} and earn 5% APY rewards`} />
      </Head>

      <div className="min-h-screen py-8 px-4 relative">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-pink-900/20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="max-w-4xl mx-auto relative">
          {/* Header */}
          <motion.div 
            className="flex items-center gap-4 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Link 
              href="/staking"
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-300"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </Link>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                pool.isNFTPool 
                  ? 'bg-gradient-to-br from-purple-500 to-pink-600' 
                  : 'bg-gradient-to-br from-green-500 to-blue-600'
              }`}>
                {pool.isNFTPool ? <Gift className="w-6 h-6 text-white" /> : <Coins className="w-6 h-6 text-white" />}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">{tokenInfo.name} Pool</h1>
                <p className="text-gray-400">Pool #{id} • {tokenInfo.symbol} • {pool.isNFTPool ? 'NFT' : 'Token'} Staking</p>
              </div>
            </div>
          </motion.div>

          {/* Pool Stats */}
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-center">
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-400" />
              <h4 className="text-sm font-semibold text-white">APY</h4>
              <p className="text-xl font-bold text-green-400">{APY_RATE}%</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-center">
              <Activity className="w-6 h-6 mx-auto mb-2 text-blue-400" />
              <h4 className="text-sm font-semibold text-white">Total Staked</h4>
              <p className="text-xl font-bold text-blue-400">
                {pool.isNFTPool ? `${pool.totalStaked} NFTs` : `${parseFloat(pool.totalStaked).toFixed(0)}`}
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-center">
              <Gift className="w-6 h-6 mx-auto mb-2 text-purple-400" />
              <h4 className="text-sm font-semibold text-white">Rewards Pool</h4>
              <p className="text-xl font-bold text-purple-400">{parseFloat(pool.totalRewards).toFixed(0)} MON</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-center">
              <Clock className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
              <h4 className="text-sm font-semibold text-white">Min Period</h4>
              <p className="text-xl font-bold text-yellow-400">{pool.minStakingPeriod / 3600}h</p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Stake Section */}
            <motion.div 
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Plus className="w-6 h-6 text-green-400" />
                Stake {tokenInfo.symbol}
              </h2>

              {/* Available Balance */}
              <div className="bg-white/5 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-400">Available Balance</p>
                <p className="text-xl font-bold text-white">
                  {pool.isNFTPool 
                    ? `${(tokenInfo as NFTInfo).balance} NFTs` 
                    : `${parseFloat((tokenInfo as TokenInfo).balance).toFixed(2)} ${tokenInfo.symbol}`
                  }
                </p>
              </div>

              {pool.isNFTPool ? (
                /* NFT Staking */
                <div className="space-y-4">
                  {(tokenInfo as NFTInfo).tokenIds.length > 0 ? (
                    <>
                      <div>
                        <h4 className="text-lg font-semibold text-white mb-3">Select NFTs to Stake:</h4>
                        <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 bg-white/5 rounded-lg">
                          {(tokenInfo as NFTInfo).tokenIds.map(id => (
                            <button
                              key={id}
                              onClick={() => {
                                if (selectedNFTs.includes(id)) {
                                  setSelectedNFTs(selectedNFTs.filter(nftId => nftId !== id))
                                } else {
                                  setSelectedNFTs([...selectedNFTs, id])
                                }
                              }}
                              className={`p-3 text-sm rounded-lg border transition-all ${
                                selectedNFTs.includes(id)
                                  ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                                  : 'bg-white/5 border-white/20 text-gray-400 hover:border-purple-500/50'
                              }`}
                            >
                              #{id}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {selectedNFTs.length > 0 && (
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                          <p className="text-sm text-purple-400">
                            Selected: {selectedNFTs.length} NFTs • Effective Value: {(selectedNFTs.length * NFT_TOKEN_VALUE).toLocaleString()} tokens
                          </p>
                        </div>
                      )}

                      <button
                        onClick={handleStakeNFTs}
                        disabled={selectedNFTs.length === 0 || isStaking || !pool.isActive}
                        className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isStaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Stake {selectedNFTs.length} NFT{selectedNFTs.length !== 1 ? 's' : ''}
                      </button>
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <Gift className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No NFTs available to stake</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Token Staking */
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Amount to Stake</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                        placeholder="0.0"
                        max={(tokenInfo as TokenInfo).balance}
                      />
                      <button
                        onClick={() => setStakeAmount((tokenInfo as TokenInfo).balance)}
                        className="px-4 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
                      >
                        Max
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleStakeTokens}
                    disabled={!stakeAmount || isStaking || !pool.isActive}
                    className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-blue-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-blue-700 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isStaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Stake Tokens
                  </button>
                </div>
              )}
            </motion.div>

            {/* Manage Position Section */}
            <motion.div 
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Settings className="w-6 h-6 text-blue-400" />
                Your Position
              </h2>

              {userStake?.isActive ? (
                <div className="space-y-6">
                  {/* Current Position */}
                  <div className={`p-4 rounded-lg ${
                    pool.isNFTPool 
                      ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20' 
                      : 'bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20'
                  }`}>
                    <h4 className="text-lg font-semibold text-white mb-2">Staked Amount</h4>
                    <p className="text-2xl font-bold text-white">
                      {pool.isNFTPool ? `${userStake.stakedAmount} NFTs` : `${parseFloat(userStake.stakedAmount).toFixed(2)} ${tokenInfo.symbol}`}
                    </p>
                    {pool.isNFTPool && (
                      <p className="text-sm text-purple-400">
                        Effective Value: {(parseInt(userStake.stakedAmount) * NFT_TOKEN_VALUE).toLocaleString()} tokens
                      </p>
                    )}
                  </div>

                  {/* Pending Rewards */}
                  <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 p-4 rounded-lg">
                    <h4 className="text-lg font-semibold text-white mb-2">Pending Rewards</h4>
                    <p className="text-2xl font-bold text-yellow-400">{parseFloat(userStake.pendingRewards).toFixed(4)} MON</p>
                    <p className="text-sm text-gray-400">Lock Status: {formatTimeRemaining(userStake.stakingStartTime, pool.minStakingPeriod)}</p>
                  </div>

                  {/* Claim Rewards */}
                  {parseFloat(userStake.pendingRewards) > 0 && (
                    <button
                      onClick={handleClaimRewards}
                      disabled={isClaiming}
                      className="w-full px-4 py-3 bg-gradient-to-r from-yellow-500 to-orange-600 text-white font-semibold rounded-lg hover:from-yellow-600 hover:to-orange-700 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isClaiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                      Claim {parseFloat(userStake.pendingRewards).toFixed(4)} MON
                    </button>
                  )}

                  {/* Unstaking Section */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Minus className="w-5 h-5 text-red-400" />
                      Unstake
                    </h4>

                    {pool.isNFTPool ? (
                      /* NFT Unstaking */
                      userStake.stakedNFTs.length > 0 && (
                        <div className="space-y-4">
                          <div>
                            <h5 className="text-sm font-semibold text-gray-300 mb-2">Staked NFTs:</h5>
                            <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto p-2 bg-white/5 rounded-lg">
                              {userStake.stakedNFTs.map(id => (
                                <button
                                  key={id}
                                  onClick={() => {
                                    if (selectedUnstakeNFTs.includes(id)) {
                                      setSelectedUnstakeNFTs(selectedUnstakeNFTs.filter(nftId => nftId !== id))
                                    } else {
                                      setSelectedUnstakeNFTs([...selectedUnstakeNFTs, id])
                                    }
                                  }}
                                  disabled={!canUnstake()}
                                  className={`p-2 text-xs rounded border transition-all disabled:opacity-50 ${
                                    selectedUnstakeNFTs.includes(id)
                                      ? 'bg-red-500/20 border-red-500 text-red-400'
                                      : 'bg-green-500/20 border-green-500 text-green-400 hover:border-red-500/50'
                                  }`}
                                >
                                  #{id}
                                </button>
                              ))}
                            </div>
                          </div>

                          <button
                            onClick={handleUnstakeNFTs}
                            disabled={selectedUnstakeNFTs.length === 0 || isUnstaking || !canUnstake()}
                            className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white font-semibold rounded-lg hover:from-red-600 hover:to-pink-700 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {isUnstaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Minus className="w-4 h-4" />}
                            Unstake {selectedUnstakeNFTs.length} NFT{selectedUnstakeNFTs.length !== 1 ? 's' : ''}
                          </button>
                        </div>
                      )
                    ) : (
                      /* Token Unstaking */
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">Amount to Unstake</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={unstakeAmount}
                              onChange={(e) => setUnstakeAmount(e.target.value)}
                              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
                              placeholder="0.0"
                              max={userStake.stakedAmount}
                              disabled={!canUnstake()}
                            />
                            <button
                              onClick={() => setUnstakeAmount(userStake.stakedAmount)}
                              disabled={!canUnstake()}
                              className="px-4 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all disabled:opacity-50"
                            >
                              Max
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={handleUnstakeTokens}
                          disabled={!unstakeAmount || isUnstaking || !canUnstake()}
                          className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white font-semibold rounded-lg hover:from-red-600 hover:to-pink-700 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isUnstaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Minus className="w-4 h-4" />}
                          Unstake Tokens
                        </button>
                      </div>
                    )}

                    {!canUnstake() && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                        <p className="text-sm text-yellow-400 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {formatTimeRemaining(userStake.stakingStartTime, pool.minStakingPeriod)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Activity className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h4 className="text-lg font-semibold mb-2">No Active Position</h4>
                  <p className="text-sm">Start staking to see your position details here</p>
                </div>
              )}
            </motion.div>
          </div>

          {/* Info Section */}
          <motion.div 
            className="mt-8 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-start gap-3">
              <Info className="w-6 h-6 text-blue-400 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-blue-400 mb-2">Pool Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                  <div>
                    <p>• Fixed {APY_RATE}% APY for all staked assets</p>
                    <p>• Minimum staking period: {pool.minStakingPeriod / 3600} hours</p>
                    <p>• Rewards calculated continuously</p>
                  </div>
                  <div>
                    {pool.isNFTPool && <p>• Each NFT valued at {NFT_TOKEN_VALUE.toLocaleString()} tokens</p>}
                    <p>• Pool Status: {pool.isActive ? 'Active' : 'Inactive'}</p>
                    <p>• Token Address: {pool.stakingToken.slice(0, 10)}...{pool.stakingToken.slice(-8)}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  )
} 