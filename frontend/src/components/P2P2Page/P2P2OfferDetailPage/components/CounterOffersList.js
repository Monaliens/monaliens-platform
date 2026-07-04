import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CounterOffersBlock,
  CounterHeading,
  CounterDescription,
  CounterCardsGrid,
  CounterCard,
  CounterCardHeader,
  CounterCardTitle,
  CounterCardSubtitle,
  CounterBadge,
  CounterCardBody,
  CounterSummary,
  CounterSummaryLabel,
  CounterSummaryText,
  CounterCardFooter,
  CounterCardButton,
  CounterCardActions,
  CounterCardButtonSecondary,
  CounterThumbnail
} from '../styles';
import {
  AssetCarousel,
  AssetCarouselWrapper,
  AssetCounter,
  AssetItem,
  AssetImage,
  AssetIcon,
  AssetInfo,
  AssetName,
  AssetDetails,
  AssetList
} from '../../styles';
import AcceptOfferTooltip from '../../components/AcceptOfferTooltip';
import { ASSET_TYPES } from '../../P2P2CreatePage/utils/constants';
import { toMonDisplay } from '../../P2P2CreatePage/utils/assetHelpers';
import { formatRelativeDeadline } from '../utils/formatters';
import { checkOwnership } from '../utils/ownerCheck';

const shortenAddress = (value = '') => {
  if (!value) return '';
  const str = String(value);
  return str.length > 10 ? `${str.slice(0, 6)}...${str.slice(-4)}` : str;
};

const findThumbnail = (assets) => {
  if (!Array.isArray(assets)) return null;

  // Check for special Last Invitation NFT first
  const specialNFT = assets.find(
    (asset) => asset.assetType === ASSET_TYPES.ERC721 &&
    asset.contractAddress?.toLowerCase() === '0x85a219f66b5be2afccf81fbfd4de236af93259a6'
  );
  if (specialNFT) return '/raffle-images/last-invitation.gif';

  const nft = assets.find((asset) => asset.assetType === ASSET_TYPES.ERC721 && asset.metadata?.image);
  if (nft) return nft.metadata.image;

  // Check for LMON first
  const lmonAsset = assets.find(
    (asset) => asset.assetType === ASSET_TYPES.ERC20 &&
    asset.contractAddress?.toLowerCase() === '0xecc6f8fb4962cbf02d83cee8c4d9c2c96204a17d'
  );
  if (lmonAsset) return '/images/lmonphoto.png';

  const token = assets.find((asset) => asset.assetType === ASSET_TYPES.NATIVE || asset.assetType === ASSET_TYPES.ERC20);
  if (token) return '/assets/images/monad.png';
  return '/raffle-images/nftphoto.png';
};

const formatAssetForDisplay = (asset) => {
  if (!asset) return { name: 'Unknown', icon: '❓', image: null };

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
      return { name: 'Unknown Asset', icon: '?', image: null, details: 'Unknown' };
  }
};

const getOfferKey = (offer) => {
  const rawKey =
    offer?.offerId ??
    offer?.id ??
    offer?.contractAddress ??
    offer?.maker?.toLowerCase?.() ??
    offer?.makerAddress?.toLowerCase?.();

  return rawKey != null ? String(rawKey) : undefined;
};

const CounterOffersList = ({
  offers,
  currentUserAddress,
  isOwner,
  onAccept,
  acceptingOfferId,
  parentOffer
}) => {
  const navigate = useNavigate();
  const [countdownOffer, setCountdownOffer] = useState(null);
  const [countdownOfferKey, setCountdownOfferKey] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [hoveredCounterId, setHoveredCounterId] = useState(null);
  const [counterTooltipPosition, setCounterTooltipPosition] = useState({ top: 0, left: 0 });
  const [carouselIndices, setCarouselIndices] = useState({});
  const countdownRef = useRef(null);
  const tooltipHoverTimeoutRef = useRef(null);
  const acceptButtonRefs = useRef({});

  const normalizedUser = useMemo(
    () => (currentUserAddress ? currentUserAddress.toLowerCase() : null),
    [currentUserAddress]
  );


  useEffect(() => {
    if (countdownOffer && countdown > 0) {
      countdownRef.current = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdownOffer && countdown === 0) {
      // Execute accept
      onAccept?.(countdownOffer, countdownOfferKey);
      setCountdownOffer(null);
      setCountdownOfferKey(null);
      setCountdown(0);
    }

    return () => {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, [countdownOffer, countdownOfferKey, countdown, onAccept]);

  // Carousel auto-scroll for all offers
  useEffect(() => {
    if (!Array.isArray(offers) || offers.length === 0) return;

    const intervals = [];

    offers.forEach((offer) => {
      const offerKey = getOfferKey(offer) || offer.offerId || offer.id;
      if (!offerKey) return;

      const offeredAssets = offer.offeredAssets || [];
      const requestedAssets = offer.requestedAssets || [];

      // Auto-scroll for offered assets
      if (offeredAssets.length > 1) {
        const interval = setInterval(() => {
          setCarouselIndices((prev) => ({
            ...prev,
            [`${offerKey}-offered`]: ((prev[`${offerKey}-offered`] || 0) + 1) % offeredAssets.length
          }));
        }, 4000);
        intervals.push(interval);
      }

      // Auto-scroll for requested assets
      if (requestedAssets.length > 1) {
        const interval = setInterval(() => {
          setCarouselIndices((prev) => ({
            ...prev,
            [`${offerKey}-requested`]: ((prev[`${offerKey}-requested`] || 0) + 1) % requestedAssets.length
          }));
        }, 4000);
        intervals.push(interval);
      }
    });

    return () => {
      intervals.forEach((interval) => clearInterval(interval));
    };
  }, [offers]);

  const handleAcceptButtonHover = useCallback((offerKey) => {
    const buttonRef = acceptButtonRefs.current[offerKey];
    if (buttonRef) {
      const rect = buttonRef.getBoundingClientRect();
      // Estimate tooltip height (~360px) and position it above the button
      const TOOLTIP_HEIGHT = 360;
      setCounterTooltipPosition({
        top: rect.top - TOOLTIP_HEIGHT - 10,
        left: rect.right - 340
      });
    }

    tooltipHoverTimeoutRef.current = setTimeout(() => {
      setHoveredCounterId(offerKey);
    }, 300);
  }, []);

  const handleAcceptButtonLeave = useCallback(() => {
    if (tooltipHoverTimeoutRef.current) {
      clearTimeout(tooltipHoverTimeoutRef.current);
      tooltipHoverTimeoutRef.current = null;
    }
    setHoveredCounterId(null);
  }, []);

  const handleAcceptClick = (offer, offerKey) => {
    // Hide tooltip
    setHoveredCounterId(null);
    if (tooltipHoverTimeoutRef.current) {
      clearTimeout(tooltipHoverTimeoutRef.current);
      tooltipHoverTimeoutRef.current = null;
    }

    if (!countdownOfferKey) {
      // Start countdown
      setCountdownOffer(offer);
      setCountdownOfferKey(offerKey);
      setCountdown(4); // Start from 4 so it shows 4, 3, 2, 1, 0
    }
  };

  const handleCancelCountdown = () => {
    setCountdownOffer(null);
    setCountdownOfferKey(null);
    setCountdown(0);
    if (countdownRef.current) {
      clearTimeout(countdownRef.current);
    }
  };

  if (!Array.isArray(offers) || offers.length === 0) {
    return (
      <CounterOffersBlock>
        <CounterHeading>Counter Offers</CounterHeading>
        <CounterDescription>
          No counter offers yet. Share the link with interested traders so they can
          respond with their own proposals.
        </CounterDescription>
      </CounterOffersBlock>
    );
  }

  // Find hovered offer for tooltip
  const hoveredOffer = useMemo(() => {
    if (!hoveredCounterId) return null;
    return offers.find(o => getOfferKey(o) === hoveredCounterId);
  }, [hoveredCounterId, offers]);

  return (
    <>
      <CounterOffersBlock style={{ alignItems: 'stretch', textAlign: 'left' }}>
        <CounterCardsGrid>
          {offers.map((offer, index) => {
          const makerAddress =
            offer.maker?.toLowerCase?.() ||
            offer.makerAddress?.toLowerCase?.() ||
            offer.owner?.toLowerCase?.() ||
            null;
          const isOwn = Boolean(
            normalizedUser && makerAddress && normalizedUser === makerAddress
          );

          const deadlineLabel = formatRelativeDeadline(offer.deadline);
          const thumbnail = findThumbnail(offer.offeredAssets) ||
            findThumbnail(offer.requestedAssets);

          const offerKey = getOfferKey(offer) || `offer-${index}`;

          const offeredAssets = offer.offeredAssets || [];
          const requestedAssets = offer.requestedAssets || [];
          const offeredIndex = carouselIndices[`${offerKey}-offered`] || 0;
          const requestedIndex = carouselIndices[`${offerKey}-requested`] || 0;

          // Map status number to string
          const getStatusString = () => {
            if (offer.statusString) return offer.statusString;
            if (offer.status === 1) return 'ACTIVE';
            if (offer.status === 2) return 'ACCEPTED';
            if (offer.status === 3) return 'CANCELLED';
            if (offer.status === 4) return 'EXPIRED';
            return 'PENDING';
          };
          const statusString = getStatusString();

          // Check if parent offer is still active
          const isParentActive = parentOffer
            ? (parentOffer.statusString === 'ACTIVE' || parentOffer.status === 1)
            : true;

          // Show button if user is owner, counter offer is active, parent is active, and has contract address
          const showAcceptButton =
            Boolean(onAccept) &&
            isOwner &&
            (offer.statusString === 'ACTIVE' || offer.status === 1) &&
            Boolean(offer.contractAddress) &&
            isParentActive;

          const isCountingDown = countdownOfferKey === offerKey && countdown > 0;
          const progressPercent = isCountingDown ? ((4 - countdown) / 4) * 100 : 0;

          return (
            <CounterCard key={offerKey}>
              {isOwn ? <CounterBadge>YOURS</CounterBadge> : null}

              <CounterCardHeader>
                <CounterThumbnail src={thumbnail} alt={offer.title || 'Counter offer'} />
                <div>
                  {/* Offer ID - Clickable */}
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#6930c3',
                      marginBottom: '4px',
                      cursor: 'pointer',
                      transition: 'color 0.2s ease',
                      fontFamily: 'var(--font-primary)'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const targetId = offer.offerId || offer.id;
                      if (targetId) navigate(`/p2p/${targetId}`);
                    }}
                    onMouseEnter={(e) => e.target.style.color = '#8b5cf6'}
                    onMouseLeave={(e) => e.target.style.color = '#6930c3'}
                  >
                    Offer #{offer.offerId}
                  </div>
                  <CounterCardTitle>{offer.title || `Offer #${offer.offerId}`}</CounterCardTitle>
                  <CounterCardSubtitle>
                    by{' '}
                    <a
                      href={`https://testnet.monadexplorer.com/address/${offer.maker || offer.makerAddress}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: '#6366f1',
                        textDecoration: 'none',
                        fontWeight: 600,
                        transition: 'color 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.target.style.color = '#8b5cf6'}
                      onMouseLeave={(e) => e.target.style.color = '#6366f1'}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {shortenAddress(offer.makerLabel || offer.maker || offer.makerAddress)}
                    </a>
                  </CounterCardSubtitle>
                </div>
              </CounterCardHeader>

              <CounterCardBody>
                {/* Offering Carousel */}
                <CounterSummary style={{ border: 'none', background: 'transparent', padding: '0' }}>
                  <CounterSummaryLabel>Offering</CounterSummaryLabel>
                  <AssetList style={{ position: 'relative', marginTop: '8px' }}>
                    {offeredAssets.length > 1 && (
                      <AssetCounter>{offeredIndex + 1}/{offeredAssets.length}</AssetCounter>
                    )}
                    {offeredAssets.length > 1 ? (
                      <AssetCarousel>
                        <AssetCarouselWrapper $offset={-offeredIndex * 50}>
                          {offeredAssets.map((asset, idx) => {
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
                                  <AssetDetails>{display.details}</AssetDetails>
                                </AssetInfo>
                              </AssetItem>
                            );
                          })}
                        </AssetCarouselWrapper>
                      </AssetCarousel>
                    ) : offeredAssets.length === 1 ? (
                      (() => {
                        const display = formatAssetForDisplay(offeredAssets[0]);
                        return (
                          <AssetItem style={{ height: '50px' }}>
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
                              <AssetDetails>{display.details}</AssetDetails>
                            </AssetInfo>
                          </AssetItem>
                        );
                      })()
                    ) : (
                      <AssetItem style={{ height: '50px' }}>
                        <AssetIcon style={{ width: '40px', height: '40px' }}>?</AssetIcon>
                        <AssetInfo>
                          <AssetName>No assets</AssetName>
                          <AssetDetails>-</AssetDetails>
                        </AssetInfo>
                      </AssetItem>
                    )}
                  </AssetList>
                </CounterSummary>

                {/* Requesting Carousel */}
                <CounterSummary style={{ border: 'none', background: 'transparent', padding: '0' }}>
                  <CounterSummaryLabel>Requesting</CounterSummaryLabel>
                  <AssetList style={{ position: 'relative', marginTop: '8px' }}>
                    {requestedAssets.length > 1 && (
                      <AssetCounter>{requestedIndex + 1}/{requestedAssets.length}</AssetCounter>
                    )}
                    {requestedAssets.length > 1 ? (
                      <AssetCarousel>
                        <AssetCarouselWrapper $offset={-requestedIndex * 50}>
                          {requestedAssets.map((asset, idx) => {
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
                                  <AssetDetails>{display.details}</AssetDetails>
                                </AssetInfo>
                              </AssetItem>
                            );
                          })}
                        </AssetCarouselWrapper>
                      </AssetCarousel>
                    ) : requestedAssets.length === 1 ? (
                      (() => {
                        const display = formatAssetForDisplay(requestedAssets[0]);
                        return (
                          <AssetItem style={{ height: '50px' }}>
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
                              <AssetDetails>{display.details}</AssetDetails>
                            </AssetInfo>
                          </AssetItem>
                        );
                      })()
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
                </CounterSummary>

                <CounterSummary>
                  <CounterSummaryLabel>Status</CounterSummaryLabel>
                  <CounterSummaryText>{statusString}</CounterSummaryText>
                </CounterSummary>
                <CounterSummary>
                  <CounterSummaryLabel>Valid Until</CounterSummaryLabel>
                  <CounterSummaryText>{deadlineLabel}</CounterSummaryText>
                </CounterSummary>
              </CounterCardBody>

              <CounterCardFooter>
                <CounterCardActions>
                  {showAcceptButton ? (
                    <>
                      <CounterCardButton
                        ref={(el) => {
                          if (el) {
                            acceptButtonRefs.current[offerKey] = el;
                          }
                        }}
                        type="button"
                        disabled={acceptingOfferId === offerKey}
                        onClick={() => isCountingDown ? handleCancelCountdown() : handleAcceptClick(offer, offerKey)}
                        onMouseEnter={() => handleAcceptButtonHover(offerKey)}
                        onMouseLeave={handleAcceptButtonLeave}
                        title="Accept this counter offer"
                        style={{
                          position: 'relative',
                          overflow: 'hidden',
                          background: isCountingDown ? '#dc2626' : undefined,
                          minWidth: '130px'
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            bottom: 0,
                            width: `${progressPercent}%`,
                            background: 'rgba(0, 0, 0, 0.2)',
                            transition: 'width 1s linear',
                            pointerEvents: 'none'
                          }}
                        />
                        <span style={{ position: 'relative', zIndex: 1 }}>
                          {acceptingOfferId === offerKey
                            ? 'Accepting…'
                            : isCountingDown
                            ? `Cancel (${countdown})`
                            : 'Accept Counter'}
                        </span>
                      </CounterCardButton>
                    </>
                  ) : null}
                  <CounterCardButtonSecondary
                    type="button"
                    onClick={() => {
                      const targetId = offer.offerId || offer.id;
                      if (!targetId) return;
                      navigate(`/p2p/${targetId}`);
                    }}
                    style={{
                      minWidth: '130px'
                    }}
                  >
                    View Counter
                  </CounterCardButtonSecondary>
                </CounterCardActions>
              </CounterCardFooter>
            </CounterCard>
          );
        })}
      </CounterCardsGrid>
    </CounterOffersBlock>

    {/* Accept Counter Tooltip */}
    {hoveredOffer && isOwner && (
      <AcceptOfferTooltip
        userGivesAssets={hoveredOffer.requestedAssets}
        userGetsAssets={hoveredOffer.offeredAssets}
        position={counterTooltipPosition}
      />
    )}
    </>
  );
};

export default CounterOffersList;
