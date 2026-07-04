import React, { useState, useEffect } from "react";
import CoinIcon from "./CoinIcon";
import UnstakeConfirmationModal from "./UnstakeConfirmationModal";
import {
  ContainerWrapper,
  ContainerHeader,
  Panel,
  ContainerContent,
  NFTGrid,
  NFTCard,
  PrimaryButton,
  EmptyState,
  ActionButtons,
  SelectionCounter,
} from "../styles";

const StakedNFTsPanel = ({
  stakedNFTs,
  selectedStakedNFTs,
  onSelectionChange,
  onStakedAction,
  cooldownInfo,
  setCooldownInfo,
  loading,
}) => {
  const [showUnstakeModal, setShowUnstakeModal] = useState(false);
  // Format countdown timer
  const formatCountdown = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return minutes > 0 ? `${minutes}m` : "< 1m";
    }
  };

  // Convert staking duration to points (1 minute = 1 point)
  const calculatePoints = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    return minutes;
  };

  // No separate cooldown fetching needed - cooldownInfo comes from parent

  // Countdown timer effect - updates parent cooldownInfo
  useEffect(() => {
    const interval = setInterval(() => {
      setCooldownInfo((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((tokenId) => {
          if (updated[tokenId]?.remainingSeconds > 0) {
            updated[tokenId] = {
              ...updated[tokenId],
              remainingSeconds: Math.max(
                0,
                updated[tokenId].remainingSeconds - 1,
              ),
            };
          }
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [setCooldownInfo]);

  // Separate NFTs into 2 categories only
  const normalStakedNFTs = stakedNFTs.filter((nft) => {
    const info = cooldownInfo[nft.tokenId] || {};
    return !info.isOnCooldown; // Not on cooldown = normal staked
  });

  const cooldownNFTs = stakedNFTs.filter((nft) => {
    const info = cooldownInfo[nft.tokenId] || {};
    return info.isOnCooldown; // On cooldown (both active and ready)
  });

  // Selection helpers
  const isNFTSelected = (tokenId) => {
    return selectedStakedNFTs.some((item) => item.tokenId === tokenId);
  };

  const getSelectionType = () => {
    return selectedStakedNFTs.length > 0 ? selectedStakedNFTs[0].type : null;
  };

  const getSelectedCount = () => selectedStakedNFTs.length;

  const handleNFTClick = (tokenId, nftType) => {
    if (loading) return;


    const info = cooldownInfo[tokenId] || {};
    if (nftType === "cooldown" && info.remainingSeconds > 0) {
      return;
    }

    onSelectionChange(tokenId, nftType);
  };

  // Handle action button click - show modal for unstake, direct action for claim
  const handleActionClick = () => {
    if (getSelectionType() === "normal") {
      // Show unstake confirmation modal
      setShowUnstakeModal(true);
    } else {
      // Direct action for claim (ready NFTs)
      onStakedAction();
    }
  };

  // Handle unstake confirmation
  const handleUnstakeConfirm = () => {
    setShowUnstakeModal(false);
    onStakedAction();
  };

  // Render NFT card with info below (like STAKE panel)
  const renderNFTCard = (nft, type) => {
    const info = cooldownInfo[nft.tokenId] || {};
    const isSelected = isNFTSelected(nft.tokenId);

    // Determine what to show below the card
    let belowCardInfo = null;

    if (type === "normal") {
      // Normal staked: show points with coin icon
      const points = calculatePoints(nft.stakeDuration || 0);
      belowCardInfo = (
        <div
          style={{
            fontSize: "0.85rem",
            fontWeight: "700",
            textAlign: "center",
            color: "#f59e0b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
            marginTop: "2px",
          }}
        >
          <CoinIcon size={18} />
          {points.toLocaleString()}
        </div>
      );
    } else if (type === "cooldown") {
      // Cooldown NFTs: show either countdown or "Ready!"
      if (info.remainingSeconds > 0) {
        belowCardInfo = (
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: "600",
              textAlign: "center",
              color: "#ff6b00",
            }}
          >
            {formatCountdown(info.remainingSeconds)}
          </div>
        );
      } else {
        belowCardInfo = (
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: "600",
              textAlign: "center",
              color: "#16a34a",
            }}
          >
            Ready!
          </div>
        );
      }
    }

    return (
      <div
        key={nft.tokenId}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
        }}
      >
        <NFTCard
          $selected={isSelected}
          onClick={() =>
            handleNFTClick(
              nft.tokenId,
              info.remainingSeconds === 0 && type === "cooldown"
                ? "ready"
                : type,
            )
          }
          style={{
            cursor: loading
              ? "not-allowed"
              : type === "cooldown" && info.remainingSeconds > 0
                ? "not-allowed"
                : "pointer",
            marginBottom: "4px",
            width: "100%",
          }}
          disabled={loading}
        >
          <img
            src={nft.image || "/raffle-images/nftphoto.png"}
            alt={nft.name || `NFT #${nft.tokenId}`}
            onError={(e) => {
              e.target.src = "/raffle-images/nftphoto.png";
            }}
          />

          <div className="nft-info">
            <div className="nft-name">{nft.name || `NFT #${nft.tokenId}`}</div>
          </div>
        </NFTCard>

        {belowCardInfo}
      </div>
    );
  };

  // Empty state
  if (stakedNFTs.length === 0) {
    return (
      <ContainerWrapper>
        <Panel>
          <ContainerHeader>
            <h2>UNSTAKE</h2>
          </ContainerHeader>
          <ContainerContent>
            <EmptyState>
              <h4>No staked NFTs found</h4>
            </EmptyState>
          </ContainerContent>
        </Panel>
      </ContainerWrapper>
    );
  }

  return (
    <ContainerWrapper>
      <Panel>
        <ContainerHeader>
          <h2>UNSTAKE</h2>
          {getSelectedCount() > 0 && (
            <SelectionCounter>{getSelectedCount()} selected</SelectionCounter>
          )}
        </ContainerHeader>

        <ContainerContent
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
          }}
        >
          {(() => {
            // Calculate sections and their heights
            const hasNormal = normalStakedNFTs.length > 0;
            const hasCooldown = cooldownNFTs.length > 0;
            const sectionsCount = (hasNormal ? 1 : 0) + (hasCooldown ? 1 : 0);
            const sectionHeight =
              sectionsCount > 0
                ? `calc((100% - 140px) / ${sectionsCount})`
                : "100%"; // 140px for button area

            return (
              <>
                {/* Normal Staked NFTs Section */}
                {hasNormal && (
                  <div
                    style={{
                      height: sectionHeight,
                      display: "flex",
                      flexDirection: "column",
                      borderBottom: hasCooldown ? "2px solid #e2e8f0" : "none",
                      paddingBottom: hasCooldown ? "1rem" : "0",
                      marginBottom: hasCooldown ? "1rem" : "0",
                    }}
                  >
                    <NFTGrid
                      style={{
                        flex: 1,
                        minHeight: 0,
                        maxHeight: "100%",
                        overflowY: "auto",
                      }}
                    >
                      {normalStakedNFTs.map((nft) =>
                        renderNFTCard(nft, "normal"),
                      )}
                    </NFTGrid>
                  </div>
                )}

                {/* Cooldown NFTs Section */}
                {hasCooldown && (
                  <div
                    style={{
                      height: sectionHeight,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <NFTGrid
                      style={{
                        flex: 1,
                        minHeight: 0,
                        maxHeight: "100%",
                        overflowY: "auto",
                      }}
                    >
                      {cooldownNFTs.map((nft) =>
                        renderNFTCard(nft, "cooldown"),
                      )}
                    </NFTGrid>
                  </div>
                )}
              </>
            );
          })()}

          {/* Action Button - always visible */}
          <ActionButtons>
            <PrimaryButton
              onClick={handleActionClick}
              disabled={loading || getSelectedCount() === 0}
              style={{ minWidth: "200px", fontSize: "1rem" }}
            >
              {getSelectionType() === "normal" && getSelectedCount() > 0 && (
                <>{loading ? "Processing..." : `Unstake (5d)`}</>
              )}
              {getSelectionType() === "ready" && getSelectedCount() > 0 && (
                <>
                  {loading ? "Processing..." : `Claim (${getSelectedCount()})`}
                </>
              )}
              {getSelectedCount() === 0 && "Select NFTs to continue"}
            </PrimaryButton>
          </ActionButtons>
        </ContainerContent>
      </Panel>

      {/* Unstake Confirmation Modal */}
      <UnstakeConfirmationModal
        isOpen={showUnstakeModal}
        onClose={() => setShowUnstakeModal(false)}
        onConfirm={handleUnstakeConfirm}
        nftCount={getSelectedCount()}
      />
    </ContainerWrapper>
  );
};

export default StakedNFTsPanel;
