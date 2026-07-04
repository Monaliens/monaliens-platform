import { createPublicClient, http } from "viem";
import { monad } from "../config/privyConfig";
import stakingABI from "../config/stakev2abi.json";

const STAKING_CONTRACT_ADDRESS = process.env.REACT_APP_STAKING_CONTRACT_ADDRESS;

const publicClient = createPublicClient({
  chain: monad,
  transport: http(),
});

/**
 * Read staked Monaliens NFT token IDs for a wallet (VerifyPage / profile).
 */
export async function getStakedNFTs(address) {
  if (!address || !STAKING_CONTRACT_ADDRESS) {
    return [];
  }

  try {
    const result = await publicClient.readContract({
      address: STAKING_CONTRACT_ADDRESS,
      abi: stakingABI,
      functionName: "getStakedNFTs",
      args: [address],
    });

    const tokenIds = result?.tokenIds ?? result?.[0] ?? [];
    const stakeDurations = result?.stakeDurations ?? result?.[1] ?? [];

    return tokenIds.map((tokenId, index) => ({
      tokenId: tokenId.toString(),
      stakeDuration: Number(stakeDurations[index] ?? 0),
      isStaked: true,
    }));
  } catch (error) {
    console.error("Error getting staked NFTs:", error);
    return [];
  }
}
