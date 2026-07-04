import React, { useMemo } from 'react';
import {
  AssetsColumn,
  ColumnHeading,
  AssetGrid,
  AssetCard,
  AssetImage,
  AssetFallback,
  AssetName,
  AssetSubtitle,
  EmptyState
} from '../styles';
import { formatAssetForDisplay } from '../utils/formatters';
import { ASSET_TYPES } from '../../utils/constants';

const AssetsPanel = ({ title, assets, emptyMessage }) => {
  const list = Array.isArray(assets) ? assets : [];

  // Calculate total estimated value from floor prices
  const totalEstimatedValue = useMemo(() => {
    if (list.length === 0) return null;

    const total = list.reduce((sum, asset) => {
      const floorPrice = parseFloat(asset.metadata?.floorPrice);
      if (!isNaN(floorPrice) && floorPrice > 0) {
        return sum + floorPrice;
      }
      return sum;
    }, 0);

    return total > 0 ? total : null;
  }, [list]);

  // Helper function to get Poply link for NFTs
  const getNFTLink = (asset) => {
    if (asset.assetType !== ASSET_TYPES.ERC721 || !asset.contractAddress) {
      return null;
    }

    const baseUrl = `https://poply.xyz/collection/${asset.contractAddress}`;

    // If specific NFT, add token ID
    if (asset.isSpecific && asset.tokenIdOrAmount) {
      return `${baseUrl}/${asset.tokenIdOrAmount}`;
    }

    // Otherwise, just collection link
    return baseUrl;
  };

  return (
    <AssetsColumn>
      <ColumnHeading>
        {title}
      </ColumnHeading>
      {list.length === 0 ? (
        <EmptyState>{emptyMessage}</EmptyState>
      ) : (
        <AssetGrid>
          {list.slice(0, 6).map((asset, index) => {
            const display = formatAssetForDisplay(asset);
            const key = `${display.title}-${index}`;
            const nftLink = getNFTLink(asset);

            const cardContent = (
              <>
                {display.image ? (
                  <AssetImage
                    src={display.image}
                    alt={display.title}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = '/raffle-images/nftphoto.png';
                    }}
                  />
                ) : (
                  <AssetFallback>{display.badge || '?'}</AssetFallback>
                )}
                <AssetName>{display.title}</AssetName>
                <AssetSubtitle>{display.subtitle || '\u00A0'}</AssetSubtitle>
                {asset.metadata?.floorPrice && (
                  <AssetSubtitle style={{ color: '#16a34a', fontWeight: 700, fontSize: '13px' }}>
                    FP: {parseFloat(asset.metadata.floorPrice).toFixed(2)} {asset.metadata?.floorPriceCurrency || 'MON'}
                  </AssetSubtitle>
                )}
              </>
            );

            // If NFT has a link, wrap in anchor tag
            if (nftLink) {
              return (
                <AssetCard
                  key={key}
                  as="a"
                  href={nftLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  {cardContent}
                </AssetCard>
              );
            }

            return (
              <AssetCard key={key}>
                {cardContent}
              </AssetCard>
            );
          })}
        </AssetGrid>
      )}
    </AssetsColumn>
  );
};

export default AssetsPanel;
