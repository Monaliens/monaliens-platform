import { useState, useCallback } from 'react';
import { usePrivyOptimized } from '../../../../context';
import { useWalletClient, useSwitchChain, useAccount } from 'wagmi';
import toast from 'react-hot-toast';
import { createPublicClient, http, parseEther } from 'viem';
import { monadTestnet } from '../../../../config/reownConfig';
import { P2P2_CONTRACT_ADDRESSES, P2P2_ABIS, ASSET_TYPES } from '../utils/constants';

const prepareAssetParameters = (assets) => {
  return (assets || []).map(a => {
    let tokenIdOrAmount;

    if (a.assetType === ASSET_TYPES.NATIVE) {
      // NATIVE (MON): parseEther to convert to wei
      tokenIdOrAmount = parseEther(a.tokenIdOrAmount.toString());
    } else if (a.assetType === ASSET_TYPES.ERC20) {
      // ERC20 (LMON): has 18 decimals, use parseEther
      tokenIdOrAmount = parseEther(a.tokenIdOrAmount.toString());
    } else {
      // ERC721/ERC1155: use tokenId as-is
      tokenIdOrAmount = BigInt(a.tokenIdOrAmount || 0);
    }

    return {
      assetType: a.assetType,
      contractAddress: a.contractAddress || '0x0000000000000000000000000000000000000000',
      tokenIdOrAmount,
      amount: BigInt(a.amount || 0),
      isSpecific: !!a.isSpecific
    };
  });
};

const useP2P2Contract = () => {
  const { isConnected, walletAddress } = usePrivyOptimized();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const { switchChain } = useSwitchChain();
  const userAddress = address || walletAddress || '0x0000000000000000000000000000000000000000';

  const [loading, setLoading] = useState(false);
  const [txState, setTxState] = useState('idle');
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('idle');

  const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });

  const switchToMonad = useCallback(async () => {
    await switchChain({ chainId: monadTestnet.id });
    await new Promise(r => setTimeout(r, 750));
  }, [switchChain]);

  const FACTORY_ADDRESS = P2P2_CONTRACT_ADDRESSES.FACTORY.toLowerCase();

  const approveERC721 = async (asset) => {
    if (!asset?.contractAddress) {
      return;
    }

    // Check ownership
    try {
      const owner = await publicClient.readContract({
        address: asset.contractAddress,
        abi: P2P2_ABIS.ERC721,
        functionName: 'ownerOf',
        args: [BigInt(asset.tokenIdOrAmount)]
      });

      if (owner?.toLowerCase?.() !== userAddress?.toLowerCase?.()) {
        throw new Error(`You don't own NFT #${asset.tokenIdOrAmount}. Owner: ${owner}`);
      }
    } catch (err) {
      if (err.message.includes("don't own")) {
        throw err;
      }
      console.warn('ownerOf check failed:', err);
    }

    const currentApproval = await publicClient.readContract({
      address: asset.contractAddress,
      abi: P2P2_ABIS.ERC721,
      functionName: 'getApproved',
      args: [BigInt(asset.tokenIdOrAmount)]
    });

    if (currentApproval?.toLowerCase?.() === FACTORY_ADDRESS) {
      return;
    }

    const hash = await walletClient.writeContract({
      address: asset.contractAddress,
      abi: P2P2_ABIS.ERC721,
      functionName: 'approve',
      args: [P2P2_CONTRACT_ADDRESSES.FACTORY, BigInt(asset.tokenIdOrAmount)],
      account: userAddress
    });

    await publicClient.waitForTransactionReceipt({ hash });
  };

  const isApprovedForAll = async (contractAddress) => {
    if (!contractAddress) return false;

    try {
      const approved = await publicClient.readContract({
        address: contractAddress,
        abi: P2P2_ABIS.ERC721,
        functionName: 'isApprovedForAll',
        args: [userAddress, P2P2_CONTRACT_ADDRESSES.FACTORY]
      });
      return Boolean(approved);
    } catch (err) {
      console.warn('isApprovedForAll check failed', err);
      return false;
    }
  };

  const approveERC20 = async (asset) => {
    if (!asset?.contractAddress) {
      return;
    }

    // Check current allowance
    try {
      const currentAllowance = await publicClient.readContract({
        address: asset.contractAddress,
        abi: P2P2_ABIS.ERC20,
        functionName: 'allowance',
        args: [userAddress, P2P2_CONTRACT_ADDRESSES.FACTORY]
      });

      const requiredAmount = parseEther(asset.tokenIdOrAmount.toString());

      // If allowance is sufficient, skip approval
      if (currentAllowance >= requiredAmount) {
        return;
      }

      // Approve the required amount
      const hash = await walletClient.writeContract({
        address: asset.contractAddress,
        abi: P2P2_ABIS.ERC20,
        functionName: 'approve',
        args: [P2P2_CONTRACT_ADDRESSES.FACTORY, requiredAmount],
        account: userAddress
      });

      await publicClient.waitForTransactionReceipt({ hash });
    } catch (err) {
      console.error('ERC20 approval failed:', err);
      throw err;
    }
  };

  const createOffer = useCallback(async ({
    offerType, targetUser, collectionAddress, duration, targetOfferId, title, description, offeredAssets, requestedAssets
  }) => {
    if (!isConnected || !walletClient) {
      toast.error('Please connect your wallet first');
      return { success: false, error: 'not-connected' };
    }

    setLoading(true);
    setError(null);
    setStep('preparing');
    setTxState('pending');

    try {
      await switchToMonad();

      // approvals for offered ERC721
      setStep('approving');
      const approvalCache = new Map();
      for (const asset of offeredAssets) {
        if (asset.assetType !== ASSET_TYPES.ERC721) continue;

        const normalizedContract = asset.contractAddress?.toLowerCase?.() || '';
        if (!normalizedContract) continue;

        let collectionApproved = approvalCache.get(normalizedContract);
        if (collectionApproved === undefined) {
          collectionApproved = await isApprovedForAll(asset.contractAddress);
          approvalCache.set(normalizedContract, collectionApproved);
        }

        if (collectionApproved) {
          continue;
        }

        await approveERC721(asset);
      }

      // approvals for offered ERC20 (LMON)
      for (const asset of offeredAssets) {
        if (asset.assetType !== ASSET_TYPES.ERC20) continue;
        await approveERC20(asset);
      }

      // native value
      let nativeValue = 0n;
      for (const asset of offeredAssets) {
        if (asset.assetType === ASSET_TYPES.NATIVE) {
          nativeValue += parseEther(asset.tokenIdOrAmount.toString());
        }
      }

      setStep('creating');
      toast.loading('Creating offer...', { id: 'p2p2-create' });

      const args = [
        offerType,
        targetUser || '0x0000000000000000000000000000000000000000',
        collectionAddress || '0x0000000000000000000000000000000000000000',
        duration,
        targetOfferId || 0,
        title || '',
        description || '',
        prepareAssetParameters(offeredAssets),
        prepareAssetParameters(requestedAssets)
      ];

      const hash = await walletClient.writeContract({
        address: P2P2_CONTRACT_ADDRESSES.FACTORY,
        abi: P2P2_ABIS.FACTORY,
        functionName: 'createOfferAndDeposit',
        args,
        value: nativeValue,
        account: userAddress
      });

      setTxHash(hash);
      setTxState('confirming');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'success') {
        setTxState('confirmed');
        setStep('success');
        toast.success('Offer created!', { id: 'p2p2-create' });
        return { success: true, txHash: hash, receipt };
      }
      throw new Error('tx-failed');
    } catch (e) {
      console.error(e);
      setError(e?.message || 'unknown-error');
      setStep('error');
      setTxState('failed');
      toast.error('Failed to create offer', { id: 'p2p2-create' });
      return { success: false, error: e?.message };
    } finally {
      setLoading(false);
    }
  }, [isConnected, walletClient, publicClient, switchToMonad, userAddress]);

  return { createOffer, loading, txState, txHash, error, step };
};

export default useP2P2Contract;
