import { useState } from 'react'
import { ethers } from 'ethers'
import { usePrivy } from '@privy-io/react-auth'
import toast from 'react-hot-toast'
import { RAFFLE_ABI, ERC20_ABI } from '@/utils/contracts'
import { useNetworkSwitch } from '@/hooks/useNetworkSwitch'
import { useWalletProvider } from '@/hooks/useWalletProvider'

export function useTicketPurchase() {
  const [loading, setLoading] = useState(false)
  const { user, authenticated } = usePrivy()
  const { ensureCorrectNetwork } = useNetworkSwitch()
  const { getProviderAndSigner } = useWalletProvider()

  const buyTickets = async (
    raffleAddress: string,
    ticketCount: number,
    ticketPriceWei: string, // Already in wei format
    ticketTokenAddress: string,
    isNativeToken: boolean = false
  ) => {
    if (!authenticated || !user?.wallet) {
      toast.error('Please connect your wallet first')
      return false
    }

    // Ensure user is on correct network before proceeding
    const isCorrectNetwork = await ensureCorrectNetwork()
    if (!isCorrectNetwork) {
      return false
    }

    setLoading(true)
    
    try {
      // Get the correct provider and signer for the connected wallet
      const { provider, signer } = await getProviderAndSigner()
      const userAddress = await signer.getAddress()
      
      const raffleContract = new ethers.Contract(raffleAddress, RAFFLE_ABI, signer)
      
      // ticketPriceWei is already in wei format from the API
      const ticketPrice = BigInt(ticketPriceWei)
      const totalCost = ticketPrice * BigInt(ticketCount)

      console.log('Ticket purchase details:', {
        ticketCount,
        ticketPriceWei,
        ticketPrice: ticketPrice.toString(),
        totalCost: totalCost.toString(),
        isNativeToken,
        tokenAddress: ticketTokenAddress,
        userAddress
      })

      // Check user's balance before proceeding
      if (isNativeToken || ticketTokenAddress === ethers.ZeroAddress) {
        const balance = await provider.getBalance(userAddress)
        if (balance < totalCost) {
          toast.error(`Insufficient MON balance. Need ${ethers.formatEther(totalCost)} MON`)
          return false
        }
      } else {
        const tokenContract = new ethers.Contract(ticketTokenAddress, ERC20_ABI, signer)
        const balance = await tokenContract.balanceOf(userAddress)
        if (balance < totalCost) {
          const symbol = await tokenContract.symbol().catch(() => 'tokens')
          toast.error(`Insufficient ${symbol} balance. Need ${ethers.formatEther(totalCost)} ${symbol}`)
          return false
        }
      }

      if (isNativeToken || ticketTokenAddress === ethers.ZeroAddress) {
        // Native token payment (ETH/MON)
        console.log('Buying tickets with native token:', {
          amount: ticketCount,
          value: totalCost.toString()
        })

        const gasEstimate = await raffleContract.buyTickets.estimateGas(ticketCount, {
          value: totalCost
        }).catch(() => BigInt(350000)) // Fallback gas limit

        const tx = await raffleContract.buyTickets(ticketCount, {
          value: totalCost,
          gasLimit: gasEstimate + BigInt(50000) // Add buffer for safety
        })

        toast.loading('Transaction submitted...', { id: 'tx-pending' })
        const receipt = await tx.wait()
        
        if (receipt.status === 1) {
          toast.success(`Successfully purchased ${ticketCount} ticket${ticketCount > 1 ? 's' : ''}!`, { id: 'tx-pending' })
          return true
        } else {
          toast.error('Transaction failed', { id: 'tx-pending' })
          return false
        }
      } else {
        // ERC20 token payment
        console.log('Buying tickets with ERC20 token:', {
          tokenAddress: ticketTokenAddress,
          amount: ticketCount,
          totalCost: totalCost.toString()
        })

        const tokenContract = new ethers.Contract(ticketTokenAddress, ERC20_ABI, signer)
        
        // Check allowance
        const allowance = await tokenContract.allowance(userAddress, raffleAddress)
        console.log('Current allowance:', allowance.toString(), 'Required:', totalCost.toString())
        
        if (allowance < totalCost) {
          console.log('Approving token spend...')
          toast.loading('Approving token spend...', { id: 'approve-pending' })
          
          // Approve exact amount needed
          const approveTx = await tokenContract.approve(raffleAddress, totalCost)
          await approveTx.wait()
          toast.success('Token approval completed', { id: 'approve-pending' })
          
          console.log('Token approval completed')
        }

        // Buy tickets
        console.log('Purchasing tickets...')
        toast.loading('Purchasing tickets...', { id: 'tx-pending' })
        
        const gasEstimate = await raffleContract.buyTickets.estimateGas(ticketCount)
          .catch(() => BigInt(350000)) // Fallback gas limit

        const tx = await raffleContract.buyTickets(ticketCount, {
          gasLimit: gasEstimate + BigInt(50000) // Add buffer for safety
        })

        const receipt = await tx.wait()
        
        if (receipt.status === 1) {
          toast.success(`Successfully purchased ${ticketCount} ticket${ticketCount > 1 ? 's' : ''}!`, { id: 'tx-pending' })
          return true
        } else {
          toast.error('Transaction failed', { id: 'tx-pending' })
          return false
        }
      }
    } catch (error: any) {
      console.error('Error buying tickets:', error)
      
      // Dismiss any pending toasts
      toast.dismiss()
      
      if (error.code === 4001) {
        toast.error('Transaction rejected by user')
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        toast.error('Insufficient funds for transaction')
      } else if (error.message?.includes('insufficient funds')) {
        toast.error('Insufficient balance')
      } else if (error.message?.includes('Exceeds max tickets')) {
        toast.error('Exceeds maximum tickets per wallet')
      } else if (error.message?.includes('Exceeds maximum total tickets')) {
        toast.error('Exceeds maximum total tickets for this raffle')
      } else if (error.message?.includes('Raffle not active')) {
        toast.error('Raffle is not active')
      } else if (error.message?.includes('Raffle ended')) {
        toast.error('Raffle has ended')
      } else if (error.message?.includes('execution reverted')) {
        toast.error('Transaction failed - please check raffle conditions')
      } else {
        toast.error(error.message || 'Failed to purchase tickets')
      }
      
      return false
    } finally {
      setLoading(false)
    }
  }

  return {
    buyTickets,
    loading
  }
}