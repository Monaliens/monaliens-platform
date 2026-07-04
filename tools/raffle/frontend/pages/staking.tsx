import { useState, useEffect } from 'react'
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
  Lock, 
  Unlock, 
  Plus, 
  Minus, 
  Info, 
  AlertCircle,
  Loader2,
  Shield,
  Settings,
  ExternalLink,
  ChevronRight,
  Users,
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
  isNative?: boolean
}

interface NFTInfo {
  address: string
  name: string
  symbol: string
  balance: string
  tokenIds: string[]
  logoURI?: string
}

const APY_RATE = 5 // Fixed 5% APY
const NFT_TOKEN_VALUE = 10000 // Each NFT = 10k tokens

export default function StakingPage() {
  const { authenticated, login } = usePrivy()
  
  const [pools, setPools] = useState<PoolInfo[]>([])
  const [userStakes, setUserStakes] = useState<{ [key: number]: UserStake }>({})
  const [availableTokens, setAvailableTokens] = useState<TokenInfo[]>([])
  const [availableNFTs, setAvailableNFTs] = useState<NFTInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [whitelistEnabled, setWhitelistEnabled] = useState(false)
  const [contractStats, setContractStats] = useState({
    totalPools: 0,
    totalStakedTokens: '0',
    totalStakedNFTs: '0',
    totalRewardTokens: '0'
  })

  useEffect(() => {
    if (authenticated) {
      loadStakingData()
      loadUserAssets()
      // Refresh data every 30 seconds
      const interval = setInterval(() => {
        loadStakingData()
        loadUserAssets()
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [authenticated])

  const loadUserAssets = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const signer = await provider.getSigner()
      const userAddress = await signer.getAddress()

      let tokens: TokenInfo[] = []
      let nfts: NFTInfo[] = []

      // Only use MON token, fetch all NFTs from API
      
      // Add MON token (our main staking token)
      const monContract = new ethers.Contract(CONTRACTS.MON_TOKEN, ERC20_ABI, signer)
      const monBalance = await monContract.balanceOf(userAddress)
      tokens.push({
        address: CONTRACTS.MON_TOKEN,
        name: 'MON Token',
        symbol: 'MON',
        decimals: 18,
        balance: ethers.formatUnits(monBalance, 18)
      })

      // Fetch all NFTs from MonAliens API
      try {
        const nftResponse = await fetch(
          `https://api.monaliens.xyz/api/magic-eden/monad-testnet/users/${userAddress}/tokens`
        )
        
        if (nftResponse.ok) {
          const nftData = await nftResponse.json()
          
          if (nftData.success && nftData.data.tokens) {
            // Group NFTs by collection
            const nftsByCollection = new Map<string, any[]>()
            
            nftData.data.tokens.forEach((item: any) => {
              const contract = item.token.contract.toLowerCase()
              if (!nftsByCollection.has(contract)) {
                nftsByCollection.set(contract, [])
              }
              nftsByCollection.get(contract)!.push(item.token.tokenId)
            })
            
            // Process ERC721 NFTs
            Array.from(nftsByCollection.entries()).forEach(([contract, tokenIds]) => {
              const firstToken = nftData.data.tokens.find((item: any) => 
                item.token.contract.toLowerCase() === contract
              )
              
              if (firstToken) {
                nfts.push({
                  address: contract,
                  name: firstToken.token.collection.name || 'Unknown Collection',
                  symbol: firstToken.token.collection.symbol || 'NFT',
                  balance: tokenIds.length.toString(),
                  tokenIds: tokenIds,
                  logoURI: firstToken.token.image || firstToken.token.imageSmall
                })
              }
            })
          }
        }
        
        console.log(`Loaded ${nfts.length} NFT collections from API`)
      } catch (error) {
        console.error('Error fetching NFTs from API:', error)
      }

      // Always include TestNFT if not already loaded from API
      const testNFTExists = nfts.find(n => n.address.toLowerCase() === CONTRACTS.TEST_NFT.toLowerCase())
      if (!testNFTExists) {
        const nftContract = new ethers.Contract(CONTRACTS.TEST_NFT, ERC721_ABI, signer)
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
              // Token doesn't exist or not owned
            }
            if (tokenIds.length >= balanceNum) break
          }
        }

        if (balanceNum > 0) {
          nfts.push({
            address: CONTRACTS.TEST_NFT,
            name: 'TestNFT',
            symbol: 'TNFT',
            balance: balance.toString(),
            tokenIds
          })
        }
      }

      setAvailableTokens(tokens)
      setAvailableNFTs(nfts)
      
    } catch (error) {
      console.error('Error loading user assets:', error)
      // Fallback to basic loading
      loadBasicAssets()
    }
  }

  const loadBasicAssets = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const signer = await provider.getSigner()
      const userAddress = await signer.getAddress()

      // Load MON token
      const monContract = new ethers.Contract(CONTRACTS.MON_TOKEN, ERC20_ABI, signer)
      const monBalance = await monContract.balanceOf(userAddress)
      
      // Load TestNFT
      const nftContract = new ethers.Contract(CONTRACTS.TEST_NFT, ERC721_ABI, signer)
      const nftBalance = await nftContract.balanceOf(userAddress)
      
      const tokenIds = []
      const nftBalanceNum = Number(nftBalance)
      if (nftBalanceNum > 0) {
        for (let i = 1; i <= 1000 && tokenIds.length < nftBalanceNum; i++) {
          try {
            const owner = await nftContract.ownerOf(i)
            if (owner.toLowerCase() === userAddress.toLowerCase()) {
              tokenIds.push(i.toString())
            }
          } catch {
            // Continue
          }
          if (tokenIds.length >= nftBalanceNum) break
        }
      }

      setAvailableTokens([{
        address: CONTRACTS.MON_TOKEN,
        name: 'MON Token',
        symbol: 'MON',
        decimals: 18,
        balance: ethers.formatUnits(monBalance, 18)
      }])

      setAvailableNFTs([{
        address: CONTRACTS.TEST_NFT,
        name: 'TestNFT',
        symbol: 'TNFT',
        balance: nftBalance.toString(),
        tokenIds
      }])

    } catch (error) {
      console.error('Error loading basic assets:', error)
    }
  }

  const loadStakingData = async () => {
    try {
      setLoading(true)
      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const signer = await provider.getSigner()
      const userAddress = await signer.getAddress()
      
      const stakingContract = new ethers.Contract(CONTRACTS.STAKING, STAKING_ABI, signer)
      
      // Get whitelist status
      const whitelistStatus = await stakingContract.whitelistEnabled()
      setWhitelistEnabled(whitelistStatus)
      
      // Load all pools
      const allPools = await stakingContract.getAllPools()
      const poolsData: PoolInfo[] = []
      const stakesData: { [key: number]: UserStake } = {}
      
      for (let i = 0; i < allPools.length; i++) {
        try {
          const poolInfo = allPools[i]
          const userStake = await stakingContract.getUserStakeInfo(i, userAddress)
          
          poolsData.push({
            stakingToken: poolInfo.stakingToken,
            totalStaked: poolInfo.isNFTPool 
              ? poolInfo.totalStaked.toString() 
              : ethers.formatUnits(poolInfo.totalStaked, 18),
            totalRewards: ethers.formatUnits(poolInfo.totalRewards, 18),
            minStakingPeriod: Number(poolInfo.minStakingPeriod),
            isActive: poolInfo.isActive,
            isNFTPool: poolInfo.isNFTPool
          })
          
          stakesData[i] = {
            stakedAmount: poolInfo.isNFTPool 
              ? userStake.stakedAmount.toString()
              : ethers.formatUnits(userStake.stakedAmount, 18),
            stakedNFTs: userStake.stakedNFTs.map((id: any) => id.toString()),
            pendingRewards: ethers.formatUnits(userStake.pendingRewards, 18),
            stakingStartTime: Number(userStake.stakingStartTime),
            isActive: userStake.isActive
          }
        } catch (error) {
          console.error(`Error loading pool ${i}:`, error)
        }
      }
      
      // Get contract stats
      const stats = await stakingContract.getContractStats()
      setContractStats({
        totalPools: Number(stats[0]),
        totalStakedTokens: ethers.formatUnits(stats[1], 18),
        totalStakedNFTs: stats[2].toString(),
        totalRewardTokens: ethers.formatUnits(stats[3], 18)
      })
      
      setPools(poolsData)
      setUserStakes(stakesData)
      
    } catch (error) {
      console.error('Error loading staking data:', error)
      toast.error('Failed to load staking data')
    } finally {
      setLoading(false)
    }
  }

  const getTokenInfo = (address: string) => {
    return availableTokens.find(t => t.address.toLowerCase() === address.toLowerCase()) ||
           availableNFTs.find(n => n.address.toLowerCase() === address.toLowerCase())
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

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div 
          className="text-center p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Coins className="w-16 h-16 mx-auto mb-4 text-green-400" />
          <h1 className="text-2xl font-bold text-white mb-4">Enhanced Staking Platform</h1>
          <p className="text-gray-400 mb-6">Connect your wallet to start earning rewards from any token or NFT</p>
          <button 
            onClick={login} 
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-blue-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-blue-700 transition-all duration-300"
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
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading staking pools...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Enhanced Staking Platform - Web3 Raffle</title>
        <meta name="description" content="Stake any token or NFT collection to earn 5% APY rewards" />
      </Head>

      <div className="min-h-screen py-8 px-4 relative">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/20 via-blue-900/20 to-purple-900/20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="max-w-7xl mx-auto relative">
          {/* Header */}
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              Enhanced Staking Platform
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-4">
              Stake any token or NFT collection and earn 5% APY rewards
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-green-400 font-semibold">Fixed 5% APY</span>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <Gift className="w-4 h-4 text-purple-400" />
                <span className="text-purple-400 font-semibold">NFT = 10k tokens</span>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <Shield className={`w-4 h-4 ${whitelistEnabled ? 'text-yellow-400' : 'text-blue-400'}`} />
                <span className={`font-semibold ${whitelistEnabled ? 'text-yellow-400' : 'text-blue-400'}`}>
                  {whitelistEnabled ? 'Whitelist: Enabled' : 'All Tokens: Accepted'}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Global Stats */}
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-center">
              <Settings className="w-6 h-6 mx-auto mb-2 text-blue-400" />
              <h4 className="text-sm font-semibold text-white">Total Pools</h4>
              <p className="text-xl font-bold text-blue-400">{contractStats.totalPools}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-center">
              <Coins className="w-6 h-6 mx-auto mb-2 text-green-400" />
              <h4 className="text-sm font-semibold text-white">Staked Tokens</h4>
              <p className="text-xl font-bold text-green-400">{parseFloat(contractStats.totalStakedTokens).toFixed(0)}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-center">
              <Gift className="w-6 h-6 mx-auto mb-2 text-purple-400" />
              <h4 className="text-sm font-semibold text-white">Staked NFTs</h4>
              <p className="text-xl font-bold text-purple-400">{contractStats.totalStakedNFTs}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-center">
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
              <h4 className="text-sm font-semibold text-white">APY</h4>
              <p className="text-xl font-bold text-yellow-400">{APY_RATE}%</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-center">
              <Activity className="w-6 h-6 mx-auto mb-2 text-cyan-400" />
              <h4 className="text-sm font-semibold text-white">Rewards Pool</h4>
              <p className="text-xl font-bold text-cyan-400">{parseFloat(contractStats.totalRewardTokens).toFixed(0)}</p>
            </div>
          </motion.div>

          {/* Available Pools Grid */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
              <Settings className="w-8 h-8 text-blue-400" />
              Available Staking Pools
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pools.map((pool, index) => {
                const tokenInfo = getTokenInfo(pool.stakingToken)
                const stake = userStakes[index]
                
                return (
                  <div key={index} className="group bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300">
                    {/* Pool Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          pool.isNFTPool 
                            ? 'bg-gradient-to-br from-purple-500 to-pink-600' 
                            : 'bg-gradient-to-br from-green-500 to-blue-600'
                        }`}>
                          {pool.isNFTPool ? <Gift className="w-6 h-6 text-white" /> : <Coins className="w-6 h-6 text-white" />}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">{tokenInfo?.name || 'Unknown Token'}</h3>
                          <p className="text-sm text-gray-400">{tokenInfo?.symbol} • Pool #{index}</p>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        pool.isActive 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {pool.isActive ? 'Active' : 'Inactive'}
                      </div>
                    </div>

                    {/* Pool Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-xs text-gray-400">APY</p>
                        <p className="text-lg font-bold text-green-400">{APY_RATE}%</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-xs text-gray-400">Total Staked</p>
                        <p className="text-lg font-bold text-white">
                          {pool.isNFTPool ? `${pool.totalStaked} NFTs` : `${parseFloat(pool.totalStaked).toFixed(0)}`}
                        </p>
                      </div>
                    </div>

                    {/* User Position */}
                    {stake?.isActive && (
                      <div className={`p-3 rounded-lg mb-4 ${
                        pool.isNFTPool 
                          ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20' 
                          : 'bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20'
                      }`}>
                        <p className="text-xs text-gray-400">Your Position</p>
                        <p className="text-sm font-semibold text-white">
                          {pool.isNFTPool ? `${stake.stakedAmount} NFTs` : `${parseFloat(stake.stakedAmount).toFixed(2)} ${tokenInfo?.symbol}`}
                        </p>
                        <p className="text-xs text-green-400">Rewards: {parseFloat(stake.pendingRewards).toFixed(4)} MON</p>
                      </div>
                    )}

                    {/* Available Balance */}
                    {tokenInfo && (
                      <div className="bg-white/5 rounded-lg p-3 mb-4">
                        <p className="text-xs text-gray-400">Available Balance</p>
                        <p className="text-sm font-semibold text-white">
                          {pool.isNFTPool 
                            ? `${(tokenInfo as NFTInfo).balance} NFTs` 
                            : `${parseFloat((tokenInfo as TokenInfo).balance).toFixed(2)} ${tokenInfo.symbol}`
                          }
                        </p>
                      </div>
                    )}

                    {/* Action Button */}
                    <Link 
                      href={`/staking/${index}`}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300 group-hover:scale-105"
                    >
                      <span>Manage Stake</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                )
              })}
            </div>
          </motion.div>

          {/* Your Assets Section */}
          <motion.div 
            className="mt-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
              <Users className="w-8 h-8 text-cyan-400" />
              Your Assets
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tokens */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Coins className="w-6 h-6 text-green-400" />
                  Available Tokens ({availableTokens.length})
                </h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {availableTokens.map((token, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div>
                        <p className="font-semibold text-white">{token.name}</p>
                        <p className="text-sm text-gray-400">{token.symbol}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-white">{parseFloat(token.balance).toFixed(2)}</p>
                        <p className="text-xs text-gray-400">{token.symbol}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* NFTs */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Gift className="w-6 h-6 text-purple-400" />
                  Available NFTs ({availableNFTs.length})
                </h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {availableNFTs.map((nft, index) => (
                    <div key={index} className="p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold text-white">{nft.name}</p>
                          <p className="text-sm text-gray-400">{nft.symbol}</p>
                        </div>
                        <p className="font-semibold text-white">{nft.balance} NFTs</p>
                      </div>
                      {nft.tokenIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {nft.tokenIds.slice(0, 10).map(id => (
                            <span key={id} className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded">
                              #{id}
                            </span>
                          ))}
                          {nft.tokenIds.length > 10 && (
                            <span className="px-2 py-1 text-xs bg-gray-500/20 text-gray-400 rounded">
                              +{nft.tokenIds.length - 10} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Info Card */}
          <motion.div 
            className="mt-8 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-start gap-3">
              <Info className="w-6 h-6 text-blue-400 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-blue-400 mb-2">Enhanced Staking Information</h3>
                <ul className="text-gray-300 space-y-1 text-sm">
                  <li>• All pools offer fixed 5% APY regardless of token type</li>
                  <li>• Each NFT is valued at 10,000 tokens for reward calculation</li>
                  <li>• Pools are created automatically when you stake new tokens</li>
                  <li>• {whitelistEnabled ? 'Only whitelisted tokens can be staked' : 'Any token or NFT collection can be staked'}</li>
                  <li>• Minimum staking period: 24 hours for all pools</li>
                  <li>• Rewards are calculated continuously and can be claimed anytime</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  )
} 