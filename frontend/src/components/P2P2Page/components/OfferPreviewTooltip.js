import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  OfferPreviewTooltip as TooltipContainer,
  TooltipHeader,
  OfferIdBadge,
  TimeRemaining,
  TooltipSection,
  SectionLabel,
  AssetPreviewList,
  AssetPreviewItem,
  AssetPreviewImage,
  AssetPreviewIcon,
  AssetPreviewInfo,
  AssetPreviewName,
  AssetPreviewDetails,
  MoreItemsBadge,
  TooltipSkeletonLine
} from '../styles';
import { ASSET_TYPES } from '../utils/constants';

const API_BASE_URL = 'https://api.monaliens.xyz/api/p2p';

// Global cache shared across all instances
const offerPreviewCache = new Map();

const OfferPreviewTooltip = ({ targetOfferId, position }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const abortControllerRef = useRef(null);

  // Default position if not provided
  const { top = 0, left = 0 } = position || {};

  // Format asset for display
  const formatAssetForDisplay = useCallback((asset) => {
    if (!asset) return { name: 'Unknown', icon: '?' };

    switch (asset.assetType) {
      case ASSET_TYPES.NATIVE:
        const monAmount = parseFloat(asset.tokenIdOrAmount) / Math.pow(10, 18);
        return {
          name: `${monAmount.toFixed(2)} MON`,
          icon: 'MON',
          image: '/assets/images/monad.png',
          details: 'Monad Token'
        };
      case ASSET_TYPES.ERC20: {
        const isLmon = asset.contractAddress?.toLowerCase() === '0xecc6f8fb4962cbf02d83cee8c4d9c2c96204a17d';

        if (isLmon) {
          const lmonAmount = parseFloat(asset.tokenIdOrAmount) / Math.pow(10, 18);
          return {
            name: `${lmonAmount.toFixed(2)} LMON`,
            icon: 'LMON',
            image: '/images/lmonphoto.png',
            details: 'LMON Token'
          };
        }

        return {
          name: `${asset.tokenIdOrAmount} Tokens`,
          icon: 'TOK',
          image: null,
          details: 'Token'
        };
      }
      case ASSET_TYPES.ERC721: {
        // Special contract address check - Last Invitation NFT
        const isSpecialNFT = asset.contractAddress?.toLowerCase() === '0x85a219f66b5be2afccf81fbfd4de236af93259a6';
        const specialImage = isSpecialNFT ? '/raffle-images/last-invitation.gif' : null;

        if (!asset.isSpecific && asset.amount && Number(asset.amount) > 1) {
          const collectionName = asset.metadata?.collectionName || 'NFTs';
          return {
            name: `${asset.amount}x ${collectionName}`,
            icon: 'NFT',
            image: specialImage || asset.metadata?.image || '/raffle-images/nftphoto.png',
            details: asset.metadata?.collectionName || 'NFT Collection'
          };
        }
        return {
          name: asset.metadata?.name || `NFT #${asset.tokenIdOrAmount}`,
          icon: 'NFT',
          image: specialImage || asset.metadata?.image || '/raffle-images/nftphoto.png',
          details: asset.metadata?.collectionName || 'NFT Collection'
        };
      }
      case ASSET_TYPES.ERC1155:
        return {
          name: `${asset.amount}x Multi-Token`,
          icon: 'MLT',
          image: null,
          details: 'Multi-Token'
        };
      default:
        return { name: 'Unknown Asset', icon: '?', details: 'Unknown' };
    }
  }, []);

  // Calculate time remaining
  const getTimeRemaining = useCallback((deadline, statusString, status) => {
    const isAccepted = statusString === 'ACCEPTED' || status === 2;
    if (isAccepted) return 'Accepted';
    if (!deadline) return 'No deadline';

    const now = new Date().getTime();
    const deadlineTime = new Date(deadline).getTime();
    const diff = deadlineTime - now;

    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }, []);

  // Fetch offer data
  useEffect(() => {
    const fetchOffer = async () => {
      // Check cache
      if (offerPreviewCache.has(targetOfferId)) {
        setData(offerPreviewCache.get(targetOfferId));
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        abortControllerRef.current = new AbortController();

        const response = await axios.get(`${API_BASE_URL}/offers/${targetOfferId}`, {
          signal: abortControllerRef.current.signal
        });

        const offerData = response.data?.data || response.data;
        offerPreviewCache.set(targetOfferId, offerData);
        setData(offerData);
        setLoading(false);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch offer preview:', err);
          setLoading(false);
        }
      }
    };

    fetchOffer();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [targetOfferId]);

  // Loading skeleton
  if (loading) {
    const content = (
      <TooltipContainer style={{ position: 'fixed', top: `${top}px`, left: `${left}px` }}>
        <TooltipSkeletonLine $height="16px" />
        <TooltipSkeletonLine $height="12px" style={{ width: '70%', marginTop: '12px' }} />
        <TooltipSkeletonLine $height="48px" style={{ marginTop: '8px' }} />
        <TooltipSkeletonLine $height="48px" />
        <TooltipSkeletonLine $height="12px" style={{ width: '70%', marginTop: '12px' }} />
        <TooltipSkeletonLine $height="48px" style={{ marginTop: '8px' }} />
        <TooltipSkeletonLine $height="48px" />
      </TooltipContainer>
    );
    return createPortal(content, document.body);
  }

  if (!data) return null;

  const timeRemaining = getTimeRemaining(data.deadline, data.statusString, data.status);
  const MAX_ASSETS = 4;

  const content = (
    <TooltipContainer style={{ position: 'fixed', top: `${top}px`, left: `${left}px` }}>
      <TooltipHeader>
        <OfferIdBadge>Offer #{targetOfferId}</OfferIdBadge>
        <TimeRemaining>⏱ {timeRemaining}</TimeRemaining>
      </TooltipHeader>

      <TooltipSection>
        <SectionLabel>Offering</SectionLabel>
        <AssetPreviewList>
          {(data.offeredAssets || []).slice(0, MAX_ASSETS).map((asset, idx) => {
            const display = formatAssetForDisplay(asset);
            return (
              <AssetPreviewItem key={idx}>
                {display.image ? (
                  <AssetPreviewImage
                    src={display.image}
                    alt={display.name}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <AssetPreviewIcon style={display.image ? { display: 'none' } : {}}>
                  {display.icon}
                </AssetPreviewIcon>
                <AssetPreviewInfo>
                  <AssetPreviewName>{display.name}</AssetPreviewName>
                  <AssetPreviewDetails>{display.details}</AssetPreviewDetails>
                </AssetPreviewInfo>
              </AssetPreviewItem>
            );
          })}
          {data.offeredAssets && data.offeredAssets.length > MAX_ASSETS && (
            <MoreItemsBadge>
              +{data.offeredAssets.length - MAX_ASSETS} more {data.offeredAssets.length - MAX_ASSETS === 1 ? 'item' : 'items'}
            </MoreItemsBadge>
          )}
        </AssetPreviewList>
      </TooltipSection>

      <TooltipSection>
        <SectionLabel>Requesting</SectionLabel>
        <AssetPreviewList>
          {(data.requestedAssets || []).length > 0 ? (
            <>
              {data.requestedAssets.slice(0, MAX_ASSETS).map((asset, idx) => {
                const display = formatAssetForDisplay(asset);
                return (
                  <AssetPreviewItem key={idx}>
                    {display.image ? (
                      <AssetPreviewImage
                        src={display.image}
                        alt={display.name}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <AssetPreviewIcon style={display.image ? { display: 'none' } : {}}>
                      {display.icon}
                    </AssetPreviewIcon>
                    <AssetPreviewInfo>
                      <AssetPreviewName>{display.name}</AssetPreviewName>
                      <AssetPreviewDetails>{display.details}</AssetPreviewDetails>
                    </AssetPreviewInfo>
                  </AssetPreviewItem>
                );
              })}
              {data.requestedAssets.length > MAX_ASSETS && (
                <MoreItemsBadge>
                  +{data.requestedAssets.length - MAX_ASSETS} more {data.requestedAssets.length - MAX_ASSETS === 1 ? 'item' : 'items'}
                </MoreItemsBadge>
              )}
            </>
          ) : (
            <AssetPreviewItem>
              <AssetPreviewIcon>?</AssetPreviewIcon>
              <AssetPreviewInfo>
                <AssetPreviewName>Open to Offers</AssetPreviewName>
                <AssetPreviewDetails>Any NFT or Token</AssetPreviewDetails>
              </AssetPreviewInfo>
            </AssetPreviewItem>
          )}
        </AssetPreviewList>
      </TooltipSection>
    </TooltipContainer>
  );

  return createPortal(content, document.body);
};

export default OfferPreviewTooltip;
