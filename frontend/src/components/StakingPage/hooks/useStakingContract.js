import { useState, useEffect, useCallback } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { formatEther } from "viem";
import stakingABI from "../../../config/stakev2abi.json";
import { fetchBatchNFTMetadata } from "../utils/nftApi";

const STAKING_CONTRACT_ADDRESS = process.env.REACT_APP_STAKING_CONTRACT_ADDRESS;
const NFT_CONTRACT_ADDRESS = process.env.REACT_APP_MONALIENS_NFT_ADDRESS;

export const useStakingContract = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [stats, setStats] = useState({
    totalStaked: 0,
    totalRewardsDistributed: 0,
    uniqueStakers: 0,
  });

  const [isContractReady, setIsContractReady] = useState(false);
  const [isPublicClientReady, setIsPublicClientReady] = useState(false);

  // Check if public client is ready (for read-only operations like stats)
  useEffect(() => {
    setIsPublicClientReady(!!publicClient);
  }, [publicClient]);

  // Check if contract is ready for user-specific operations
  useEffect(() => {
    setIsContractReady(!!publicClient && !!address);
  }, [publicClient, address]);

  // Fetch global stats
  const fetchStats = useCallback(async () => {
    if (!publicClient) return;

    try {
      const [totalStaked, totalRewardsDistributed, contractStats] =
        await Promise.all([
          publicClient.readContract({
            address: STAKING_CONTRACT_ADDRESS,
            abi: stakingABI,
            functionName: "totalStaked",
          }),
          publicClient.readContract({
            address: STAKING_CONTRACT_ADDRESS,
            abi: stakingABI,
            functionName: "totalRewardsDistributed",
          }),
          publicClient.readContract({
            address: STAKING_CONTRACT_ADDRESS,
            abi: stakingABI,
            functionName: "getContractStats",
          }),
        ]);

      // Parse uniqueStakersCount from the contractStats response
      const uniqueStakersCount = Number(contractStats[1]);

      setStats({
        totalStaked: Number(totalStaked || 0n),
        totalRewardsDistributed: formatEther(totalRewardsDistributed || 0n),
        uniqueStakers: uniqueStakersCount || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, [publicClient]);

  // Fetch staked NFTs for a user
  const fetchStakedNFTs = useCallback(
    async (userAddress) => {
      if (!publicClient) return [];

      try {
        const result = await publicClient.readContract({
          address: STAKING_CONTRACT_ADDRESS,
          abi: stakingABI,
          functionName: "getStakedNFTs",
          args: [userAddress],
        });

        const tokenIds = result?.tokenIds || result?.[0] || [];
        const stakeDurations = result?.stakeDurations || result?.[1] || [];

        if (tokenIds.length === 0) {
          return [];
        }

        // Fetch all metadata in a single batch request
        const numericTokenIds = tokenIds.map(id => Number(id));
        const batchMetadata = await fetchBatchNFTMetadata(numericTokenIds);

        // Map metadata to staked NFTs with stake duration
        const stakedNFTsWithMetadata = numericTokenIds.map((tokenId, index) => {
          const metadata = batchMetadata.find(m => m.tokenId === tokenId) || {};
          return {
            tokenId,
            stakeDuration: Number(stakeDurations[index] || 0),
            name: metadata.name || `Monaliens #${tokenId}`,
            image: metadata.image || "",
            contractAddress: NFT_CONTRACT_ADDRESS,
            attributes: metadata.attributes || [],
            collection: metadata.collection || "Monaliens",
          };
        });

        return stakedNFTsWithMetadata;
      } catch (error) {
        console.error("Error fetching staked NFTs:", error);
        return [];
      }
    },
    [publicClient],
  );

  // Check if specific NFT is approved
  const checkApproval = useCallback(
    async (userAddress, tokenId) => {
      if (!publicClient) return false;

      try {
        const nftABI = [
          {
            inputs: [{ name: "tokenId", type: "uint256" }],
            name: "getApproved",
            outputs: [{ name: "", type: "address" }],
            stateMutability: "view",
            type: "function",
          },
        ];

        const approvedAddress = await publicClient.readContract({
          address: NFT_CONTRACT_ADDRESS,
          abi: nftABI,
          functionName: "getApproved",
          args: [BigInt(tokenId)],
        });

        return (
          approvedAddress?.toLowerCase() ===
          STAKING_CONTRACT_ADDRESS.toLowerCase()
        );
      } catch (error) {
        console.error("Error checking approval:", error);
        return false;
      }
    },
    [publicClient],
  );

  // Approve specific NFTs
  const approveNFTs = useCallback(
    async (tokenIds) => {
      if (!walletClient || !address) return false;

      try {
        const nftABI = [
          {
            inputs: [
              { name: "to", type: "address" },
              { name: "tokenId", type: "uint256" },
            ],
            name: "approve",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
          },
        ];

        // Approve each NFT individually
        for (const tokenId of tokenIds) {
          const { request } = await publicClient.simulateContract({
            address: NFT_CONTRACT_ADDRESS,
            abi: nftABI,
            functionName: "approve",
            args: [STAKING_CONTRACT_ADDRESS, BigInt(tokenId)],
            account: address,
          });

          // Ensure gas limit is set
          const hash = await walletClient.writeContract({
            ...request,
            gas: request.gas || BigInt(3000000),
          });
          await publicClient.waitForTransactionReceipt({ hash });
        }

        return true;
      } catch (error) {
        console.error("Error approving NFTs:", error);
        throw error;
      }
    },
    [walletClient, publicClient, address],
  );

  // Stake NFTs
  const stakeNFTs = useCallback(
    async (tokenIds) => {
      if (!walletClient || !address) return false;

      try {
        const { request } = await publicClient.simulateContract({
          address: STAKING_CONTRACT_ADDRESS,
          abi: stakingABI,
          functionName: "stake",
          args: [tokenIds.map((id) => BigInt(id))],
          account: address,
        });

        // Ensure gas limit is set
        const hash = await walletClient.writeContract({
          ...request,
          gas: request.gas || BigInt(3000000),
        });
        await publicClient.waitForTransactionReceipt({ hash });

        // Refresh data
        fetchStats();

        return true;
      } catch (error) {
        console.error("Error staking NFTs:", error);
        throw error;
      }
    },
    [walletClient, publicClient, address, fetchStats],
  );

  // Get cooldown info for a token (V2)
  const getCooldownInfo = useCallback(
    async (tokenId) => {
      if (!publicClient) return null;

      try {
        const result = await publicClient.readContract({
          address: STAKING_CONTRACT_ADDRESS,
          abi: stakingABI,
          functionName: "getCooldownInfo",
          args: [BigInt(tokenId)],
        });

        // V2 returns tuple: [isOnCooldown, cooldownStart, remainingTime]
        return {
          isOnCooldown: result[0],
          cooldownStart: Number(result[1]),
          remainingSeconds: Number(result[2]),
        };
      } catch (error) {
        console.error("Error fetching cooldown info:", error);
        return null;
      }
    },
    [publicClient],
  );

  // Start cooldown for tokens (V2)
  const startCooldown = useCallback(
    async (tokenIds) => {
      if (!walletClient || !address) return false;

      try {
        const { request } = await publicClient.simulateContract({
          address: STAKING_CONTRACT_ADDRESS,
          abi: stakingABI,
          functionName: "startCooldown",
          args: [tokenIds.map((id) => BigInt(id))],
          account: address,
        });

        // Ensure gas limit is set
        const hash = await walletClient.writeContract({
          ...request,
          gas: request.gas || BigInt(3000000),
        });
        await publicClient.waitForTransactionReceipt({ hash });

        // Refresh data
        fetchStats();

        return true;
      } catch (error) {
        console.error("Error starting cooldown:", error);
        throw error;
      }
    },
    [walletClient, publicClient, address, fetchStats],
  );

  // Unstake NFTs
  const unstakeNFTs = useCallback(
    async (tokenIds) => {
      if (!walletClient || !address) return false;

      try {
        const { request } = await publicClient.simulateContract({
          address: STAKING_CONTRACT_ADDRESS,
          abi: stakingABI,
          functionName: "unstake",
          args: [tokenIds.map((id) => BigInt(id))],
          account: address,
        });

        // Ensure gas limit is set
        const hash = await walletClient.writeContract({
          ...request,
          gas: request.gas || BigInt(3000000),
        });
        await publicClient.waitForTransactionReceipt({ hash });

        // Refresh data
        fetchStats();

        return true;
      } catch (error) {
        console.error("Error unstaking NFTs:", error);
        throw error;
      }
    },
    [walletClient, publicClient, address, fetchStats],
  );

  // Initial stats fetch (doesn't require wallet connection)
  useEffect(() => {
    if (isPublicClientReady) {
      fetchStats();
    }
  }, [isPublicClientReady, fetchStats]);

  return {
    stats,
    fetchStats,
    fetchStakedNFTs,
    approveNFTs,
    checkApproval,
    stakeNFTs,
    startCooldown,
    unstakeNFTs,
    getCooldownInfo,
    isContractReady,
    isPublicClientReady,
  };
};
