import React, { useState, useEffect } from 'react';
import {
  StepCard,
  StepTitle,
  StepDescription,
  AssetGrid,
  AssetCard,
  AssetImage,
  AssetInfo,
  AssetName,
  AssetCollection,
  FormInput,
  FormLabel,
  ActionButton,
  HelperText,
  Segmented,
  SegmentedThumb,
  SegmentedOption
} from '../styles';

const NFTSelectionContainer = ({
  selectedCollection,
  listings,
  listingsLoading,
  listingsError,
  onSave,
  onCancel,
  initialSelections = [],
  disabled = false
}) => {
  const [selectionMode, setSelectionMode] = useState('specific'); // 'specific' or 'amount'
  const [selectedNFTs, setSelectedNFTs] = useState(new Set());
  const [requestedAmount, setRequestedAmount] = useState('');
  const [manualTokenIds, setManualTokenIds] = useState('');

  // Initialize with previous selections for THIS collection only
  useEffect(() => {
    if (!selectedCollection) return;
    
    // Reset states first
    setSelectedNFTs(new Set());
    setRequestedAmount('');
    setSelectionMode('specific');
    
    // Filter selections for current collection only
    const currentCollectionSelections = initialSelections.filter(item => {
      const itemCollectionAddress = item.collectionAddress || item.collectionId;
      const currentCollectionAddress = selectedCollection.contractAddress || selectedCollection.primaryContract || selectedCollection.address || selectedCollection.id;
      return itemCollectionAddress === currentCollectionAddress;
    });
    
    if (currentCollectionSelections.length > 0) {
      const nftIds = new Set();
      let hasCollectionRequest = false;
      let collectionAmount = '';
      
      currentCollectionSelections.forEach(item => {
        if (item.type === 'specific') {
          nftIds.add(item.tokenId);
        } else if (item.type === 'collection') {
          collectionAmount = item.quantity.toString();
          hasCollectionRequest = true;
        }
      });
      
      setSelectedNFTs(nftIds);
      setRequestedAmount(collectionAmount);
      
      // Set mode based on what we have
      if (hasCollectionRequest && nftIds.size > 0) {
        setSelectionMode('specific'); // Hybrid mode, show specific
      } else if (hasCollectionRequest) {
        setSelectionMode('amount');
      } else {
        setSelectionMode('specific');
      }
    }
  }, [selectedCollection, initialSelections]);

  const handleNFTToggle = (nft) => {
    if (disabled) return;
    const tokenId = nft.tokenId || nft.token_id || nft.id;
    const newSelected = new Set(selectedNFTs);

    if (newSelected.has(tokenId)) {
      newSelected.delete(tokenId);
    } else {
      newSelected.add(tokenId);
    }

    setSelectedNFTs(newSelected);
    // Clear amount when specific NFTs are selected
    setRequestedAmount('');
  };

  const handleManualTokenAdd = () => {
    if (disabled || !manualTokenIds.trim()) return;

    const tokenIds = manualTokenIds.split(',').map(id => id.trim()).filter(Boolean);
    const newSelected = new Set(selectedNFTs);

    tokenIds.forEach(tokenId => {
      newSelected.add(tokenId);
    });

    setSelectedNFTs(newSelected);
    setManualTokenIds('');
    // Clear amount when specific NFTs are selected
    setRequestedAmount('');
  };

  const handleSave = () => {
    if (disabled) return;
    const selections = [];
    
    // Only add specific NFTs OR amount, not both
    if (selectedNFTs.size > 0) {
      // Add specific NFT selections
      selectedNFTs.forEach(tokenId => {
        const nft = listings.find(item => 
          (item.tokenId || item.token_id || item.id) === tokenId
        );
        const collectionAddress = selectedCollection.contractAddress || selectedCollection.primaryContract || selectedCollection.address || selectedCollection.id;

        selections.push({
          id: `${selectedCollection.id || selectedCollection.contractAddress || selectedCollection.address}-${tokenId}`,
          type: 'specific',
          tokenId: tokenId,
          name: nft?.name || `Token #${tokenId}`,
          collectionName: selectedCollection.name,
          collectionAddress,
          collectionId: selectedCollection.contractAddress || selectedCollection.address || selectedCollection.id
        });
      });
    } else {
      // Add amount request if specified
      const amount = parseInt(requestedAmount);
      if (requestedAmount && amount > 0) {
        const collectionAddress = selectedCollection.contractAddress || selectedCollection.primaryContract || selectedCollection.address || selectedCollection.id;
        const collectionId = selectedCollection.contractAddress || selectedCollection.primaryContract || selectedCollection.address || selectedCollection.id;
        selections.push({
          id: `${collectionId}-quantity-${amount}`,
          type: 'collection',
          quantity: amount,
          collectionName: selectedCollection.name,
          collectionAddress,
          collectionId,
          collectionKey: collectionId
        });
      }
    }
    
    onSave(selections);
  };

  const isNFTSelected = (nft) => {
    const tokenId = nft.tokenId || nft.token_id || nft.id;
    return selectedNFTs.has(tokenId);
  };

  const getSelectionSummary = () => {
    const selectedCount = selectedNFTs.size;
    const amount = parseInt(requestedAmount) || 0;

    if (selectedCount === 0 && amount === 0) {
      return 'No selections yet';
    }

    // Only show one type at a time
    if (selectedCount > 0) {
      return `${selectedCount} specific NFT${selectedCount > 1 ? 's' : ''}`;
    } else if (amount > 0) {
      return `${amount} from collection`;
    }

    return 'No selections yet';
  };

  return (
    <StepCard>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
        {/* Segmented control */}
        <Segmented>
          <SegmentedThumb
            style={{ transform: selectionMode === 'specific' ? 'translateX(0%)' : 'translateX(100%)' }}
            aria-hidden
          />
          <SegmentedOption
            type="button"
            $active={selectionMode === 'specific'}
            onClick={() => !disabled && setSelectionMode('specific')}
            aria-pressed={selectionMode === 'specific'}
            disabled={disabled}
            style={{
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
              pointerEvents: disabled ? 'none' : 'auto'
            }}
          >
            Specific NFTs
          </SegmentedOption>
          <SegmentedOption
            type="button"
            $active={selectionMode === 'amount'}
            onClick={() => !disabled && setSelectionMode('amount')}
            aria-pressed={selectionMode === 'amount'}
            disabled={disabled}
            style={{
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
              pointerEvents: disabled ? 'none' : 'auto'
            }}
          >
            Amount
          </SegmentedOption>
        </Segmented>

        {/* Amount Mode */}
        {selectionMode === 'amount' && (
          <div>
            <FormLabel>How many NFTs do you want?</FormLabel>
            <FormInput
              type="number"
              min="1"
              placeholder="Enter amount"
              value={requestedAmount}
              onChange={(e) => {
                if (!disabled) {
                  setRequestedAmount(e.target.value);
                  // Clear specific NFTs when amount is entered
                  if (e.target.value) {
                    setSelectedNFTs(new Set());
                  }
                }
              }}
              disabled={disabled}
              style={{
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? 'not-allowed' : 'text'
              }}
            />
            <HelperText>
              Request any {requestedAmount || 'X'} NFTs from this collection
            </HelperText>
          </div>
        )}

        {/* Specific Mode */}
        {selectionMode === 'specific' && (
          <>
            {/* Manual Token ID Input */}
            <div>
              <FormLabel>Add Token IDs manually</FormLabel>
              <div style={{ display: 'flex', gap: '8px' }}>
                <FormInput
                  placeholder="Enter token IDs (1,2,3)"
                  value={manualTokenIds}
                  onChange={(e) => {
                    if (!disabled) {
                      // Only allow numbers and commas
                      const value = e.target.value.replace(/[^0-9,]/g, '');
                      setManualTokenIds(value);
                    }
                  }}
                  onKeyPress={(e) => {
                    if (!disabled && e.key === 'Enter' && manualTokenIds.trim()) {
                      handleManualTokenAdd();
                    }
                  }}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    opacity: disabled ? 0.5 : 1,
                    cursor: disabled ? 'not-allowed' : 'text'
                  }}
                />
                <ActionButton
                  onClick={handleManualTokenAdd}
                  disabled={!manualTokenIds.trim() || disabled}
                  style={{
                    minWidth: '30px',
                    width: '30px',
                    height: '30px',
                    padding: '0',
                    fontSize: '14px',
                    opacity: (disabled || !manualTokenIds.trim()) ? 0.5 : 1,
                    cursor: (disabled || !manualTokenIds.trim()) ? 'not-allowed' : 'pointer',
                    pointerEvents: (disabled || !manualTokenIds.trim()) ? 'none' : 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  +
                </ActionButton>
              </div>
            </div>

            {/* NFT Grid */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <FormLabel>Available NFTs</FormLabel>
              <AssetGrid style={{
                height: '250px',
                overflow: 'auto',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px'
              }}>
            {listingsLoading ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px' }}>
                Loading NFTs...
              </div>
            ) : listingsError ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: 'red' }}>
                Error loading NFTs
              </div>
            ) : listings.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px' }}>
                No NFTs found
              </div>
            ) : (
              listings.map((nft, index) => {
                const tokenId = nft.tokenId || nft.token_id || nft.id || `nft-${index}`;
                const isSelected = isNFTSelected(nft);
                const collectionAddress = selectedCollection?.contractAddress || selectedCollection?.primaryContract || selectedCollection?.address || selectedCollection?.id || 'unknown';
                const uniqueKey = `${collectionAddress}-${tokenId}-${index}`;

                return (
                        <AssetCard
                          key={uniqueKey}
                          $selected={isSelected}
                          onClick={() => handleNFTToggle(nft)}
                          style={{
                            padding: '4px',
                            opacity: disabled ? 0.5 : 1,
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            pointerEvents: disabled ? 'none' : 'auto'
                          }}
                        >
                          {nft.image ? (
                            <AssetImage 
                              src={nft.image} 
                              alt={nft.name || `Token ${tokenId}`}
                              style={{ marginBottom: '4px' }}
                            />
                          ) : (
                            <AssetImage 
                              as="div" 
                              className="placeholder"
                              style={{ marginBottom: '4px', fontSize: '10px' }}
                            >
                              <span>NFT</span>
                            </AssetImage>
                          )}
                          <AssetInfo style={{ padding: '2px' }}>
                            <AssetName style={{ fontSize: '9px' }}>
                              {nft.name || `#${tokenId}`}
                            </AssetName>
                          </AssetInfo>
                        </AssetCard>
                );
              })
            )}
              </AssetGrid>
            </div>

          </>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginTop: 'auto',
          paddingTop: '16px',
          borderTop: '1px solid rgba(105, 48, 195, 0.1)'
        }}>
          <ActionButton
            onClick={onCancel}
            disabled={disabled}
            style={{
              flex: 1,
              background: 'transparent',
              color: '#6b7280',
              border: '2px solid #6b7280',
              padding: '12px 16px',
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
              pointerEvents: disabled ? 'none' : 'auto'
            }}
          >
            Cancel
          </ActionButton>
          <ActionButton
            onClick={handleSave}
            disabled={disabled}
            style={{
              flex: 1,
              padding: '12px 16px',
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
              pointerEvents: disabled ? 'none' : 'auto'
            }}
          >
            Save Selection
          </ActionButton>
        </div>
      </div>
    </StepCard>
  );
};

export default NFTSelectionContainer;
