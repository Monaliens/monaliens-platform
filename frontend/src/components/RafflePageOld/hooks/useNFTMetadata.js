import { useState, useEffect } from "react";
import { fetchNFTMetadata } from "../utils/blockchainHelpers";
import { CONTRACT_ADDRESSES } from "../utils/constants";

/**
 * Hook to fetch NFT metadata for raffles
 * @param {Array} raffles - Array of raffle objects
 * @param {Object} activeWallet - Active Privy wallet
 * @returns {Array} Raffles enriched with NFT metadata
 */
export const useNFTMetadata = (raffles, activeWallet) => {
  const [enrichedRaffles, setEnrichedRaffles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!raffles || raffles.length === 0) {
      setEnrichedRaffles([]);
      return;
    }

    const enrichRafflesWithMetadata = async () => {
      setIsLoading(true);

      try {
        const enrichedData = await Promise.all(
          raffles.map(async (raffle) => {
            // Skip if not an NFT raffle
            if (raffle.prizeType !== "NFT") {
              return raffle;
            }

            // Skip if already has metadata
            if (raffle.prizeMetadata?.image) {
              return raffle;
            }

            // Try to extract contract address and token ID from raffle data
            let contractAddress =
              raffle.prizeContractAddress ||
              raffle.prizeTokenAddress ||
              raffle.nftContractAddress ||
              raffle.prizeAddress;
            let tokenId =
              raffle.prizeTokenId || raffle.nftTokenId || raffle.tokenId;

            // Eğer contract address yoksa, bilinen Monaliens contract'ını kullan
            if (!contractAddress && tokenId) {
              contractAddress = CONTRACT_ADDRESSES.MONALIENS_NFT;
              console.log(
                "Using fallback Monaliens contract address for NFT",
                tokenId
              );
            }

            if (!contractAddress || !tokenId) {
              console.warn(
                "Missing NFT contract address or token ID for raffle:",
                raffle.raffleId,
                {
                  contractAddress,
                  tokenId,
                  prizeContractAddress: raffle.prizeContractAddress,
                  prizeTokenId: raffle.prizeTokenId,
                  prizeType: raffle.prizeType,
                }
              );
              return raffle;
            }

            try {
              const metadata = await fetchNFTMetadata(
                contractAddress,
                tokenId,
                activeWallet
              );

              if (metadata) {
                return {
                  ...raffle,
                  prizeMetadata: {
                    ...metadata,
                    name:
                      metadata.name ||
                      raffle.prizeMetadata?.name ||
                      "NFT Prize",
                    description:
                      metadata.description || raffle.prizeMetadata?.description,
                  },
                };
              } else {
                console.warn(
                  "NFT metadata fetch returned null for raffle:",
                  raffle.raffleId
                );
              }
            } catch (error) {
              console.error(
                "Failed to fetch NFT metadata for raffle:",
                raffle.raffleId,
                {
                  error: error.message,
                  contractAddress,
                  tokenId,
                }
              );
            }

            return raffle;
          })
        );

        setEnrichedRaffles(enrichedData);
      } catch (error) {
        console.error("Error enriching raffles with metadata:", error);
        setEnrichedRaffles(raffles);
      } finally {
        setIsLoading(false);
      }
    };

    enrichRafflesWithMetadata();
  }, [raffles, activeWallet]);

  return { enrichedRaffles, isLoading };
};

export default useNFTMetadata;
