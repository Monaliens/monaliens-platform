import React, { useState } from 'react';
import styled from 'styled-components';
import { COLOR_CONFIG, GRID_CONFIG, MODAL_CONFIG, INPUT_CONFIG } from '../data/modalConfig';
import { ASSET_DISPLAY_CONFIG } from '../data/assetConfig';
import { PRIZE_TYPES, NFT_CONTRACTS, DEFAULT_NFT_IMAGE } from '../../../utils/constants';

const Container = styled.div`
  font-family: 'Lexend', sans-serif;
  margin-bottom: ${MODAL_CONFIG.spacing.section}px;
`;

const SectionTitle = styled.h3`
  font-family: 'Lexend', sans-serif;
  margin: 0 0 16px 0;
  color: ${COLOR_CONFIG.text.primary};
  font-size: 18px;
  font-weight: 600;
`;

const SearchContainer = styled.div`
  margin-bottom: 16px;
  position: relative;
`;

const SearchInput = styled.input`
  font-family: 'Lexend', sans-serif;
  width: 100%;
  padding: ${INPUT_CONFIG.padding};
  padding-left: 40px;
  border: ${INPUT_CONFIG.borderWidth}px solid ${COLOR_CONFIG.border.default};
  border-radius: ${MODAL_CONFIG.borderRadius.input}px;
  font-size: ${INPUT_CONFIG.fontSize}px;
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
  pointer-events: none;
`;

const AssetGrid = styled.div`
  display: grid;
  grid-template-columns: ${props => props.$isNFTGrid ? 'repeat(auto-fill, minmax(140px, 1fr))' : 'repeat(auto-fill, minmax(280px, 1fr))'};
  gap: ${props => props.$isNFTGrid ? '16px' : '16px'};
  max-height: ${props => props.$isNFTGrid ? '40vh' : '400px'};
  overflow-y: auto;
  padding: ${props => props.$isNFTGrid ? '4px' : '8px'};
  
  /* Modern scrollbar styling */
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: ${props => props.$isNFTGrid ? '#f1f5f9' : COLOR_CONFIG.background.muted};
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${props => props.$isNFTGrid ? '#d1d5db' : COLOR_CONFIG.border.default};
    border-radius: 3px;
    
    &:hover {
      background: ${props => props.$isNFTGrid ? '#9ca3af' : COLOR_CONFIG.border.selected};
    }
  }
`;

const AssetCard = styled.div`
  background: ${COLOR_CONFIG.background.white};
  border: 2px solid ${props => props.$selected ? COLOR_CONFIG.border.selected : COLOR_CONFIG.border.default};
  border-radius: 12px;
  padding: ${props => props.$isNFT ? '12px' : '16px'};
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: ${props => props.$isNFT ? 'column' : 'row'};
  align-items: center;
  gap: ${props => props.$isNFT ? '8px' : '16px'};
  min-height: ${props => props.$isNFT ? 'auto' : '80px'};
  text-align: ${props => props.$isNFT ? 'center' : 'left'};
  
  &:hover {
    border-color: ${COLOR_CONFIG.border.selected};
  }
  
  &:active {
    background: rgba(105, 48, 195, 0.1);
  }
  
  ${props => props.$selected && `
    background: rgba(105, 48, 195, 0.1);
  `}
`;

const AssetImage = styled.div`
  width: ${props => props.$isNFT ? '100%' : '60px'};
  height: ${props => props.$isNFT ? '100px' : '60px'};
  background: ${props => props.$isNFT ? '#f1f5f9' : COLOR_CONFIG.primaryGradient};
  border-radius: ${props => props.$isNFT ? '8px' : '10px'};
  margin-bottom: ${props => props.$isNFT ? '8px' : '0'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${COLOR_CONFIG.text.white};
  font-size: ${props => props.$isNFT ? '24px' : '20px'};
  font-weight: bold;
  overflow: hidden;
  flex-shrink: 0;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: ${props => props.$isNFT ? '8px' : '10px'};
  }
`;

const AssetInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${props => props.$isNFT ? '4px' : '6px'};
  min-width: 0; /* Allows text truncation */
  text-align: ${props => props.$isNFT ? 'center' : 'left'};
`;

const AssetName = styled.div`
  font-family: 'Lexend', sans-serif;
  font-weight: ${props => props.$isNFT ? '500' : '600'};
  color: ${props => props.$isNFT ? '#1e293b' : COLOR_CONFIG.text.primary};
  font-size: ${props => props.$isNFT ? '0.8rem' : '16px'};
  line-height: ${props => props.$isNFT ? '1.2' : '1.2'};
  text-align: ${props => props.$isNFT ? 'center' : 'left'};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: ${props => props.$isNFT ? 'normal' : 'nowrap'};
  word-break: ${props => props.$isNFT ? 'break-word' : 'normal'};
  display: ${props => props.$isNFT ? '-webkit-box' : 'block'};
  -webkit-line-clamp: ${props => props.$isNFT ? '2' : 'unset'};
  -webkit-box-orient: ${props => props.$isNFT ? 'vertical' : 'unset'};
`;

const AssetDetails = styled.div`
  font-family: 'Lexend', sans-serif;
  font-size: ${props => props.$isNFT ? '11px' : '13px'};
  color: ${COLOR_CONFIG.text.muted};
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: ${props => props.$isNFT ? 'normal' : 'nowrap'};
  word-break: ${props => props.$isNFT ? 'break-word' : 'normal'};
  display: ${props => props.$isNFT ? '-webkit-box' : 'block'};
  -webkit-line-clamp: ${props => props.$isNFT ? '1' : 'unset'};
  -webkit-box-orient: ${props => props.$isNFT ? 'vertical' : 'unset'};
`;

const AssetBadge = styled.div`
  ${props => props.$isNFT ? `
    position: absolute;
    top: 8px;
    right: 8px;
    width: 20px;
    height: 20px;
    background: ${props.$selected ? '#6930c3' : '#e2e8f0'};
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${props.$selected ? 'white' : '#64748b'};
    font-size: 12px;
    font-weight: bold;
    transition: all 0.3s ease;
  ` : `
    background: ${props.$selected ? COLOR_CONFIG.primary : COLOR_CONFIG.background.card};
    color: ${props.$selected ? COLOR_CONFIG.text.white : COLOR_CONFIG.text.muted};
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    flex-shrink: 0;
    transition: all 0.2s ease;
  `}
`;

const SelectionIndicator = styled.div`
  ${props => props.$isNFT ? 'display: none;' : `
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid ${props.$selected ? COLOR_CONFIG.primary : COLOR_CONFIG.border.default};
    background: ${props.$selected ? COLOR_CONFIG.primary : 'transparent'};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.2s ease;
    
    &::after {
      content: ${props.$selected ? '"✓"' : '""'};
      color: white;
      font-size: 12px;
      font-weight: bold;
    }
  `}
`;

const LoadingContainer = styled.div`
  font-family: 'Lexend', sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: ${COLOR_CONFIG.text.muted};
`;

const LoadingSpinner = styled.div`
  width: 32px;
  height: 32px;
  border: 3px solid ${COLOR_CONFIG.border.default};
  border-top: 3px solid ${COLOR_CONFIG.primary};
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 12px;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const EmptyState = styled.div`
  font-family: 'Lexend', sans-serif;
  text-align: center;
  padding: 40px 20px;
  color: ${COLOR_CONFIG.text.muted};
  
  .icon {
    font-size: ${ASSET_DISPLAY_CONFIG.emptyState.iconSize}px;
    margin-bottom: 16px;
    color: ${COLOR_CONFIG.text.muted};
  }
  
  h3 {
    font-size: 18px;
    margin-bottom: 8px;
    color: ${COLOR_CONFIG.text.primary};
  }
  
  p {
    font-size: 14px;
    margin: 0;
    line-height: 1.5;
  }
`;

const ErrorState = styled(EmptyState)`
  .icon {
    color: ${COLOR_CONFIG.status.error};
  }
  
  h3 {
    color: ${COLOR_CONFIG.status.error};
  }
`;

const ErrorText = styled.div`
  font-family: 'Lexend', sans-serif;
  color: ${COLOR_CONFIG.text.error};
  font-size: 12px;
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: ${MODAL_CONFIG.borderRadius.button}px;
  border: 1px solid rgba(239, 68, 68, 0.2);
`;

/**
 * Asset selector component
 * @param {Object} props - Component props
 * @param {Array} props.assets - Available assets
 * @param {boolean} props.loading - Loading state
 * @param {string} props.error - Error message
 * @param {Object} props.selectedAsset - Currently selected asset
 * @param {Function} props.onAssetSelect - Asset selection handler
 * @param {string} props.prizeType - Current prize type
 * @param {boolean} props.disabled - Whether selection is disabled
 * @returns {JSX.Element} Asset selector
 */
export const AssetSelector = ({
  assets = [],
  loading = false,
  error = null,
  selectedAsset = null,
  onAssetSelect,
  prizeType,
  disabled = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Helper functions - define these first
  const getAssetIcon = () => prizeType === PRIZE_TYPES.TOKEN ? 'T' : 'N';
  const getAssetTypeName = () => prizeType === PRIZE_TYPES.TOKEN ? 'tokens' : 'NFTs';
  
  const getAssetDisplay = (asset) => {
    if (prizeType === PRIZE_TYPES.TOKEN) {
      return {
        name: asset.name || asset.symbol,
        details: `Balance: ${asset.balance} ${asset.symbol}`,
        image: asset.logo
      };
    } else {
      // NFT için özel görüntüleme mantığı
      const isBleepOrDing = asset.contractAddress === NFT_CONTRACTS.BLEEP1 ||
                            asset.contractAddress === NFT_CONTRACTS.BLEEP2 ||
                            asset.contractAddress === NFT_CONTRACTS.BLEEP3 ||
                            asset.contractAddress === NFT_CONTRACTS.BLEEP4 ||
                            asset.contractAddress === NFT_CONTRACTS.DING ||
                            asset.contractAddress === NFT_CONTRACTS.DING2 ||
                            asset.contractAddress === NFT_CONTRACTS.DING3;
      
      return {
        name: asset.name || `#${asset.tokenId}`,
        details: asset.collection?.name || 'Unknown Collection',
        image: isBleepOrDing ? DEFAULT_NFT_IMAGE : asset.image
      };
    }
  };

  // Filter assets based on search query
  const filteredAssets = assets.filter(asset => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    const display = getAssetDisplay(asset);
    
    return (
      display.name.toLowerCase().includes(query) ||
      display.details.toLowerCase().includes(query) ||
      (asset.tokenId && asset.tokenId.toString().includes(query))
    );
  });

  // Debug logging
  // console.log('AssetSelector Debug:', {
  //   assets,
  //   assetsType: typeof assets,
  //   isArray: Array.isArray(assets),
  //   assetsLength: assets?.length,
  //   prizeType,
  //   loading,
  //   error
  // });

  const renderContent = () => {
    if (loading) {
      return (
        <LoadingContainer>
          <LoadingSpinner />
          Loading your assets...
        </LoadingContainer>
      );
    }

    if (error) {
      return (
        <ErrorState>
          <div className="icon">⚠️</div>
          <h3>Error loading assets</h3>
          <p>{error}</p>
        </ErrorState>
      );
    }

    if (assets.length === 0) {
      const emptyMessage = ASSET_DISPLAY_CONFIG.emptyState.messages[
        prizeType === PRIZE_TYPES.TOKEN ? 'noTokens' : 'noNFTs'
      ];
      
      return (
        <EmptyState>
          <div className="icon">{getAssetIcon()}</div>
          <h3>No {getAssetTypeName()} found</h3>
          <p>{emptyMessage}</p>
        </EmptyState>
      );
    }

    // Additional safety check
    if (!Array.isArray(assets)) {
      console.error('Assets is not an array:', assets);
      return (
        <ErrorState>
          <div className="icon">⚠️</div>
          <h3>Invalid data format</h3>
          <p>Assets data is not in the expected format.</p>
        </ErrorState>
      );
    }

    // Show no results message if search yields no results
    if (filteredAssets.length === 0 && searchQuery) {
      return (
        <EmptyState>
          <div className="icon">🔍</div>
          <h3>No results found</h3>
          <p>No {getAssetTypeName()} match your search "{searchQuery}"</p>
        </EmptyState>
      );
    }

    return (
      <AssetGrid $isNFTGrid={prizeType === PRIZE_TYPES.NFT}>
        {filteredAssets.map((asset, index) => {
          const display = getAssetDisplay(asset);
          const isSelected = selectedAsset === asset;
          
          return (
            <AssetCard
              key={index}
              $selected={isSelected}
              $isNFT={prizeType === PRIZE_TYPES.NFT}
              onClick={() => !disabled && onAssetSelect(asset)}
              style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
            >
              <AssetBadge $selected={isSelected} $isNFT={prizeType === PRIZE_TYPES.NFT}>
                {prizeType === PRIZE_TYPES.TOKEN ? 'Token' : '✓'}
              </AssetBadge>
              
              <AssetImage $isNFT={prizeType === PRIZE_TYPES.NFT}>
                {display.image ? (
                  <img src={display.image} alt={display.name} />
                ) : (
                  getAssetIcon()
                )}
              </AssetImage>
              
              {prizeType === PRIZE_TYPES.NFT ? (
                <AssetName $isNFT={true} title={display.name}>
                  {display.name}
                </AssetName>
              ) : (
                <>
                  <AssetInfo $isNFT={false}>
                    <AssetName $isNFT={false} title={display.name}>
                      {display.name}
                    </AssetName>
                    <AssetDetails $isNFT={false} title={display.details}>
                      {display.details}
                    </AssetDetails>
                  </AssetInfo>
                  <SelectionIndicator $selected={isSelected} $isNFT={false} />
                </>
              )}
            </AssetCard>
          );
        })}
      </AssetGrid>
    );
  };

  return (
    <Container>
      <SectionTitle>Asset Selection</SectionTitle>
      
      {/* Search Input - only show for NFTs and when there are assets */}
      {prizeType === PRIZE_TYPES.NFT && assets.length > 0 && !loading && (
        <SearchContainer>
          <SearchIcon>🔍</SearchIcon>
          <SearchInput
            type="text"
            placeholder="Search NFTs by name, collection, or token ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={disabled}
          />
        </SearchContainer>
      )}
      
      {renderContent()}
      {error && (
        <ErrorText>
          {error}
        </ErrorText>
      )}
    </Container>
  );
};

export default AssetSelector; 