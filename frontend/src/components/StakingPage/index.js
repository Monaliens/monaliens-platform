import React, { useState, useEffect, useCallback } from "react";
import { usePrivyOptimized } from "../../context";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import StatsBar from "./components/StatsBar";
import YourNFTsPanel from "./components/YourNFTsPanel";
import StakedNFTsPanel from "./components/StakedNFTsPanel";
import StakeConfirmationModal from "./components/StakeConfirmationModal";
import { useStakingContract } from "./hooks/useStakingContract";
import { fetchUserNFTs } from "./utils/nftApi";
import {
  StakingPageContainer,
  ContentWrapper,
  PanelsContainer,
  WalletWarning,
  PrimaryButton,
  LoadingToast,
} from "./styles";

const StakingPage = () => {
  const { authenticated, login } = usePrivyOptimized();
  const { address } = useAccount();
  const [userNFTs, setUserNFTs] = useState([]);
  const [stakedNFTs, setStakedNFTs] = useState([]);
  const [selectedNFTs, setSelectedNFTs] = useState([]);
  const [selectedStakedNFTs, setSelectedStakedNFTs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [normalStakedCount, setNormalStakedCount] = useState(0);
  const [cooldownInfo, setCooldownInfo] = useState({});
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [showAnimations, setShowAnimations] = useState({
    stats: false,
    yourNFTs: false,
    stakedNFTs: false,
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const {
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
  } = useStakingContract();

  // Load all NFT data simultaneously
  const loadAllData = useCallback(
    async (isInitialLoad = false) => {
      if (!address || !isContractReady) return;

      // Only show loading UI on initial load
      if (isInitialLoad) {
        setLoading(true);
        setLoadingMessage("Loading NFT data...");
      }

      try {
        // Start all async operations in parallel with error tolerance
        const results = await Promise.allSettled([
          fetchUserNFTs(address),
          fetchStakedNFTs(address),
          fetchStats(),
        ]);

        // Extract results, use empty arrays as fallback for failures
        const userNFTsData = results[0].status === 'fulfilled' ? results[0].value : [];
        const stakedNFTsData = results[1].status === 'fulfilled' ? results[1].value : [];

        // Log any errors for debugging with detailed messages
        const getErrorMessage = (error) => {
          const msg = error?.message?.toLowerCase() || '';
          if (msg.includes('rate') || msg.includes('429') || msg.includes('too many')) {
            return 'Rate limited - too many requests';
          }
          if (msg.includes('timeout') || msg.includes('timed out')) {
            return 'Request timed out';
          }
          if (msg.includes('network') || msg.includes('fetch')) {
            return 'Network error';
          }
          if (msg.includes('rpc') || msg.includes('provider') || msg.includes('call')) {
            return 'RPC call failed';
          }
          return error?.message || 'Unknown error';
        };

        if (results[0].status === 'rejected') {
          console.warn('❌ Failed to fetch user NFTs:', getErrorMessage(results[0].reason));
        }
        if (results[1].status === 'rejected') {
          console.warn('❌ Failed to fetch staked NFTs:', getErrorMessage(results[1].reason));
        }
        if (results[2].status === 'rejected') {
          console.warn('❌ Failed to fetch stats:', getErrorMessage(results[2].reason));
        }

        // Filter user NFTs
        const SUPPORTED_NFT_CONTRACT = process.env.REACT_APP_MONALIENS_NFT_ADDRESS;
        const filteredUserNFTs = userNFTsData.filter(
          (nft) =>
            nft.contractAddress?.toLowerCase() ===
            SUPPORTED_NFT_CONTRACT.toLowerCase(),
        );

        // Calculate normal staked count and cooldown info
        let normalCount = 0;
        const cooldownData = {};

        if (stakedNFTsData.length > 0) {
          if (isInitialLoad) {
            setLoadingMessage("Calculating cooldown status...");
          }

          // Process cooldown info in parallel with error tolerance
          const cooldownResults = await Promise.allSettled(
            stakedNFTsData.map((nft) => getCooldownInfo(nft.tokenId))
          );
          const cooldownInfos = cooldownResults.map((result) =>
            result.status === 'fulfilled' ? result.value : null
          );

          // Build cooldown info object and count normal staked
          stakedNFTsData.forEach((nft, index) => {
            const info = cooldownInfos[index];
            if (info) {
              cooldownData[nft.tokenId] = info;
              if (!info.isOnCooldown) {
                normalCount++;
              }
            } else if (!info?.isOnCooldown) {
              normalCount++;
            }
          });
        }

        // Update all states simultaneously
        setUserNFTs(filteredUserNFTs);
        setStakedNFTs(stakedNFTsData);
        setNormalStakedCount(normalCount);
        setCooldownInfo(cooldownData);

        // Trigger staggered animations only on initial load
        if (isInitialLoad) {
          setHasInitiallyLoaded(true);
          setShowAnimations({
            stats: false,
            yourNFTs: false,
            stakedNFTs: false,
          });

          setTimeout(
            () => setShowAnimations((prev) => ({ ...prev, stats: true })),
            100,
          );
          setTimeout(
            () => setShowAnimations((prev) => ({ ...prev, yourNFTs: true })),
            300,
          );
          setTimeout(
            () => setShowAnimations((prev) => ({ ...prev, stakedNFTs: true })),
            500,
          );
        }
      } catch (error) {
        console.error("Error loading NFT data:", error);
        // Only show error toast for unexpected errors (Promise.allSettled handles API failures gracefully)
        if (isInitialLoad) {
          toast.error("Failed to load NFT data");
        }
      } finally {
        // Only clear loading state on initial load
        if (isInitialLoad) {
          setLoading(false);
          setLoadingMessage("");
        }
      }
    },
    [address, isContractReady, fetchStats, fetchStakedNFTs, getCooldownInfo],
  );

  // Load all data when component mounts or refreshes
  useEffect(() => {
    if (address && isContractReady) {
      const isInitialLoad = !hasInitiallyLoaded;
      loadAllData(isInitialLoad);
    }
  }, [
    address,
    isContractReady,
    refreshTrigger,
    loadAllData,
    hasInitiallyLoaded,
  ]);

  // Auto-refresh all data every 30 seconds (silent background refresh)
  useEffect(() => {
    if (!address || !isContractReady) return;

    const interval = setInterval(() => {
      loadAllData(false); // Background refresh without loading UI or animations
    }, 30000);

    return () => clearInterval(interval);
  }, [address, isContractReady, loadAllData]);

  const handleStakeClick = () => {
    if (selectedNFTs.length === 0) {
      toast.error("Please select NFTs to stake");
      return;
    }
    setShowConfirmModal(true);
  };

  const handleStake = async () => {
    setShowConfirmModal(false);

    setLoading(true);
    setLoadingMessage("Checking approvals...");

    try {
      // Check which NFTs need approval
      const needsApproval = [];
      for (const tokenId of selectedNFTs) {
        const isApproved = await checkApproval(address, tokenId);
        if (!isApproved) {
          needsApproval.push(tokenId);
        }
      }

      if (needsApproval.length > 0) {
        setLoadingMessage(
          `Approving ${needsApproval.length} NFT${needsApproval.length > 1 ? "s" : ""}...`,
        );
        const approveTx = await approveNFTs(needsApproval);
        if (!approveTx) {
          throw new Error("Approval failed");
        }
        toast.success(
          `Approved ${needsApproval.length} NFT${needsApproval.length > 1 ? "s" : ""}!`,
        );
      }

      setLoadingMessage(
        `Staking ${selectedNFTs.length} NFT${selectedNFTs.length > 1 ? "s" : ""}...`,
      );
      const success = await stakeNFTs(selectedNFTs);

      if (success) {
        toast.success(
          `Successfully staked ${selectedNFTs.length} NFT${selectedNFTs.length > 1 ? "s" : ""}!`,
        );
        setSelectedNFTs([]);
        setRefreshTrigger((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Staking error:", error);
      toast.error(error.message || "Failed to stake NFTs");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleStartCooldown = async (tokenIds) => {
    setLoading(true);
    setLoadingMessage(`Starting cooldown...`);

    try {
      const success = await startCooldown(tokenIds);
      if (success) {
        toast.success(`Cooldown started! You can unstake in 5 days.`);
        setRefreshTrigger((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Start cooldown error:", error);
      toast.error(error.message || "Failed to start cooldown");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleUnstake = async (tokenIds) => {
    setLoading(true);
    setLoadingMessage(`Unstaking NFTs...`);

    try {
      const success = await unstakeNFTs(tokenIds);
      if (success) {
        toast.success(
          `Successfully unstaked ${tokenIds.length} NFT${tokenIds.length > 1 ? "s" : ""}!`,
        );
        setRefreshTrigger((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Unstake error:", error);
      toast.error(error.message || "Failed to unstake NFTs");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  // Staked NFT selection handlers with cross-selection clearing
  const handleStakedNFTSelection = useCallback((tokenId, nftType) => {
    // nftType: 'normal' (ready for cooldown) or 'ready' (ready to unstake)

    setSelectedStakedNFTs((prev) => {
      const isSelected = prev.some((item) => item.tokenId === tokenId);

      if (isSelected) {
        // Remove from selection
        return prev.filter((item) => item.tokenId !== tokenId);
      } else {
        // Add to selection, but first check if we need to clear opposite type
        const existingType = prev.length > 0 ? prev[0].type : null;

        if (existingType && existingType !== nftType) {
          // Different type selected, clear previous selections
          return [{ tokenId, type: nftType }];
        } else {
          // Same type or no previous selection, add to current selection
          return [...prev, { tokenId, type: nftType }];
        }
      }
    });
  }, []);

  // Handle staked NFT actions based on selection type
  const handleStakedAction = useCallback(async () => {
    if (selectedStakedNFTs.length === 0) return;

    const selectionType = selectedStakedNFTs[0].type;
    const tokenIds = selectedStakedNFTs.map((item) => item.tokenId);

    if (selectionType === "normal") {
      await handleStartCooldown(tokenIds);
    } else if (selectionType === "ready") {
      await handleUnstake(tokenIds);
    }

    // Clear selection after action
    setSelectedStakedNFTs([]);
  }, [selectedStakedNFTs, handleStartCooldown, handleUnstake]);

  return (
    <StakingPageContainer>
      <ContentWrapper>
        <div
          style={{
            opacity: isPublicClientReady ? 1 : 0,
            transform: isPublicClientReady
              ? "translateY(0)"
              : "translateY(20px)",
            transition: "all 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)",
          }}
        >
          <StatsBar
            stats={stats}
            userStakedCount={authenticated ? normalStakedCount : null}
            totalPoints={authenticated ? stakedNFTs.reduce((sum, nft) => sum + Math.floor((nft.stakeDuration || 0) / 60), 0) : null}
          />
        </div>

        {!authenticated ? (
          <WalletWarning>
            <h3>Connect Your Wallet</h3>
            <p>Please connect your wallet to view your NFTs and start staking</p>
            <PrimaryButton onClick={login}>Connect Wallet</PrimaryButton>
          </WalletWarning>
        ) : (
          <PanelsContainer>
            <div
              style={{
                opacity: showAnimations.yourNFTs ? 1 : 0,
                transform: showAnimations.yourNFTs
                  ? "translateY(0)"
                  : "translateY(30px)",
                transition: "all 0.7s cubic-bezier(0.4, 0.0, 0.2, 1)",
              }}
            >
              <YourNFTsPanel
                nfts={userNFTs}
                stakedTokenIds={stakedNFTs.map((nft) => nft.tokenId)}
                selectedNFTs={selectedNFTs}
                onSelectionChange={setSelectedNFTs}
                onStake={handleStakeClick}
                loading={loading}
              />
            </div>

            <div
              style={{
                opacity: showAnimations.stakedNFTs ? 1 : 0,
                transform: showAnimations.stakedNFTs
                  ? "translateY(0)"
                  : "translateY(30px)",
                transition: "all 0.7s cubic-bezier(0.4, 0.0, 0.2, 1)",
              }}
            >
              <StakedNFTsPanel
                stakedNFTs={stakedNFTs}
                selectedStakedNFTs={selectedStakedNFTs}
                onSelectionChange={handleStakedNFTSelection}
                onStakedAction={handleStakedAction}
                cooldownInfo={cooldownInfo}
                setCooldownInfo={setCooldownInfo}
                loading={loading}
              />
            </div>
          </PanelsContainer>
        )}

        {loading && loadingMessage && (
          <LoadingToast>
            <Loader2
              size={20}
              style={{ animation: "spin 1s linear infinite" }}
            />
            <span>{loadingMessage}</span>
          </LoadingToast>
        )}

        <StakeConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleStake}
          nftCount={selectedNFTs.length}
        />
      </ContentWrapper>
    </StakingPageContainer>
  );
};

export default StakingPage;
