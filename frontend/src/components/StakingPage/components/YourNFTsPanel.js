import React from "react";
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

const YourNFTsPanel = ({
  nfts,
  stakedTokenIds,
  selectedNFTs,
  onSelectionChange,
  onStake,
  loading,
}) => {
  // Filter out already staked NFTs
  const availableNFTs = nfts.filter(
    (nft) => !stakedTokenIds.includes(nft.tokenId),
  );

  const handleNFTClick = (tokenId) => {
    if (loading) return;

    if (selectedNFTs.includes(tokenId)) {
      onSelectionChange(selectedNFTs.filter((id) => id !== tokenId));
    } else {
      onSelectionChange([...selectedNFTs, tokenId]);
    }
  };

  return (
    <ContainerWrapper>
      <Panel>
        <ContainerHeader>
          <h2>STAKE</h2>
          {selectedNFTs.length > 0 && (
            <SelectionCounter>
              {selectedNFTs.length} of {availableNFTs.length} selected
            </SelectionCounter>
          )}
        </ContainerHeader>
        <ContainerContent>
          {availableNFTs.length === 0 ? (
            <EmptyState>
              <h4>No NFTs available to stake</h4>
            </EmptyState>
          ) : (
            <>
              <NFTGrid>
                {availableNFTs.map((nft) => (
                  <NFTCard
                    key={nft.tokenId}
                    $selected={selectedNFTs.includes(nft.tokenId)}
                    onClick={() => handleNFTClick(nft.tokenId)}
                    disabled={loading}
                  >
                    <img
                      src={nft.image || "/raffle-images/nftphoto.png"}
                      alt={nft.name}
                      onError={(e) => {
                        e.target.src = "/raffle-images/nftphoto.png";
                      }}
                    />
                    <div className="nft-info">
                      <div className="nft-name">{nft.name}</div>
                    </div>
                  </NFTCard>
                ))}
              </NFTGrid>
            </>
          )}

          {availableNFTs.length > 0 && (
            <ActionButtons>
              <PrimaryButton
                onClick={onStake}
                disabled={selectedNFTs.length === 0 || loading}
                style={{ minWidth: "200px", fontSize: "1rem" }}
              >
                {loading
                  ? "Processing..."
                  : `Stake ${selectedNFTs.length > 0 ? `(${selectedNFTs.length})` : ""}`}
              </PrimaryButton>
            </ActionButtons>
          )}
        </ContainerContent>
      </Panel>
    </ContainerWrapper>
  );
};

export default YourNFTsPanel;
