import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import styled, { keyframes } from 'styled-components';
import { ASSET_TYPES } from '../P2P2CreatePage/utils/constants';
import { toMonDisplay } from '../P2P2CreatePage/utils/assetHelpers';

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const TooltipContainer = styled.div`
  position: fixed;
  width: 340px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(105, 48, 195, 0.15);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(105, 48, 195, 0.2);
  padding: 16px;
  z-index: 10000;
  pointer-events: none;
  animation: ${fadeIn} 0.2s ease;
`;

const TooltipHeader = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-family: var(--font-primary);
`;

const TradeSection = styled.div`
  margin-bottom: 12px;
`;

const SectionTitle = styled.div`
  font-size: 10px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  font-family: var(--font-primary);
`;

const AssetList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const AssetRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(105, 48, 195, 0.08);
  border-radius: 8px;
  transition: all 0.2s ease;
`;

const AssetImage = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
  background: rgba(105, 48, 195, 0.05);
`;

const AssetIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: ${props => props.$color || 'rgba(105, 48, 195, 0.1)'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: #6930c3;
  flex-shrink: 0;
`;

const AssetInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const AssetName = styled.div`
  font-weight: 600;
  font-size: 12px;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AssetValue = styled.div`
  font-size: 10px;
  color: #6b7280;
  font-family: 'Courier New', monospace;
`;

const TotalRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: rgba(105, 48, 195, 0.04);
  border-radius: 6px;
  border: 1px solid rgba(105, 48, 195, 0.1);
`;

const TotalLabel = styled.div`
  font-size: 10px;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-family: var(--font-primary);
`;

const TotalValue = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: #1f2937;
  font-family: 'Courier New', monospace;
`;

const NetSection = styled.div`
  margin-top: 10px;
  padding: 10px;
  background: ${props => {
    if (props.$netValue > 0) return 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)';
    if (props.$netValue < 0) return 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)';
    return 'rgba(107, 114, 128, 0.08)';
  }};
  border-radius: 8px;
  border: 1px solid ${props => {
    if (props.$netValue > 0) return 'rgba(34, 197, 94, 0.25)';
    if (props.$netValue < 0) return 'rgba(239, 68, 68, 0.25)';
    return 'rgba(107, 114, 128, 0.25)';
  }};
`;

const NetLabel = styled.div`
  font-size: 10px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 3px;
  text-align: center;
  font-family: var(--font-primary);
`;

const NetValue = styled.div`
  font-size: 15px;
  font-weight: 700;
  text-align: center;
  font-family: 'Courier New', monospace;
  color: ${props => {
    if (props.$value > 0) return '#16a34a';
    if (props.$value < 0) return '#dc2626';
    return '#6b7280';
  }};
`;

/**
 * Calculate total MON value of assets
 * @param {Array} assets - Array of asset objects
 * @returns {number} - Total value in MON
 */
const calculateTotalValue = (assets) => {
  if (!Array.isArray(assets)) return 0;

  return assets.reduce((total, asset) => {
    // Native MON
    if (asset.assetType === ASSET_TYPES.NATIVE) {
      const raw = asset.tokenIdOrAmount || asset.amount || '0';
      const monValue = parseFloat(toMonDisplay(raw));
      return total + (isNaN(monValue) ? 0 : monValue);
    }

    // ERC721 NFT - use price from metadata if available
    if (asset.assetType === ASSET_TYPES.ERC721) {
      const price = asset.metadata?.price || asset.price || 0;
      return total + parseFloat(price);
    }

    // ERC20 - use price if available
    if (asset.assetType === ASSET_TYPES.ERC20) {
      const price = asset.price || 0;
      return total + parseFloat(price);
    }

    return total;
  }, 0);
};

/**
 * Format asset for display
 * @param {Object} asset
 * @returns {Object} - { name, value, icon, image, details }
 */
const formatAsset = (asset) => {
  if (asset.assetType === ASSET_TYPES.NATIVE) {
    const raw = asset.tokenIdOrAmount || asset.amount || '0';
    const monValue = toMonDisplay(raw);
    return {
      name: `${monValue} MON`,
      value: `${monValue} MON`,
      icon: 'MON',
      image: '/assets/images/monad.png',
      details: 'Monad Token',
      color: 'rgba(139, 92, 246, 0.15)'
    };
  }

  if (asset.assetType === ASSET_TYPES.ERC721) {
    const name = asset.metadata?.name || asset.metadata?.collectionName || `NFT #${asset.tokenIdOrAmount}`;
    const price = asset.metadata?.price || asset.price || 0;
    const image = asset.metadata?.image || '/raffle-images/nftphoto.png';
    return {
      name: name,
      value: price > 0 ? `≈ ${price} MON` : 'No price',
      icon: 'NFT',
      image: image,
      details: asset.metadata?.collectionName || 'NFT Collection',
      color: 'rgba(105, 48, 195, 0.15)'
    };
  }

  if (asset.assetType === ASSET_TYPES.ERC20) {
    const isLmon = asset.contractAddress?.toLowerCase() === '0xecc6f8fb4962cbf02d83cee8c4d9c2c96204a17d';

    if (isLmon) {
      const rawAmount = asset.tokenIdOrAmount || asset.amount || '0';
      const lmonAmount = parseFloat(rawAmount) / 1e18;
      const displayAmount = lmonAmount >= 1 ? lmonAmount.toFixed(2) : lmonAmount.toFixed(4);
      return {
        name: `${displayAmount} LMON`,
        value: `${displayAmount} LMON`,
        icon: 'LMON',
        image: '/images/lmonphoto.png',
        details: 'LMON Token',
        color: 'rgba(37, 99, 235, 0.15)'
      };
    }

    const amount = asset.tokenIdOrAmount || asset.amount || '0';
    const symbol = asset.metadata?.symbol || 'TOKEN';
    const price = asset.price || 0;
    return {
      name: `${amount} ${symbol}`,
      value: price > 0 ? `≈ ${price} MON` : 'No price',
      icon: 'TOK',
      image: null,
      details: 'ERC20 Token',
      color: 'rgba(37, 99, 235, 0.15)'
    };
  }

  return {
    name: 'Unknown Asset',
    value: '0 MON',
    icon: '?',
    image: null,
    details: 'Unknown',
    color: 'rgba(107, 114, 128, 0.15)'
  };
};

/**
 * AcceptOfferTooltip - Shows trade value analysis on Accept button hover
 * @param {Array} userGivesAssets - Assets user will give
 * @param {Array} userGetsAssets - Assets user will receive
 * @param {Object} position - { top, left } for tooltip positioning
 */
const AcceptOfferTooltip = ({ userGivesAssets, userGetsAssets, position }) => {
  const givesTotal = useMemo(() => calculateTotalValue(userGivesAssets), [userGivesAssets]);
  const getsTotal = useMemo(() => calculateTotalValue(userGetsAssets), [userGetsAssets]);
  const netValue = useMemo(() => getsTotal - givesTotal, [getsTotal, givesTotal]);

  const formattedGives = useMemo(() => {
    if (!Array.isArray(userGivesAssets) || userGivesAssets.length === 0) return [];
    return userGivesAssets.slice(0, 4).map(formatAsset);
  }, [userGivesAssets]);

  const formattedGets = useMemo(() => {
    if (!Array.isArray(userGetsAssets) || userGetsAssets.length === 0) return [];
    return userGetsAssets.slice(0, 4).map(formatAsset);
  }, [userGetsAssets]);

  const hasMoreGives = userGivesAssets?.length > 4;
  const hasMoreGets = userGetsAssets?.length > 4;

  // Calculate position (align to right of button, above it)
  const top = position?.top || 0;
  const left = position?.left || 0;

  const content = (
    <TooltipContainer style={{
      top: `${top}px`,
      left: `${left}px`
    }}>
      <TooltipHeader>Summary</TooltipHeader>

      {/* You Give Section */}
      <TradeSection>
        <SectionTitle>You Give</SectionTitle>
        <AssetList>
          {formattedGives.length === 0 ? (
            <AssetRow>
              <AssetIcon>?</AssetIcon>
              <AssetInfo>
                <AssetName style={{ color: '#9ca3af' }}>No assets</AssetName>
                <AssetValue>-</AssetValue>
              </AssetInfo>
            </AssetRow>
          ) : (
            <>
              {formattedGives.map((asset, idx) => (
                <AssetRow key={idx}>
                  {asset.image ? (
                    <AssetImage
                      src={asset.image}
                      alt={asset.name}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <AssetIcon $color={asset.color} style={asset.image ? { display: 'none' } : {}}>
                    {asset.icon}
                  </AssetIcon>
                  <AssetInfo>
                    <AssetName>{asset.name}</AssetName>
                    <AssetValue>{asset.value}</AssetValue>
                  </AssetInfo>
                </AssetRow>
              ))}
              {hasMoreGives && (
                <AssetValue style={{ paddingLeft: '46px', fontSize: '9px', color: '#9ca3af' }}>
                  +{userGivesAssets.length - 4} more...
                </AssetValue>
              )}
            </>
          )}
        </AssetList>
        <TotalRow style={{ marginTop: '10px' }}>
          <TotalLabel>Total</TotalLabel>
          <TotalValue>{givesTotal.toFixed(2)} MON</TotalValue>
        </TotalRow>
      </TradeSection>

      {/* You Get Section */}
      <TradeSection>
        <SectionTitle>You Get</SectionTitle>
        <AssetList>
          {formattedGets.length === 0 ? (
            <AssetRow>
              <AssetIcon>?</AssetIcon>
              <AssetInfo>
                <AssetName style={{ color: '#9ca3af' }}>No assets</AssetName>
                <AssetValue>-</AssetValue>
              </AssetInfo>
            </AssetRow>
          ) : (
            <>
              {formattedGets.map((asset, idx) => (
                <AssetRow key={idx}>
                  {asset.image ? (
                    <AssetImage
                      src={asset.image}
                      alt={asset.name}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <AssetIcon $color={asset.color} style={asset.image ? { display: 'none' } : {}}>
                    {asset.icon}
                  </AssetIcon>
                  <AssetInfo>
                    <AssetName>{asset.name}</AssetName>
                    <AssetValue>{asset.value}</AssetValue>
                  </AssetInfo>
                </AssetRow>
              ))}
              {hasMoreGets && (
                <AssetValue style={{ paddingLeft: '46px', fontSize: '9px', color: '#9ca3af' }}>
                  +{userGetsAssets.length - 4} more...
                </AssetValue>
              )}
            </>
          )}
        </AssetList>
        <TotalRow style={{ marginTop: '10px' }}>
          <TotalLabel>Total</TotalLabel>
          <TotalValue>{getsTotal.toFixed(2)} MON</TotalValue>
        </TotalRow>
      </TradeSection>

      {/* Net Value Section */}
      <NetSection $netValue={netValue}>
        <NetLabel>Net Value</NetLabel>
        <NetValue $value={netValue}>
          {netValue > 0 && '+'}
          {netValue.toFixed(2)} MON
        </NetValue>
      </NetSection>
    </TooltipContainer>
  );

  return createPortal(content, document.body);
};

export default AcceptOfferTooltip;
