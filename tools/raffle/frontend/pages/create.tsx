import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import { usePrivy } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import toast from 'react-hot-toast'
import { Coins, Image as ImageIcon, Clock, Users, Eye, DollarSign, Calendar, Sparkles, Ticket, Loader2 } from 'lucide-react'
import { CONTRACTS, RAFFLE_FACTORY_ABI, ERC20_ABI } from '@/utils/contracts'
import { getBlockchainConfig } from '@/utils/deployments'
import TokenSelector from '@/components/TokenSelector'
import { useWalletProvider } from '@/hooks/useWalletProvider'

// ERC721 ABI for NFT approval
const ERC721_ABI = [
  'function approve(address to, uint256 tokenId) external',
  'function getApproved(uint256 tokenId) external view returns (address)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function isApprovedForAll(address owner, address operator) external view returns (bool)',
  'function setApprovalForAll(address operator, bool approved) external'
]

interface UserNFT {
  token: {
    chainId: number
    contract: string
    tokenId: string
    kind: string
    name?: string
    image?: string
    imageSmall?: string
    imageLarge?: string
    description?: string
    collection: {
      id: string
      name: string
      imageUrl?: string
    }
  }
  ownership: {
    tokenCount: string
    acquiredAt: string
  }
}

export default function CreateRafflePage() {
  const { user, authenticated, login } = usePrivy()
  const { getProviderAndSigner } = useWalletProvider()
  const router = useRouter()
  
  // Get native token symbol from config
  const blockchainConfig = getBlockchainConfig()
  const nativeTokenSymbol = blockchainConfig.symbol
  
  const [formData, setFormData] = useState({
    prizeType: 'TOKEN' as 'TOKEN' | 'NFT',
    prizeContractAddress: CONTRACTS.MON_TOKEN,
    prizeTokenId: '0',
    prizeAmount: '100',
    ticketPrice: '5',
    ticketTokenAddress: CONTRACTS.MON_TOKEN,
    maxTicketsPerWallet: '10',
    maxTotalTickets: '100',
    duration: '24',
    participantsVisible: true,
    participantCountVisible: true
  })

  // Token selection states
  const [selectedPrizeToken, setSelectedPrizeToken] = useState<any>(null)
  const [selectedTicketToken, setSelectedTicketToken] = useState<any>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [userNFTs, setUserNFTs] = useState<UserNFT[]>([])
  const [loadingNFTs, setLoadingNFTs] = useState(false)
  const [selectedNFT, setSelectedNFT] = useState<UserNFT | null>(null)

  const availableTokens = [
    {
      symbol: 'MON',
      name: 'Monad Token',
      contractAddress: CONTRACTS.MON_TOKEN
    }
  ]

  const availableNFTs = [
    {
      name: 'Test NFT',
      contractAddress: CONTRACTS.TEST_NFT
    }
  ]

  const testDurations = [
    { label: '1 minute', value: '0.0166666667' },
    { label: '5 minutes', value: '0.0833333333' },
    { label: '1 hour', value: '1' },
    { label: '2 hours', value: '2' },
    { label: '6 hours', value: '6' },
    { label: '12 hours', value: '12' },
    { label: '24 hours', value: '24' },
    { label: '48 hours', value: '48' },
    { label: '7 days', value: '168' }
  ]

  const isPredefinedToken = (address: string) => {
    return availableTokens.some(
      token => token.contractAddress.toLowerCase() === address.toLowerCase()
    )
  }

  // Fetch user's NFTs from Monaliens API
  const fetchUserNFTs = async (userAddress: string) => {
    setLoadingNFTs(true)
    try {
      const response = await fetch(
        `https://api.monaliens.xyz/api/magic-eden/monad-testnet/users/${userAddress}/tokens`
      )
      
      if (!response.ok) {
        throw new Error('Failed to fetch NFTs')
      }
      
      const data = await response.json()
      
      if (data.success && data.data.tokens) {
        setUserNFTs(data.data.tokens)
        console.log(`Found ${data.data.tokens.length} NFTs for user:`, data.data.tokens)
      } else {
        setUserNFTs([])
      }
    } catch (error) {
      console.error('Error fetching NFTs:', error)
      toast.error('Failed to load your NFTs')
      setUserNFTs([])
    } finally {
      setLoadingNFTs(false)
    }
  }

  // Load user NFTs when wallet is connected
  useEffect(() => {
    if (authenticated && user?.wallet?.address) {
      fetchUserNFTs(user.wallet.address)
    }
  }, [authenticated, user?.wallet?.address])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handlePrizeTypeChange = (type: 'TOKEN' | 'NFT') => {
    setFormData(prev => ({
      ...prev,
      prizeType: type,
      prizeContractAddress: type === 'TOKEN' ? CONTRACTS.MON_TOKEN : CONTRACTS.TEST_NFT,
      prizeTokenId: type === 'NFT' ? '1' : '0',
      prizeAmount: type === 'TOKEN' ? '100' : '0'
    }))
    setSelectedNFT(null)
  }

  const handleNFTSelection = (nft: UserNFT) => {
    setSelectedNFT(nft)
    setFormData(prev => ({
      ...prev,
      prizeContractAddress: nft.token.contract,
      prizeTokenId: nft.token.tokenId
    }))
  }

  const handleCreateRaffle = async () => {
    if (!authenticated) {
      await login()
      return
    }

    // Duration validation (minimum 1 minute - contract requirement)
    const durationHours = parseFloat(formData.duration)
    if (durationHours < (1/60)) { // 1 minute = 1/60 hour
      toast.error('Duration must be at least 1 minute (contract requirement)')
      return
    }

    // Validate token selections
    if (!selectedPrizeToken && formData.prizeType === 'TOKEN') {
      toast.error('Please select a prize token')
      return
    }

    if (!selectedTicketToken) {
      toast.error('Please select a payment token for tickets')
      return
    }

    // Note: Native tokens are now supported as prizes after contract update

    // Validate amounts
    if (formData.prizeType === 'TOKEN') {
      const prizeAmount = parseFloat(formData.prizeAmount)
      if (prizeAmount <= 0) {
        toast.error('Prize amount must be greater than 0')
        return
      }
      
      // Check if user has enough balance
      if (selectedPrizeToken && selectedPrizeToken.balanceFormatted) {
        const availableBalance = parseFloat(selectedPrizeToken.balanceFormatted.replace(/,/g, ''))
        if (prizeAmount > availableBalance) {
          toast.error(`Insufficient balance. You have ${selectedPrizeToken.balanceFormatted} ${selectedPrizeToken.symbol}`)
          return
        }
      }
    }

    const ticketPrice = parseFloat(formData.ticketPrice)
    if (ticketPrice <= 0) {
      toast.error('Ticket price must be greater than 0')
      return
    }

    setIsLoading(true)
    try {
      const { ethers } = await import('ethers')
      
      // Get the correct provider and signer for the connected wallet
      const { provider, signer } = await getProviderAndSigner()

      // Convert duration to seconds (from hours)
      const durationInSeconds = Math.floor(parseFloat(formData.duration) * 3600)
      console.log(`Duration: ${formData.duration} hours = ${durationInSeconds} seconds`)

      // Prepare raffle parameters
      const prizeType = formData.prizeType === 'TOKEN' ? 0 : 1
      
      // Use selected token decimals for proper parsing
      const prizeTokenDecimals = selectedPrizeToken?.decimals || 18
      const ticketTokenDecimals = selectedTicketToken?.decimals || 18
      
      const prizeAmount = formData.prizeType === 'TOKEN' 
        ? ethers.parseUnits(formData.prizeAmount, prizeTokenDecimals)
        : 0
      const ticketPrice = ethers.parseUnits(formData.ticketPrice, ticketTokenDecimals)
      const prizeTokenId = formData.prizeType === 'NFT' ? formData.prizeTokenId : 0

      // Convert "native" address to zero address for contracts
      const prizeContractAddress = formData.prizeContractAddress.toLowerCase() === 'native' 
        ? ethers.ZeroAddress 
        : formData.prizeContractAddress
      const ticketTokenAddress = formData.ticketTokenAddress.toLowerCase() === 'native' 
        ? ethers.ZeroAddress 
        : formData.ticketTokenAddress

      console.log('Creating raffle with parameters:', {
        prizeType,
        prizeContractAddress,
        prizeTokenId,
        prizeAmount: prizeAmount.toString(),
        ticketPrice: ticketPrice.toString(),
        ticketTokenAddress,
        maxTicketsPerWallet: formData.maxTicketsPerWallet,
        maxTotalTickets: formData.maxTotalTickets,
        duration: durationInSeconds,
        participantsVisible: formData.participantsVisible,
        participantCountVisible: formData.participantCountVisible
      })

      // Production debug - test contract connectivity
      toast.loading(`Debug: Using contract ${CONTRACTS.RAFFLE_FACTORY.slice(0,10)}...`, { id: 'debug' })
      
      try {
        const factoryContract = new ethers.Contract(CONTRACTS.RAFFLE_FACTORY, RAFFLE_FACTORY_ABI, signer)
        const totalRaffles = await factoryContract.totalRaffles()
        toast.success(`Contract OK - Total raffles: ${totalRaffles.toString()}`, { id: 'debug' })
      } catch (contractError: any) {
        toast.error(`Contract Error: ${contractError?.message?.slice(0,60)}`, { id: 'debug', duration: 8000 })
        throw new Error('Cannot connect to contract. Please check network and contract address.')
      }

      // Handle approvals
      if (formData.prizeType === 'TOKEN') {
        // Check if it's a native token (no approval needed)
        const isNativeToken = formData.prizeContractAddress.toLowerCase() === 'native' || 
                             selectedPrizeToken?.isNative === true;
        
        if (!isNativeToken) {
          // Token approval for ERC20 tokens only
        const tokenContract = new ethers.Contract(
          formData.prizeContractAddress,
          ERC20_ABI,
          signer
        )

        console.log('Checking token allowance...')
        const currentAllowance = await tokenContract.allowance(await signer.getAddress(), CONTRACTS.RAFFLE_FACTORY)
        console.log('Current allowance:', ethers.formatUnits(currentAllowance, prizeTokenDecimals))

        if (currentAllowance < prizeAmount) {
          console.log('Approving tokens...')
          toast.loading('Approving tokens...')
          const approveTx = await tokenContract.approve(CONTRACTS.RAFFLE_FACTORY, prizeAmount)
          console.log('Approve transaction sent:', approveTx.hash)
          await approveTx.wait()
          console.log('Token approval confirmed')
          toast.dismiss()
          toast.success('Tokens approved!')
          }
        } else {
          console.log('Native token selected, no approval needed')
        }
      } else {
        // NFT approval
        const nftContract = new ethers.Contract(
          formData.prizeContractAddress,
          ERC721_ABI,
          signer
        )

        console.log('Checking NFT approval...')
        const approvedAddress = await nftContract.getApproved(prizeTokenId)
        const isApprovedForAll = await nftContract.isApprovedForAll(await signer.getAddress(), CONTRACTS.RAFFLE_FACTORY)
        
        console.log('Current approved address:', approvedAddress)
        console.log('Is approved for all:', isApprovedForAll)

        if (approvedAddress.toLowerCase() !== CONTRACTS.RAFFLE_FACTORY.toLowerCase() && !isApprovedForAll) {
          console.log('Approving NFT...')
          toast.loading('Approving NFT...')
          const approveTx = await nftContract.approve(CONTRACTS.RAFFLE_FACTORY, prizeTokenId)
          console.log('NFT approve transaction sent:', approveTx.hash)
          await approveTx.wait()
          console.log('NFT approval confirmed')
          toast.dismiss()
          toast.success('NFT approved!')
        } else {
          console.log('NFT already approved')
        }
      }

      // Get creation fee
      const factoryContract = new ethers.Contract(CONTRACTS.RAFFLE_FACTORY, RAFFLE_FACTORY_ABI, signer)
      const creationFee = await factoryContract.raffleCreationFee()
      console.log('Creation fee:', ethers.formatEther(creationFee), nativeTokenSymbol)

      // Calculate total value to send
      let totalValue = creationFee
      
      // If prize is native token, add prize amount to transaction value
      const isNativePrize = formData.prizeType === 'TOKEN' && 
                           (formData.prizeContractAddress.toLowerCase() === 'native' || 
                            selectedPrizeToken?.isNative === true)
      
      if (isNativePrize) {
        totalValue = totalValue + prizeAmount
        console.log('Native token prize detected, adding to transaction value:', ethers.formatEther(prizeAmount), nativeTokenSymbol)
      }
      
      console.log('Total transaction value:', ethers.formatEther(totalValue), nativeTokenSymbol)

      // Debug: Try to estimate gas first to get better error messages
      console.log('Estimating gas for transaction...')
      try {
        const gasEstimate = await factoryContract.createRaffle.estimateGas(
          prizeType,
          prizeContractAddress,
          prizeTokenId,
          prizeAmount,
          ticketPrice,
          ticketTokenAddress,
          formData.maxTicketsPerWallet,
          formData.maxTotalTickets,
          durationInSeconds,
          formData.participantsVisible,
          formData.participantCountVisible,
          {
            value: totalValue
          }
        )
        console.log('Gas estimate successful:', gasEstimate.toString())
             } catch (gasError: any) {
         console.error('Gas estimation failed:', gasError)
         
         // Production debug - show detailed error
         const debugMsg = `${gasError?.message?.slice(0,80) || 'Unknown gas error'} | Contract: ${CONTRACTS.RAFFLE_FACTORY.slice(-10)}`
         toast.error(debugMsg, { id: 'debug', duration: 8000 })
         
         // Try to extract more specific error from gas estimation
         if (gasError?.reason) {
           throw new Error(`Contract validation failed: ${gasError.reason}`)
         } else if (gasError?.message?.includes('execution reverted')) {
           // Check for common validation issues
           if (prizeContractAddress === ethers.ZeroAddress) {
             throw new Error('Native tokens cannot be used as prizes. Please select an ERC20 token for the prize.')
           }
           throw new Error('Contract validation failed. Please check your token selections and amounts.')
         }
         throw gasError
       }

      // Create raffle
      console.log('Creating raffle...')
      const tx = await factoryContract.createRaffle(
        prizeType,
        prizeContractAddress,
        prizeTokenId,
        prizeAmount,
        ticketPrice,
        ticketTokenAddress,
        formData.maxTicketsPerWallet,
        formData.maxTotalTickets,
        durationInSeconds,
        formData.participantsVisible,
        formData.participantCountVisible,
        {
          value: totalValue
        }
      )

      console.log('Transaction sent:', tx.hash)
      const receipt = await tx.wait()
      console.log('Transaction confirmed:', receipt.hash)

      toast.success(`Raffle created successfully! Transaction: ${receipt.hash}`)
      
      // Small delay to show toast before redirect
      setTimeout(() => {
        router.push('/raffles')
      }, 2000)


    } catch (error) {
      console.error('Error creating raffle:', error)
      let errorMessage = 'Unknown error occurred'
      
      if (error instanceof Error) {
        if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected by user'
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for transaction'
        } else if (error.message.includes('Duration too short')) {
          errorMessage = 'Duration is too short (minimum 1 minute)'
        } else if (error.message.includes('Duration too long')) {
          errorMessage = 'Duration is too long (maximum 30 days)'
        } else if (error.message.includes('UNCONFIGURED_NAME')) {
          errorMessage = 'Invalid contract address. Please select a valid token from the list.'
        } else if (error.message.includes('could not decode result data')) {
          errorMessage = 'Contract interaction failed. Please check token selection and try again.'
        } else if (error.message.includes('BAD_DATA')) {
          errorMessage = 'Invalid token data. Please select a different token.'
        } else {
          errorMessage = error.message
        }
      }
      
      toast.error(`Error creating raffle: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Create a Raffle
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Connect your wallet to create a new raffle
          </p>
          <button onClick={login} className="btn-primary">
            Connect Wallet
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Create Raffle - Web3 Raffle Platform</title>
        <meta name="description" content="Create a new raffle on our Web3 platform" />
      </Head>

      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                🎪 Create New Raffle
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Set up your raffle parameters and launch it on the blockchain
              </p>
            </div>

            {/* Form */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
              {/* Prize Type Selection */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Prize Type
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handlePrizeTypeChange('TOKEN')}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      formData.prizeType === 'TOKEN'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <Coins className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                    <div className="text-sm font-medium">Token Prize</div>
                  </button>
                  <button
                    onClick={() => handlePrizeTypeChange('NFT')}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      formData.prizeType === 'NFT'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                    <div className="text-sm font-medium">NFT Prize</div>
                  </button>
                </div>
              </div>

              {/* Prize Details */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Prize Details
                </h3>
                
                {formData.prizeType === 'TOKEN' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Prize Token
                      </label>
                      <TokenSelector
                        value={formData.prizeContractAddress}
                        onChange={(address, tokenData) => {
                          handleInputChange('prizeContractAddress', address)
                          setSelectedPrizeToken(tokenData)
                        }}
                        placeholder="Select prize token..."
                        showBalance={true}
                        className="w-full"
                      />
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Choose the token you want to give as a prize
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Prize Amount
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={formData.prizeAmount}
                          onChange={(e) => handleInputChange('prizeAmount', e.target.value)}
                          className="w-full px-3 py-2 pr-16 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter prize amount"
                          step="0.01"
                          min="0"
                        />
                        {selectedPrizeToken && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                            {selectedPrizeToken.symbol}
                          </div>
                        )}
                      </div>
                      {selectedPrizeToken?.balanceFormatted && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Available: {selectedPrizeToken.balanceFormatted} {selectedPrizeToken.symbol}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Select Your NFT
                      </label>
                      
                      {loadingNFTs ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading your NFTs...</span>
                        </div>
                      ) : userNFTs.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                          <p className="text-gray-600 dark:text-gray-400">No NFTs found in your wallet</p>
                          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                            You need to own an NFT to create an NFT raffle
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
                          {userNFTs.map((nft) => (
                            <div
                              key={`${nft.token.contract}-${nft.token.tokenId}`}
                              onClick={() => handleNFTSelection(nft)}
                              className={`relative cursor-pointer rounded-lg border-2 overflow-hidden transition-all hover:scale-105 ${
                                selectedNFT?.token.contract === nft.token.contract && selectedNFT?.token.tokenId === nft.token.tokenId
                                  ? 'border-purple-500 shadow-lg ring-2 ring-purple-200'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                              }`}
                            >
                              {/* NFT Image */}
                              <div className="aspect-square bg-gray-100 dark:bg-gray-700">
                                {nft.token.image || nft.token.imageSmall ? (
                                  <img
                                    src={nft.token.imageSmall || nft.token.image || ''}
                                    alt={nft.token.name || `Token #${nft.token.tokenId}`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <ImageIcon className="w-8 h-8 text-gray-400" />
                                  </div>
                                )}
                              </div>
                              
                              {/* NFT Info */}
                              <div className="p-3">
                                <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                                  {nft.token.name || `Token #${nft.token.tokenId}`}
                                </h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                  {nft.token.collection.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-500 font-mono">
                                  ID: {nft.token.tokenId}
                                </p>
                              </div>

                              {/* Selection Indicator */}
                              {selectedNFT?.token.contract === nft.token.contract && selectedNFT?.token.tokenId === nft.token.tokenId && (
                                <div className="absolute top-2 right-2 bg-purple-500 text-white rounded-full p-1">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Selected NFT Info */}
                      {selectedNFT && (
                        <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                          <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Selected NFT:</h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Name:</span>
                              <span className="ml-2 font-medium">{selectedNFT.token.name || `Token #${selectedNFT.token.tokenId}`}</span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Collection:</span>
                              <span className="ml-2 font-medium">{selectedNFT.token.collection.name}</span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Token ID:</span>
                              <span className="ml-2 font-mono">{selectedNFT.token.tokenId}</span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Contract:</span>
                              <span className="ml-2 font-mono text-xs">{selectedNFT.token.contract.slice(0, 10)}...{selectedNFT.token.contract.slice(-8)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Ticket Settings */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Ticket Settings
                </h3>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Payment Token
                    </label>
                    <TokenSelector
                      value={formData.ticketTokenAddress}
                      onChange={(address, tokenData) => {
                        handleInputChange('ticketTokenAddress', address)
                        setSelectedTicketToken(tokenData)
                      }}
                      placeholder="Select payment token..."
                      showBalance={true}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Token that participants will pay to buy tickets
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ticket Price
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formData.ticketPrice}
                        onChange={(e) => handleInputChange('ticketPrice', e.target.value)}
                        className="w-full px-3 py-2 pr-16 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Enter ticket price"
                        step="0.01"
                        min="0"
                      />
                      {selectedTicketToken && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                          {selectedTicketToken.symbol}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Amount users need to pay per ticket
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Max Tickets per Wallet
                    </label>
                    <input
                      type="number"
                      value={formData.maxTicketsPerWallet}
                      onChange={(e) => handleInputChange('maxTicketsPerWallet', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Enter max tickets per wallet"
                      min="0"
                    />
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">0 = unlimited</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                      <Ticket className="w-4 h-4 mr-2 text-orange-500" />
                      Max Total Tickets
                    </label>
                    <input
                      type="number"
                      value={formData.maxTotalTickets}
                      onChange={(e) => handleInputChange('maxTotalTickets', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Enter max total tickets"
                      min="0"
                    />
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">0 = unlimited</div>
                  </div>
                </div>
              </div>

              {/* Duration */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Duration
                </h3>
                <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
                  {testDurations.map((duration) => (
                    <button
                      key={duration.value}
                      onClick={() => handleInputChange('duration', duration.value)}
                      className={`px-3 py-2 text-sm rounded-lg border-2 transition-colors ${
                        formData.duration === duration.value
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {duration.label}
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Custom Duration (hours)
                  </label>
                  <input
                    type="number"
                    min="0.0166666667"
                    max="720"
                    value={formData.duration}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Enter duration in hours (minimum 1 minute = 0.0167 hours)"
                    step="0.0166666667"
                  />
                </div>
              </div>

              {/* Privacy Settings */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Privacy Settings
                </h3>
                <div className="space-y-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.participantsVisible}
                      onChange={(e) => handleInputChange('participantsVisible', e.target.checked)}
                      className="mr-3 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Show participant addresses
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.participantCountVisible}
                      onChange={(e) => handleInputChange('participantCountVisible', e.target.checked)}
                      className="mr-3 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Show participant count
                    </span>
                  </label>
                </div>
              </div>

              {/* Create Button */}
              <div className="text-center">
                <button
                  onClick={handleCreateRaffle}
                  disabled={isLoading}
                  className="btn-primary inline-flex items-center px-8 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-6 h-6 mr-3" />
                      Create Raffle
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  )
}