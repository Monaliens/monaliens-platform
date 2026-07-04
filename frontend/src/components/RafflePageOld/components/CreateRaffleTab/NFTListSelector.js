import React, { useState } from "react";
import styled from "styled-components";
import {
  COLOR_CONFIG,
  INPUT_CONFIG,
  MODAL_CONFIG,
} from "../CreateRaffleModal/data/modalConfig";

const Container = styled.div`
  font-family: "Lexend", sans-serif;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const SectionTitle = styled.h4`
  font-family: "Lexend", sans-serif;
  margin: 0 0 16px 0;
  color: ${COLOR_CONFIG.text.primary};
  font-size: 16px;
  font-weight: 600;
`;

const SearchContainer = styled.div`
  margin-bottom: 16px;
  position: relative;
`;

const SearchInput = styled.input`
  font-family: "Lexend", sans-serif;
  width: 100%;
  padding: ${INPUT_CONFIG.padding};
  padding-left: 40px;
  border: ${INPUT_CONFIG.borderWidth}px solid ${COLOR_CONFIG.border.default};
  border-radius: ${MODAL_CONFIG.borderRadius.input}px;
  font-size: 14px;
  background: ${COLOR_CONFIG.background.white};
  transition: all 0.2s ease;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: ${COLOR_CONFIG.border.focus};
    box-shadow: 0 0 0 3px rgba(105, 48, 195, 0.1);
  }

  &::placeholder {
    color: ${COLOR_CONFIG.text.muted};
  }
`;

const SearchIcon = styled.div`
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: ${COLOR_CONFIG.text.muted};
  font-size: 16px;
`;

const NFTList = styled.div`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.6);
  max-height: 320px;
  min-height: 280px;
  padding: 12px;
  padding-bottom: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 10px;
  align-content: start;

  /* Custom scrollbar for better visibility */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }
`;

const NFTItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
  border: ${(props) =>
    props.$selected
      ? `3px solid ${COLOR_CONFIG.primary}`
      : "1px solid rgba(0, 0, 0, 0.1)"};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }
`;

const NFTImage = styled.img`
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  object-fit: cover;
  background: #f1f5f9;
  margin-bottom: 8px;
`;

const NFTInfo = styled.div`
  width: 100%;
  text-align: center;
`;

const NFTName = styled.div`
  font-family: "Lexend", sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: ${COLOR_CONFIG.text.primary};
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const NFTId = styled.div`
  font-family: "Lexend", sans-serif;
  font-size: 11px;
  color: ${COLOR_CONFIG.text.muted};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SelectedBadge = styled.div`
  background: ${COLOR_CONFIG.primary};
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
`;

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: ${COLOR_CONFIG.text.muted};
  font-size: 14px;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: ${COLOR_CONFIG.text.muted};
  font-size: 14px;
  text-align: center;
`;

const ErrorState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: ${COLOR_CONFIG.text.error};
  font-size: 14px;
  text-align: center;

  &::before {
    content: "⚠️";
    font-size: 48px;
    margin-bottom: 16px;
  }
`;

/**
 * NFT List Selector Component
 */
const NFTListSelector = ({
  assets = [],
  loading = false,
  error = null,
  selectedAsset = null,
  onAssetSelect,
  disabled = false,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Filter assets based on search term
  const filteredAssets = assets.filter((asset) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      asset.name?.toLowerCase().includes(searchLower) ||
      asset.tokenId?.toString().includes(searchLower) ||
      asset.contractAddress?.toLowerCase().includes(searchLower)
    );
  });

  const handleAssetClick = (asset) => {
    if (!disabled && onAssetSelect) {
      onAssetSelect(asset);
    }
  };

  if (loading) {
    return (
      <Container>
        <SectionTitle>Select NFT</SectionTitle>
        <NFTList>
          <LoadingState>Loading NFTs...</LoadingState>
        </NFTList>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <SectionTitle>Select NFT</SectionTitle>
        <NFTList>
          <ErrorState>
            Failed to load NFTs
            <br />
            {error}
          </ErrorState>
        </NFTList>
      </Container>
    );
  }

  return (
    <Container>
      <SectionTitle>Select NFT ({assets.length} available)</SectionTitle>

      {assets.length > 0 && (
        <SearchContainer>
          <SearchInput
            type="text"
            placeholder="Search NFTs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={disabled}
            style={{ paddingLeft: "12px" }}
          />
        </SearchContainer>
      )}

      <NFTList>
        {assets.length === 0 ? (
          <EmptyState>
            No Verified NFTs found in your wallet
            <br />
          </EmptyState>
        ) : filteredAssets.length === 0 ? (
          <EmptyState>
            No NFTs match your search
            <br />
            <small>Try a different search term</small>
          </EmptyState>
        ) : (
          filteredAssets.map((asset, index) => (
            <NFTItem
              key={`${asset.contractAddress}-${asset.tokenId}-${index}`}
              $selected={
                selectedAsset?.contractAddress === asset.contractAddress &&
                selectedAsset?.tokenId === asset.tokenId
              }
              onClick={() => handleAssetClick(asset)}
            >
              <NFTImage
                src={asset.imageUrl || asset.image || "/default-nft.png"}
                alt={asset.name || `NFT #${asset.tokenId}`}
                onError={(e) => {
                  e.target.src = "/default-nft.png";
                }}
              />
              <NFTInfo>
                <NFTName>{asset.name || `Unnamed NFT`}</NFTName>
                <NFTId>
                  #{asset.tokenId} • {asset.contractAddress?.slice(0, 6)}...
                  {asset.contractAddress?.slice(-4)}
                </NFTId>
              </NFTInfo>
              {selectedAsset?.contractAddress === asset.contractAddress &&
                selectedAsset?.tokenId === asset.tokenId && (
                  <SelectedBadge>Selected</SelectedBadge>
                )}
            </NFTItem>
          ))
        )}
      </NFTList>
    </Container>
  );
};

export default NFTListSelector;
