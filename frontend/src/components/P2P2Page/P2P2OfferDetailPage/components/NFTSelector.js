import React, { useState, useMemo } from 'react';
import styled from 'styled-components';

const SelectorContainer = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 420px;
  max-height: 500px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(12px);
  border: 2px solid rgba(105, 48, 195, 0.2);
  border-radius: 16px;
  box-shadow: 0 16px 40px rgba(105, 48, 195, 0.3);
  overflow: hidden;
  z-index: 1000;
  display: flex;
  flex-direction: column;
`;

const SelectorHeader = styled.div`
  padding: 16px 20px;
  background: linear-gradient(135deg, rgba(105, 48, 195, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
  border-bottom: 1px solid rgba(105, 48, 195, 0.15);
`;

const SelectorTitle = styled.h3`
  margin: 0 0 4px 0;
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
`;

const SelectorSubtitle = styled.p`
  margin: 0;
  font-size: 12px;
  color: #6b7280;
`;

const SelectorBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(105, 48, 195, 0.05);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(105, 48, 195, 0.3);
    border-radius: 3px;

    &:hover {
      background: rgba(105, 48, 195, 0.5);
    }
  }
`;

const CollectionGroup = styled.div`
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const CollectionHeader = styled.div`
  margin-bottom: 12px;
  padding: 8px 12px;
  background: rgba(105, 48, 195, 0.08);
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const CollectionName = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: #1f2937;
`;

const CollectionRequirement = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: ${props => props.$fulfilled ? '#16a34a' : '#dc2626'};
  background: ${props => props.$fulfilled ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)'};
  padding: 3px 8px;
  border-radius: 6px;
`;

const NFTGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
`;

const NFTCard = styled.label`
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 10px;
  background: ${props => props.$selected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.8)'};
  border: 2px solid ${props => props.$selected ? 'rgba(16, 185, 129, 0.4)' : 'rgba(105, 48, 195, 0.1)'};
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    border-color: ${props => props.$selected ? 'rgba(16, 185, 129, 0.6)' : 'rgba(105, 48, 195, 0.25)'};
    box-shadow: 0 6px 16px rgba(105, 48, 195, 0.15);
  }
`;

const NFTCheckbox = styled.input.attrs({ type: 'checkbox' })`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #10b981;
`;

const NFTImage = styled.img`
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  object-fit: cover;
  margin-bottom: 8px;
  background: rgba(105, 48, 195, 0.05);
`;

const NFTImagePlaceholder = styled.div`
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  margin-bottom: 8px;
  background: linear-gradient(135deg, rgba(105, 48, 195, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: #6930c3;
`;

const NFTName = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SelectorFooter = styled.div`
  padding: 16px 20px;
  background: rgba(248, 250, 252, 0.8);
  border-top: 1px solid rgba(105, 48, 195, 0.15);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const SelectionCounter = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
`;

const FooterButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const CancelButton = styled.button`
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid rgba(105, 48, 195, 0.2);
  background: white;
  color: #6930c3;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(105, 48, 195, 0.05);
    border-color: rgba(105, 48, 195, 0.3);
  }
`;

const ConfirmButton = styled.button`
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: ${props => props.disabled
    ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
  };
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  opacity: ${props => props.disabled ? 0.6 : 1};
  transition: all 0.2s ease;

  &:hover {
    transform: ${props => props.disabled ? 'none' : 'translateY(-1px)'};
    box-shadow: ${props => props.disabled ? 'none' : '0 6px 16px rgba(16, 185, 129, 0.3)'};
  }
`;

const EmptyState = styled.div`
  padding: 32px 16px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
`;

/**
 * NFT Selector Dropdown - Appears below Accept Offer button
 * @param {Array} collectionRequests - Collection requests from offer
 * @param {Array} userNFTs - User's available NFTs
 * @param {Function} onConfirm - Callback with selected NFTs
 * @param {Function} onCancel - Close selector
 */
const NFTSelector = ({ collectionRequests, userNFTs, onConfirm, onCancel }) => {
  const [selectedNFTs, setSelectedNFTs] = useState({});

  // Group user's NFTs by collection
  const nftsByCollection = useMemo(() => {
    const grouped = {};

    collectionRequests.forEach(request => {
      const collectionAddress = request.contractAddress?.toLowerCase();
      const required = request.amount || 1;
      const collectionName = request.metadata?.collectionName || request.metadata?.name || 'Unknown Collection';

      grouped[collectionAddress] = {
        name: collectionName,
        required,
        nfts: userNFTs.filter(nft => nft.contractAddress === collectionAddress)
      };
    });

    return grouped;
  }, [collectionRequests, userNFTs]);

  // Toggle NFT selection
  const handleToggleNFT = (collectionAddress, nftId) => {
    setSelectedNFTs(prev => {
      const collectionSelections = prev[collectionAddress] || [];
      const isSelected = collectionSelections.includes(nftId);
      const required = nftsByCollection[collectionAddress]?.required || 0;

      if (isSelected) {
        // Deselect
        return {
          ...prev,
          [collectionAddress]: collectionSelections.filter(id => id !== nftId)
        };
      } else {
        // Check if max limit reached
        if (collectionSelections.length >= required) {
          return prev; // Don't allow more selections than required
        }

        // Select
        return {
          ...prev,
          [collectionAddress]: [...collectionSelections, nftId]
        };
      }
    });
  };

  // Validation: Check if all requirements are met
  const isValid = useMemo(() => {
    return Object.keys(nftsByCollection).every(collectionAddress => {
      const { required } = nftsByCollection[collectionAddress];
      const selected = selectedNFTs[collectionAddress]?.length || 0;
      return selected >= required;
    });
  }, [nftsByCollection, selectedNFTs]);

  // Count total selections
  const totalSelected = useMemo(() => {
    return Object.values(selectedNFTs).reduce((sum, arr) => sum + arr.length, 0);
  }, [selectedNFTs]);

  const totalRequired = useMemo(() => {
    return Object.values(nftsByCollection).reduce((sum, group) => sum + Number(group.required), 0);
  }, [nftsByCollection]);

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm(selectedNFTs);
  };

  return (
    <SelectorContainer onClick={(e) => e.stopPropagation()}>
      <SelectorHeader>
        <SelectorTitle>Select NFTs to Trade</SelectorTitle>
        <SelectorSubtitle>Choose which NFTs you want to offer</SelectorSubtitle>
      </SelectorHeader>

      <SelectorBody>
        {Object.keys(nftsByCollection).length === 0 ? (
          <EmptyState>No NFTs available</EmptyState>
        ) : (
          Object.entries(nftsByCollection).map(([collectionAddress, group]) => {
            const selected = selectedNFTs[collectionAddress]?.length || 0;
            const fulfilled = selected >= group.required;

            return (
              <CollectionGroup key={collectionAddress}>
                <CollectionHeader>
                  <CollectionName>{group.name}</CollectionName>
                  <CollectionRequirement $fulfilled={fulfilled}>
                    {selected}/{group.required} selected
                  </CollectionRequirement>
                </CollectionHeader>

                <NFTGrid>
                  {group.nfts.map(nft => {
                    const nftId = `${nft.contractAddress}-${nft.tokenId}`;
                    const isSelected = selectedNFTs[collectionAddress]?.includes(nftId) || false;
                    const selected = selectedNFTs[collectionAddress]?.length || 0;
                    const isDisabled = !isSelected && selected >= group.required;

                    return (
                      <NFTCard
                        key={nftId}
                        $selected={isSelected}
                        htmlFor={nftId}
                        style={{ opacity: isDisabled ? 0.5 : 1, cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                      >
                        <NFTCheckbox
                          id={nftId}
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => handleToggleNFT(collectionAddress, nftId)}
                        />

                        {nft.image ? (
                          <NFTImage src={nft.image} alt={nft.name} />
                        ) : (
                          <NFTImagePlaceholder>NFT</NFTImagePlaceholder>
                        )}

                        <NFTName>{nft.name}</NFTName>
                      </NFTCard>
                    );
                  })}
                </NFTGrid>
              </CollectionGroup>
            );
          })
        )}
      </SelectorBody>

      <SelectorFooter>
        <SelectionCounter>
          Selected: {totalSelected}/{totalRequired}
        </SelectionCounter>

        <FooterButtons>
          <CancelButton onClick={onCancel}>Cancel</CancelButton>
          <ConfirmButton disabled={!isValid} onClick={handleConfirm}>
            Confirm & Accept
          </ConfirmButton>
        </FooterButtons>
      </SelectorFooter>
    </SelectorContainer>
  );
};

export default NFTSelector;
