import React, { memo, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  LargeOfferCard,
  MainVisualArea,
  OfferTypeOverlay,
  CardContent,
  TimerSection,
  TimerLabel,
  TimerValue,
  AssetImage,
  AssetSection,
  SectionTitle,
  AssetList,
  AssetItem,
  AssetIcon,
  AssetInfo,
  AssetName,
  AssetDetails,
  CardFooter,
  MakerInfo,
  MakerAddress,
  AssetCarousel,
  AssetCarouselWrapper,
  AssetCounter
} from '../styles';
import { ASSET_TYPES } from '../utils/constants';
import OfferPreviewTooltip from './OfferPreviewTooltip';

// Lazy Image Component for performance
const LazyImage = memo(({ src, alt, style, onError, className }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} style={style} className={className}>
      {isInView && (
        <img
          src={src}
          alt={alt}
          style={{ 
            ...style,
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease'
          }}
          onLoad={() => setIsLoaded(true)}
          onError={onError}
          loading="lazy"
        />
      )}
    </div>
  );
});
LazyImage.displayName = 'LazyImage';

const OfferCard = memo(({ offer, index, onClick }) => {
  const [currentOfferedIndex, setCurrentOfferedIndex] = useState(0);
  const [currentRequestedIndex, setCurrentRequestedIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const hoverTimeoutRef = useRef(null);
  const badgeRef = useRef(null);

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(offer);
    }
  }, [onClick, offer]);

  const handleCounterOfferTagClick = useCallback((e, targetId) => {
    e.stopPropagation(); // Prevent card click
    if (onClick) {
      onClick({ offerId: targetId });
    }
  }, [onClick]);

  // Handle hover on counter offer badge
  const handleCounterBadgeHover = useCallback((e) => {
    e.stopPropagation();

    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Calculate badge position
    if (badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.bottom + 8, // 8px below badge
        left: rect.right - 320 // Align right edge of tooltip with right edge of badge
      });
    }

    // Set timeout for 300ms before showing
    hoverTimeoutRef.current = setTimeout(() => {
      setShowPreview(true);
    }, 300);
  }, []);

  // Handle hover leave
  const handleCounterBadgeLeave = useCallback((e) => {
    e.stopPropagation();

    // Clear timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    setShowPreview(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Auto-scroll for multiple assets - optimized with longer intervals
  useEffect(() => {
    if (!offer.offeredAssets || offer.offeredAssets.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentOfferedIndex(prev => 
        (prev + 1) % offer.offeredAssets.length
      );
    }, 4000); // Increased to 4 seconds for better performance

    return () => clearInterval(interval);
  }, [offer.offeredAssets]);

  useEffect(() => {
    if (!offer.requestedAssets || offer.requestedAssets.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentRequestedIndex(prev => 
        (prev + 1) % offer.requestedAssets.length
      );
    }, 4000); // Increased to 4 seconds for better performance

    return () => clearInterval(interval);
  }, [offer.requestedAssets]);

  // Memoize offer type determination
  const offerTypeLabel = useMemo(() => {
    const hasNFTs = offer.offeredAssets?.some(asset => asset.assetType === ASSET_TYPES.ERC721);
    const hasTokens = offer.offeredAssets?.some(asset =>
      asset.assetType === ASSET_TYPES.NATIVE || asset.assetType === ASSET_TYPES.ERC20
    );

    if (hasNFTs && hasTokens) return 'MIXED';
    if (hasNFTs) return 'NFT';
    return 'TOKEN';
  }, [offer.offeredAssets]);

  // Check if this is a counter offer
  const isCounterOffer = useMemo(() => {
    return Boolean(offer.targetOfferId || offer.parentId || offer.parentOfferId);
  }, [offer.targetOfferId, offer.parentId, offer.parentOfferId]);

  // Get main image for the card
  const getMainCardImage = useMemo(() => {
    if (!offer.offeredAssets || offer.offeredAssets.length === 0) {
      return '/assets/images/monad.png';
    }

    // Special contract address check - Last Invitation NFT
    const specialNFT = offer.offeredAssets.find(
      asset => asset.assetType === ASSET_TYPES.ERC721 &&
      asset.contractAddress?.toLowerCase() === '0x85a219f66b5be2afccf81fbfd4de236af93259a6'
    );

    if (specialNFT) {
      return '/raffle-images/last-invitation.gif';
    }

    // If NFT offer, find first NFT with image
    const nftWithImage = offer.offeredAssets.find(
      asset => asset.assetType === ASSET_TYPES.ERC721 &&
      (asset.metadata?.image || asset.metadata?.imageLarge || asset.metadata?.imageSmall)
    );

    if (nftWithImage) {
      return nftWithImage.metadata?.imageLarge ||
             nftWithImage.metadata?.image ||
             nftWithImage.metadata?.imageSmall ||
              `/raffle-images/nftphoto.png?v=${Date.now()}`;
    }

    // If token offer, use appropriate logo
    const lmonAsset = offer.offeredAssets.find(
      asset => asset.assetType === ASSET_TYPES.ERC20 &&
      asset.contractAddress?.toLowerCase() === '0xecc6f8fb4962cbf02d83cee8c4d9c2c96204a17d'
    );

    if (lmonAsset) {
      return '/images/lmonphoto.png';
    }

    const hasToken = offer.offeredAssets.some(
      asset => asset.assetType === ASSET_TYPES.NATIVE || asset.assetType === ASSET_TYPES.ERC20
    );

    if (hasToken) {
      return '/assets/images/monad.png';
    }

    // Default fallback
    return '/raffle-images/nftphoto.png';
  }, [offer.offeredAssets]);



  // Memoized asset formatter for better performance
  const formatAssetForDisplay = useCallback((asset) => {
    if (!asset) return { name: 'Unknown', icon: '❓' };
    
    switch (asset.assetType) {
      case ASSET_TYPES.NATIVE:
        const monAmount = parseFloat(asset.tokenIdOrAmount) / Math.pow(10, 18);
        return {
          name: `${monAmount.toFixed(2)} MON`,
          icon: 'MON',
          image: '/assets/images/monad.png'
        };
      case ASSET_TYPES.ERC20: {
        const isLmon = asset.contractAddress?.toLowerCase() === '0xecc6f8fb4962cbf02d83cee8c4d9c2c96204a17d';

        if (isLmon) {
          const lmonAmount = parseFloat(asset.tokenIdOrAmount) / Math.pow(10, 18);
          return {
            name: `${lmonAmount.toFixed(2)} LMON`,
            icon: 'LMON',
            image: '/images/lmonphoto.png'
          };
        }

        return {
          name: `${asset.tokenIdOrAmount} Tokens`,
          icon: 'TOK',
          image: null
        };
      }
      case ASSET_TYPES.ERC721: {
        // Special contract address check - Last Invitation NFT
        const isSpecialNFT = asset.contractAddress?.toLowerCase() === '0x85a219f66b5be2afccf81fbfd4de236af93259a6';
        const specialImage = isSpecialNFT ? '/raffle-images/last-invitation.gif' : null;

        // Collection request: show amount + collection name
        if (!asset.isSpecific && asset.amount && Number(asset.amount) > 1) {
          const collectionName = asset.metadata?.collectionName || 'NFTs';
          return {
            name: `${asset.amount}x ${collectionName}`,
            icon: 'NFT',
            image: specialImage || asset.metadata?.image || `/raffle-images/nftphoto.png?v=${Date.now()}`
          };
        }
        // Specific NFT or single item
        return {
          name: asset.metadata?.name || `NFT #${asset.tokenIdOrAmount}`,
          icon: 'NFT',
          image: specialImage || asset.metadata?.image || `/raffle-images/nftphoto.png?v=${Date.now()}`
        };
      }
      case ASSET_TYPES.ERC1155:
        return {
          name: `${asset.amount}x Multi-Token`,
          icon: 'MLT',
          image: null
        };
      default:
        return { name: 'Unknown Asset', icon: '?' };
    }
  }, []);



  // Map status number to string
  const getStatusString = () => {
    if (offer.statusString) return offer.statusString.toUpperCase();
    if (offer.status === 1) return 'ACTIVE';
    if (offer.status === 2) return 'ACCEPTED';
    if (offer.status === 3) return 'CANCELLED';
    if (offer.status === 4) return 'EXPIRED';
    return '';
  };
  const statusString = getStatusString();
  const isAccepted = statusString === 'ACCEPTED' || offer.status === 2;
  const isCancelled = statusString === 'CANCELLED' || offer.status === 3;
  const isExpired = statusString === 'EXPIRED' || offer.status === 4;

  // Calculate time remaining
  const getTimeRemaining = useMemo(() => {
    if (isAccepted) return 'Accepted';
    if (isCancelled) return 'Cancelled';
    if (isExpired) return 'Expired';
    if (!offer.deadline) return 'No deadline';

    const now = new Date().getTime();
    const deadline = new Date(offer.deadline).getTime();
    const diff = deadline - now;

    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }, [offer.deadline, isAccepted, isCancelled, isExpired]);

  const timerLabel = (isAccepted || isCancelled || isExpired) ? 'Status:' : 'Expires in:';

  return (
    <LargeOfferCard $index={index} onClick={handleClick}>
      {/* Main Visual */}
      <MainVisualArea>
        <LazyImage
          src={getMainCardImage}
          alt={offer.title || 'Offer'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => {
            e.target.src = '/raffle-images/nftphoto.png';
          }}
        />
        <OfferTypeOverlay $type={offerTypeLabel}>
          {offerTypeLabel === 'NFT' ? 'NFT' :
           offerTypeLabel === 'TOKEN' ? 'TOKEN' :
           'MIXED'}
        </OfferTypeOverlay>
        {isCounterOffer && offer.targetOfferId && (
          <>
            <OfferTypeOverlay
              ref={badgeRef}
              $type="COUNTER"
              style={{
                top: '8px',
                left: 'auto',
                right: '8px',
                background: '#ea580c',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={(e) => handleCounterOfferTagClick(e, offer.targetOfferId)}
              onMouseEnter={(e) => {
                handleCounterBadgeHover(e);
                e.currentTarget.style.background = '#c2410c';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                handleCounterBadgeLeave(e);
                e.currentTarget.style.background = '#ea580c';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              COUNTER TO: #{offer.targetOfferId}
            </OfferTypeOverlay>
            {showPreview && (
              <OfferPreviewTooltip
                targetOfferId={offer.targetOfferId}
                position={tooltipPosition}
              />
            )}
          </>
        )}
      </MainVisualArea>

      {/* Content */}
      <CardContent>
        {/* Timer */}
        <TimerSection>
          <TimerLabel>{timerLabel}</TimerLabel>
          <TimerValue $timeString={getTimeRemaining}>
            {getTimeRemaining}
          </TimerValue>
        </TimerSection>
      
      <AssetSection>
        <SectionTitle>
          Offering
        </SectionTitle>
        <AssetList style={{ position: 'relative' }}>
          {offer.offeredAssets && offer.offeredAssets.length > 1 && (
            <AssetCounter>{currentOfferedIndex + 1}/{offer.offeredAssets.length}</AssetCounter>
          )}
          {offer.offeredAssets && offer.offeredAssets.length > 1 ? (
            <AssetCarousel>
              <AssetCarouselWrapper $offset={-currentOfferedIndex * 50}>
                {(offer.offeredAssets || []).map((asset, idx) => {
                  const display = formatAssetForDisplay(asset);
                  return (
                    <AssetItem key={idx} style={{ height: '50px' }}>
                      {display.image ? (
                        <AssetImage 
                          src={display.image} 
                          alt={display.name}
                          style={{ width: '40px', height: '40px', borderRadius: '6px' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <AssetIcon style={display.image ? { display: 'none' } : { width: '40px', height: '40px' }}>
                        {display.icon}
                      </AssetIcon>
                      <AssetInfo>
                        <AssetName>{display.name}</AssetName>
                        <AssetDetails>
                          {asset.assetType === ASSET_TYPES.ERC721 
                            ? (asset.metadata?.collectionName || 'NFT Collection')
                            : asset.assetType === ASSET_TYPES.NATIVE 
                            ? 'Monad Token'
                            : 'Token'}
                        </AssetDetails>
                      </AssetInfo>
                    </AssetItem>
                  );
                })}
              </AssetCarouselWrapper>
            </AssetCarousel>
          ) : (
            (offer.offeredAssets || []).map((asset, idx) => {
              const display = formatAssetForDisplay(asset);
              return (
                <AssetItem key={idx} style={{ height: '50px' }}>
                  {display.image ? (
                    <AssetImage 
                      src={display.image} 
                      alt={display.name}
                      style={{ width: '40px', height: '40px', borderRadius: '6px' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <AssetIcon style={display.image ? { display: 'none' } : { width: '40px', height: '40px' }}>
                    {display.icon}
                  </AssetIcon>
                  <AssetInfo>
                    <AssetName>{display.name}</AssetName>
                    <AssetDetails>
                      {asset.assetType === ASSET_TYPES.ERC721 
                        ? (asset.metadata?.collectionName || 'NFT Collection')
                        : asset.assetType === ASSET_TYPES.NATIVE 
                        ? 'Monad Token'
                        : 'Token'}
                    </AssetDetails>
                  </AssetInfo>
                </AssetItem>
              );
            })
          )}
        </AssetList>
      </AssetSection>

      <AssetSection>
        <SectionTitle>
          Requesting
        </SectionTitle>
        <AssetList style={{ position: 'relative' }}>
          {offer.requestedAssets && offer.requestedAssets.length > 1 && (
            <AssetCounter>{currentRequestedIndex + 1}/{offer.requestedAssets.length}</AssetCounter>
          )}
          {(offer.requestedAssets || []).length > 0 ? (
            offer.requestedAssets.length > 1 ? (
              <AssetCarousel>
                <AssetCarouselWrapper $offset={-currentRequestedIndex * 50}>
                  {offer.requestedAssets.map((asset, idx) => {
                    const display = formatAssetForDisplay(asset);
                    return (
                      <AssetItem key={idx} style={{ height: '50px' }}>
                        {display.image ? (
                          <AssetImage 
                            src={display.image} 
                            alt={display.name}
                            style={{ width: '40px', height: '40px', borderRadius: '6px' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <AssetIcon style={display.image ? { display: 'none' } : { width: '40px', height: '40px' }}>
                          {display.icon}
                        </AssetIcon>
                        <AssetInfo>
                          <AssetName>{display.name}</AssetName>
                          <AssetDetails>
                            {asset.assetType === ASSET_TYPES.ERC721 
                              ? (asset.metadata?.collectionName || 'NFT Collection')
                              : asset.assetType === ASSET_TYPES.NATIVE 
                              ? 'Monad Token'
                              : 'Token'}
                          </AssetDetails>
                        </AssetInfo>
                      </AssetItem>
                    );
                  })}
                </AssetCarouselWrapper>
              </AssetCarousel>
            ) : (
              offer.requestedAssets.map((asset, idx) => {
                const display = formatAssetForDisplay(asset);
                return (
                  <AssetItem key={idx} style={{ height: '50px' }}>
                    {display.image ? (
                      <AssetImage 
                        src={display.image} 
                        alt={display.name}
                        style={{ width: '40px', height: '40px', borderRadius: '6px' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <AssetIcon style={display.image ? { display: 'none' } : { width: '40px', height: '40px' }}>
                      {display.icon}
                    </AssetIcon>
                    <AssetInfo>
                      <AssetName>{display.name}</AssetName>
                      <AssetDetails>
                        {asset.assetType === ASSET_TYPES.ERC721 
                          ? (asset.metadata?.collectionName || 'NFT Collection')
                          : asset.assetType === ASSET_TYPES.NATIVE 
                          ? 'Monad Token'
                          : 'Token'}
                      </AssetDetails>
                    </AssetInfo>
                  </AssetItem>
                );
              })
            )
          ) : (
            <AssetItem style={{ height: '50px' }}>
              <AssetIcon style={{ width: '40px', height: '40px' }}>?</AssetIcon>
              <AssetInfo>
                <AssetName>Open to Offers</AssetName>
                <AssetDetails>Any NFT or Token</AssetDetails>
              </AssetInfo>
            </AssetItem>
          )}
        </AssetList>
      </AssetSection>

        <CardFooter>
          <MakerInfo>
            Offered By: 
            <MakerAddress
              as="a"
              href={offer.maker ? `https://testnet.monadexplorer.com/address/${offer.maker}` : '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!offer.maker) {
                  e.preventDefault();
                }
              }}
            >
              {offer.maker ? `${offer.maker.slice(0, 6)}...${offer.maker.slice(-4)}` : 'Unknown'}
            </MakerAddress>
          </MakerInfo>
        </CardFooter>
      </CardContent>
    </LargeOfferCard>
  );
});

OfferCard.displayName = 'OfferCard';

export default OfferCard;
