import { useState, useCallback, useMemo } from 'react';
import { usePrivyOptimized } from '../../../../context';
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi';
import { createPublicClient, http } from 'viem';
import { monadTestnet } from '../../../../config/reownConfig';
import { P2P2_ABIS } from '../../P2P2CreatePage/utils/constants';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const useOfferActions = () => {
  const { isConnected, walletAddress } = usePrivyOptimized();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const { switchChain } = useSwitchChain();

  const userAddress = address || walletAddress || ZERO_ADDRESS;

  const publicClient = useMemo(
    () => createPublicClient({ chain: monadTestnet, transport: http() }),
    []
  );

  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);

  const switchToMonad = useCallback(async () => {
    await switchChain({ chainId: monadTestnet.id });
    await new Promise((resolve) => setTimeout(resolve, 750));
  }, [switchChain]);

  const ensureWallet = useCallback(() => {
    if (!isConnected || !walletClient) {
      console.log('Please connect your wallet');
      return false;
    }
    return true;
  }, [isConnected, walletClient]);

  const acceptCounterOffer = useCallback(
    async ({ offerContract, counterContract }) => {
      if (!ensureWallet()) return { success: false, error: 'not-connected' };
      if (!offerContract || !counterContract) {
        console.log('Missing contract addresses');
        return { success: false, error: 'missing-address' };
      }

      setLoading(true);
      setPendingAction('accept');
      setError(null);

      try {
        await switchToMonad();
        console.log('Accepting counter offer...');

        const hash = await walletClient.writeContract({
          address: offerContract,
          abi: P2P2_ABIS.OFFER_CONTRACT,
          functionName: 'acceptTargetedOffer',
          args: [counterContract],
          account: userAddress
        });

        setTxHash(hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status === 'success') {
          console.log('Counter offer accepted!');
          return { success: true, txHash: hash };
        }

        throw new Error('Transaction failed');
      } catch (err) {
        console.error('Accept counter offer error:', err);
        setError(err?.message || 'accept-failed');
        return { success: false, error: err?.message };
      } finally {
        setLoading(false);
        setPendingAction(null);
      }
    },
    [ensureWallet, switchToMonad, walletClient, userAddress, publicClient]
  );

  const cancelOffer = useCallback(
    async ({ offerContract }) => {
      if (!ensureWallet()) return { success: false, error: 'not-connected' };
      if (!offerContract) {
        console.log('Missing offer contract address');
        return { success: false, error: 'missing-address' };
      }

      setLoading(true);
      setPendingAction('cancel');
      setError(null);

      try {
        await switchToMonad();
        console.log('Cancelling offer...');

        const hash = await walletClient.writeContract({
          address: offerContract,
          abi: P2P2_ABIS.OFFER_CONTRACT,
          functionName: 'cancelOffer',
          args: [],
          account: userAddress
        });

        setTxHash(hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status === 'success') {
          console.log('Offer cancelled');
          return { success: true, txHash: hash };
        }

        throw new Error('Transaction failed');
      } catch (err) {
        console.error('Cancel offer error:', err);
        setError(err?.message || 'cancel-failed');
        return { success: false, error: err?.message };
      } finally {
        setLoading(false);
        setPendingAction(null);
      }
    },
    [ensureWallet, switchToMonad, walletClient, userAddress, publicClient]
  );

  return {
    loading,
    pendingAction,
    txHash,
    error,
    acceptCounterOffer,
    cancelOffer
  };
};

export default useOfferActions;
