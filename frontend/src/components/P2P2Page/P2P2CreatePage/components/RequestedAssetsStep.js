import React, { useEffect, useState } from 'react';
import {
  StepCard,
  StepTitle,
  StepDescription,
  FormLabel,
  FormInput,
  CollectionGrid,
  CollectionCard,
  CollectionImage,
  CollectionName,
  InlineActionButton,
  RequestedAssetsEmpty,
  TokenSelectorContainer,
  TokenSelectorRow,
  TokenToggle,
  TokenToggleThumb,
  TokenToggleButton,
  TokenLogo,
  TokenInputWrapper,
  TokenInput,
  HelperText
} from '../styles';

// LMON contract address
const LMON_CONTRACT = '0xECc6F8fB4962cBF02D83CEE8c4d9c2C96204A17D';

const RequestedAssetsStep = ({
  isVisible,
  manager,
  onCollectionSelect,
  requestedMonAmount,
  onRequestedMonChange,
  requestedLmonAmount,
  onRequestedLmonChange,
  disabled = false
}) => {
  const {
    collections,
    collectionsLoading,
    collectionsError,
    collectionSearch,
    setCollectionSearch,
    ensureCollections,
    loadCollections
  } = manager;

  // Token selector state
  const [selectedToken, setSelectedToken] = useState('MON');

  const handleAmountChange = (value, token) => {
    // Only allow integers (no decimals)
    const sanitized = value.replace(/[^0-9]/g, '');

    if (token === 'MON') {
      onRequestedMonChange(sanitized);
    } else {
      onRequestedLmonChange(sanitized);
    }
  };

  useEffect(() => {
    if (isVisible) {
      ensureCollections();
    }
  }, [isVisible, ensureCollections]);

  const handleSearchChange = (event) => {
    if (!disabled) {
      setCollectionSearch(event.target.value);
    }
  };

  const handleCollectionSelect = (collection) => {
    if (!disabled) {
      onCollectionSelect(collection);
    }
  };

  return (
    <StepCard>
      <StepTitle>What You Want</StepTitle>
      <StepDescription>
        Request tokens or NFTs from a collection
      </StepDescription>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
        <TokenSelectorContainer>
          <TokenSelectorRow>
            <TokenToggle>
              <TokenToggleThumb
                style={{
                  transform: selectedToken === 'LMON' ? 'translateX(calc(100% - 1px))' : 'translateX(0)'
                }}
              />
              <TokenToggleButton
                type="button"
                $active={selectedToken === 'MON'}
                onClick={() => setSelectedToken('MON')}
                disabled={disabled}
              >
                <TokenLogo src="/assets/images/monad.png" alt="MON" />
                MON
              </TokenToggleButton>
              <TokenToggleButton
                type="button"
                $active={selectedToken === 'LMON'}
                onClick={() => setSelectedToken('LMON')}
                disabled={disabled}
              >
                <TokenLogo src="/images/lmonphoto.png" alt="LMON" />
                LMON
              </TokenToggleButton>
            </TokenToggle>

            <TokenInputWrapper>
              <TokenInput
                placeholder={`${selectedToken} amount`}
                value={selectedToken === 'MON' ? (requestedMonAmount || '') : (requestedLmonAmount || '')}
                onChange={(e) => {
                  if (disabled) return;
                  handleAmountChange(e.target.value, selectedToken);
                }}
                disabled={disabled}
                type="text"
                inputMode="numeric"
              />
            </TokenInputWrapper>
          </TokenSelectorRow>

          <HelperText>
            {requestedMonAmount && parseFloat(requestedMonAmount) > 0 && `Requesting ${requestedMonAmount} MON`}
            {requestedLmonAmount && parseFloat(requestedLmonAmount) > 0 && requestedMonAmount && parseFloat(requestedMonAmount) > 0 && ' + '}
            {requestedLmonAmount && parseFloat(requestedLmonAmount) > 0 && `${requestedLmonAmount} LMON`}
            {(!requestedMonAmount || parseFloat(requestedMonAmount) <= 0) && (!requestedLmonAmount || parseFloat(requestedLmonAmount) <= 0) && 'Enter token amount, or select NFT collections below'}
          </HelperText>
        </TokenSelectorContainer>

        <div>
          <FormLabel>Search Collections</FormLabel>
          <FormInput
            placeholder="Search collections or paste contract address (0x...)"
            value={collectionSearch}
            onChange={handleSearchChange}
            disabled={disabled}
            style={{
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'text'
            }}
          />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <FormLabel>Available Collections</FormLabel>
          <div style={{
            flex: '1',
            overflow: 'hidden',
            border: '1px solid transparent',
            borderRadius: '8px',
            padding: '12px'
          }}>
            {collectionsLoading && !collections.length ? (
              <RequestedAssetsEmpty>Loading collections...</RequestedAssetsEmpty>
            ) : collectionsError ? (
              <RequestedAssetsEmpty>
                {collectionsError}
                <InlineActionButton type="button" onClick={loadCollections}>
                  Retry
                </InlineActionButton>
              </RequestedAssetsEmpty>
            ) : collections.length === 0 ? (
              <RequestedAssetsEmpty>No collections found.</RequestedAssetsEmpty>
            ) : (
              <CollectionGrid>
                {collections.map((collection, index) => (
                  <CollectionCard
                    type="button"
                    key={collection.id || collection.contractAddress || collection.address || `collection-${index}`}
                    $selected={false}
                    onClick={() => handleCollectionSelect(collection)}
                    disabled={disabled}
                    style={{
                      opacity: disabled ? 0.5 : 1,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      pointerEvents: disabled ? 'none' : 'auto'
                    }}
                  >
                    <CollectionImage
                      src={collection.image}
                      alt={collection.name}
                      onError={(event) => {
                        event.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y1ZjVmNSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PC9zdmc+';
                      }}
                    />
                    <CollectionName>{collection.name}</CollectionName>
                  </CollectionCard>
                ))}
              </CollectionGrid>
            )}
          </div>
        </div>
      </div>
    </StepCard>
  );
};

export default RequestedAssetsStep;
