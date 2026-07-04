import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useBalance } from 'wagmi';

const API_BASE_URL = 'https://api.monaliens.xyz/api/p2p';
import {
  DetailPage,
  DetailWrapper,
  TopRow,
  BackButton,
  Tabs,
  TabButton,
  Heading,
  OfferTitle,
  OfferDescription,
  PurpleSurface,
  DividerColumn,
  MetaFooter,
  TradeButton,
  OwnerBadge,
  CancelButton,
  LoadingState,
  ErrorCard,
  RetryButton,
  AcceptOfferButton
} from './styles';
import { usePrivyOptimized } from '../../../context';
import useP2P2Offer from './hooks/useP2P2Offer';
import AssetsPanel from './components/AssetsPanel';
import OfferMeta from './components/OfferMeta';
import CounterOffersList from './components/CounterOffersList';
import useOfferChildren from './hooks/useOfferChildren';
import useOfferActions from './hooks/useOfferActions';
import AcceptOfferTooltip from '../components/AcceptOfferTooltip';
import useP2P2Contract from '../P2P2CreatePage/hooks/useP2P2Contract';
import { checkOwnership, fetchUserNFTs } from './utils/ownerCheck';
import { formatEther } from 'viem';
import { ASSET_TYPES } from '../P2P2CreatePage/utils/constants';
import NFTSelector from './components/NFTSelector';

const P2P2OfferDetailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { walletAddress } = usePrivyOptimized();
  const { offer, loading, error, refresh } = useP2P2Offer(id);
  const [activeTab, setActiveTabState] = useState('details');
  const [acceptingOfferId, setAcceptingOfferId] = useState(null);
  const [canceling, setCanceling] = useState(false);
  const [acceptingOffer, setAcceptingOffer] = useState(false);
  const [acceptCountdown, setAcceptCountdown] = useState(0);
  const [showAcceptTooltip, setShowAcceptTooltip] = useState(false);
  const [acceptTooltipPosition, setAcceptTooltipPosition] = useState({ top: 0, left: 0 });
  const countdownRef = useRef(null);
  const acceptButtonRef = useRef(null);
  const acceptOfferButtonRef = useRef(null); // For general users
  const tooltipHoverTimeoutRef = useRef(null);

  // Accept Offer states
  const [canAccept, setCanAccept] = useState(false);
  const [checkingOwnership, setCheckingOwnership] = useState(false);
  const [acceptingCounter, setAcceptingCounter] = useState(false);

  // NFT Selector states
  const [showNFTSelector, setShowNFTSelector] = useState(false);
  const [userNFTsForSelection, setUserNFTsForSelection] = useState([]);
  const [collectionRequests, setCollectionRequests] = useState([]);

  const offerType = useMemo(() => {
    if (offer?.offerTypeString) return offer.offerTypeString;
    if (offer?.offerType === 1) return 'MULTI';
    if (offer?.offerType === 2) return 'COLLECTION';
    if (offer?.offerType === 3) return 'OPEN';
    return 'DIRECT TRADE';
  }, [offer]);

  const isOpenOffer = useMemo(() => {
    return offerType === 'OPEN' || offer?.offerType === 3 || !offer?.requestedAssets || offer.requestedAssets.length === 0;
  }, [offerType, offer]);

  const normalizedWallet = walletAddress ? walletAddress.toLowerCase() : null;
  const offerMaker = useMemo(() => {
    if (!offer) return null;
    return (
      offer.maker?.toLowerCase?.() ||
      offer.makerAddress?.toLowerCase?.() ||
      offer.owner?.toLowerCase?.() ||
      null
    );
  }, [offer]);

  const isOwnOffer = Boolean(normalizedWallet && offerMaker && normalizedWallet === offerMaker);

  // Check if current user is the target of this offer
  const offerTarget = useMemo(() => {
    if (!offer) return null;
    const target = offer.targetUser || offer.targetAddress;
    if (!target || target === '0x0000000000000000000000000000000000000000') return null;
    return target.toLowerCase();
  }, [offer]);

  const isTargetUser = Boolean(normalizedWallet && offerTarget && normalizedWallet === offerTarget);

  // Get user's MON balance
  const { data: balanceData } = useBalance({
    address: walletAddress,
    watch: true
  });

  // Calculate required MON from requested assets
  const requiredMON = useMemo(() => {
    if (!offer?.requestedAssets) return BigInt(0);

    const nativeAsset = offer.requestedAssets.find(asset => asset.assetType === ASSET_TYPES.NATIVE);
    if (!nativeAsset) return BigInt(0);

    try {
      return BigInt(nativeAsset.tokenIdOrAmount || 0);
    } catch {
      return BigInt(0);
    }
  }, [offer?.requestedAssets]);

  // Check if user has enough balance
  const hasEnoughBalance = useMemo(() => {
    if (!balanceData || requiredMON === BigInt(0)) return true;
    return balanceData.value >= requiredMON;
  }, [balanceData, requiredMON]);

  const {
    offers: counterOffers,
    loading: counterLoading,
    error: counterError,
    refresh: refreshCounterOffers
  } = useOfferChildren(offer?.offerId || id, {
    enabled: Boolean(offer?.offerId || id)
  });

  const statusString = useMemo(() => (offer?.statusString || '').toUpperCase(), [offer]);
  const isAcceptedStatus = statusString === 'ACCEPTED' || offer?.status === 2;
  const isActiveStatus = statusString === 'ACTIVE' || offer?.status === 1;

  const {
    acceptCounterOffer,
    cancelOffer: cancelOnChainOffer,
    loading: actionLoading
  } = useOfferActions();

  // Hook for creating counter offers
  const { createOffer, loading: createLoading } = useP2P2Contract();

  const tabStorageKey = useMemo(() => (id ? `p2p2-offer-tab-${id}` : null), [id]);

  const setActiveTab = useCallback(
    (tab) => {
      setActiveTabState(tab);
      if (tabStorageKey) {
        try {
          sessionStorage.setItem(tabStorageKey, tab);
        } catch (err) {
          console.warn('Unable to persist tab state', err);
        }
      }
    },
    [tabStorageKey]
  );

  useEffect(() => {
    const focusCounter = location.state?.focusCounterTab;
    if (focusCounter) {
      setActiveTab('counter');
      navigate(location.pathname, {
        replace: true,
        state: { ...location.state, focusCounterTab: undefined }
      });
      return;
    }

    if (tabStorageKey) {
      try {
        const stored = sessionStorage.getItem(tabStorageKey);
        if (stored === 'counter' || stored === 'details') {
          setActiveTabState(stored);
          return;
        }
      } catch (err) {
        console.warn('Unable to read tab state', err);
      }
    }

    setActiveTab('details');
  }, [id, location.pathname, location.state, navigate, setActiveTab, tabStorageKey]);

  const counterOfferCount = useMemo(
    () => (counterOffers && counterOffers.length > 0
      ? counterOffers.length
      : offer?.counterOffers?.length || 0),
    [counterOffers, offer]
  );

  const handleAcceptCounter = useCallback(
    async (counterOffer, offerKey) => {
      if (!offer?.contractAddress) {
        console.log('Offer contract address missing');
        return;
      }
      if (!counterOffer?.contractAddress) {
        console.log('Counter offer contract missing');
        return;
      }

      const idKey = offerKey || counterOffer.offerId || counterOffer.id || counterOffer.contractAddress;
      setAcceptingOfferId(idKey);

      const result = await acceptCounterOffer({
        offerContract: offer.contractAddress,
        counterContract: counterOffer.contractAddress
      });

      if (result.success) {
        await Promise.all([refresh(), refreshCounterOffers()]);
      }

      setAcceptingOfferId(null);
    },
    [offer, acceptCounterOffer, refresh, refreshCounterOffers]
  );

  const handleCancelOffer = useCallback(async () => {
    if (!offer?.contractAddress) {
      console.log('Offer contract address missing');
      return;
    }
    setCanceling(true);
    const result = await cancelOnChainOffer({ offerContract: offer.contractAddress });
    if (result.success) {
      await Promise.all([refresh(), refreshCounterOffers()]);
    }
    setCanceling(false);
  }, [offer, cancelOnChainOffer, refresh, refreshCounterOffers]);

  const handleAcceptOffer = useCallback(async () => {
    if (!offer?.contractAddress) {
      console.log('Offer contract address missing');
      setAcceptingOffer(false);
      setAcceptCountdown(0);
      return;
    }

    try {
      console.log('Accepting offer...');

      // Check if this is a counter offer (has targetOfferId)
      if (offer.targetOfferId && offer.targetOfferId > 0) {
        // This is a counter offer - need to fetch parent offer's contract address
        try {
          const parentResponse = await fetch(`${API_BASE_URL}/offers/${offer.targetOfferId}`);
          const parentData = await parentResponse.json();

          if (parentData.success && parentData.data?.contractAddress) {
            const parentContractAddress = parentData.data.contractAddress;

            // Accept counter offer: parent contract accepts current counter offer
            const result = await acceptCounterOffer({
              offerContract: parentContractAddress,  // Parent offer's contract
              counterContract: offer.contractAddress  // Current counter offer's contract
            });

            if (result.success) {
              console.log('Counter offer accepted!');
              await refresh();
            }
          } else {
            console.error('Failed to fetch parent offer contract');
          }
        } catch (error) {
          console.error('Failed to fetch parent offer:', error);
        }
      } else {
        // This is a regular targeted offer - accept directly
        const result = await acceptCounterOffer({
          offerContract: offer.contractAddress,
          counterContract: offer.contractAddress
        });

        if (result.success) {
          console.log('Offer accepted!');
          await refresh();
        }
      }
    } catch (err) {
      console.error('Failed to accept offer:', err);
    } finally {
      setAcceptingOffer(false);
      setAcceptCountdown(0);
    }
  }, [offer, acceptCounterOffer, refresh]);

  // Check ownership for Accept Offer button
  useEffect(() => {
    const check = async () => {
      // Skip if no offer or wallet or user owns the offer
      if (!offer || !walletAddress || isOwnOffer) {
        console.log('[Accept Check] SKIP - no offer/wallet or is owner');
        setCanAccept(false);
        setCheckingOwnership(false);
        return;
      }

      // Check if offer is ACTIVE
      const isOfferActive = offer.statusString === 'ACTIVE' || offer.status === 1;

      // If this is a counter offer (has targetOfferId), check parent offer status
      let isParentActive = true;
      if (offer.targetOfferId && offer.targetOfferId > 0) {
        try {
          const parentResponse = await fetch(`${API_BASE_URL}/offers/${offer.targetOfferId}`);
          const parentData = await parentResponse.json();

          if (parentData.success && parentData.data) {
            const parentOffer = parentData.data;
            isParentActive = parentOffer.statusString === 'ACTIVE' || parentOffer.status === 1;
          }
        } catch (error) {
          console.error('Failed to fetch parent offer:', error);
          isParentActive = false;
        }
      }

      console.log('[Accept Check] Status:', {
        isTargetUser,
        isOfferActive,
        isParentActive,
        hasParent: offer.targetOfferId > 0
      });

      // Case 1: Target user + offer ACTIVE + parent ACTIVE (if counter) -> Direct accept
      if (isTargetUser && isOfferActive && isParentActive) {
        console.log('[Accept Check] ✅ canAccept = true (target user + all active)');
        setCanAccept(true);
        setCheckingOwnership(false);
        return;
      }

      // Case 2 & 3: Non-target user OR offer not active -> Check NFT ownership
      // If user owns the NFTs, they can create a counter offer to accept
      console.log('[Accept Check] Checking NFT ownership...');
      setCheckingOwnership(true);

      try {
        const result = await checkOwnership(offer.requestedAssets, walletAddress);
        console.log('[Accept Check]', result.canAccept ? '✅' : '❌', `canAccept = ${result.canAccept} (has NFT: ${result.canAccept})`);
        setCanAccept(result.canAccept);
      } catch (error) {
        console.error('Ownership check failed:', error);
        console.log('[Accept Check] ❌ canAccept = false (ownership check error)');
        setCanAccept(false);
      } finally {
        setCheckingOwnership(false);
      }
    };

    check();
  }, [offer, walletAddress, isOwnOffer, isTargetUser]);

  // Countdown effect for accept offer
  useEffect(() => {
    if (acceptCountdown > 0) {
      countdownRef.current = setTimeout(() => {
        setAcceptCountdown(acceptCountdown - 1);
      }, 1000);
    } else if (acceptingOffer && acceptCountdown === 0) {
      // Execute accept
      handleAcceptOffer();
    }

    return () => {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, [acceptCountdown, acceptingOffer, handleAcceptOffer]);

  const handleAcceptButtonHover = useCallback((event) => {
    const button = event?.currentTarget || acceptButtonRef.current || acceptOfferButtonRef.current;
    if (button) {
      const rect = button.getBoundingClientRect();
      setAcceptTooltipPosition({
        top: rect.bottom + 10, // Position below button with 10px gap
        left: rect.right - 340 // Align tooltip to right edge of button (340px = tooltip width)
      });
    }

    // Show tooltip after 300ms delay
    tooltipHoverTimeoutRef.current = setTimeout(() => {
      setShowAcceptTooltip(true);
    }, 300);
  }, []);

  const handleAcceptButtonLeave = useCallback(() => {
    // Clear timeout if still pending
    if (tooltipHoverTimeoutRef.current) {
      clearTimeout(tooltipHoverTimeoutRef.current);
      tooltipHoverTimeoutRef.current = null;
    }
    setShowAcceptTooltip(false);
  }, []);

  const handleAcceptOfferClick = useCallback(() => {
    // Hide tooltip when clicking
    setShowAcceptTooltip(false);
    if (tooltipHoverTimeoutRef.current) {
      clearTimeout(tooltipHoverTimeoutRef.current);
      tooltipHoverTimeoutRef.current = null;
    }

    if (!acceptingOffer) {
      // Start countdown
      setAcceptingOffer(true);
      setAcceptCountdown(4); // Start from 4 so it shows 4, 3, 2, 1, 0
    } else {
      // Cancel countdown
      setAcceptingOffer(false);
      setAcceptCountdown(0);
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    }
  }, [acceptingOffer]);

  // Check if offer has ANY (collection) requests
  const hasCollectionRequests = useMemo(() => {
    if (!offer?.requestedAssets) return false;
    return offer.requestedAssets.some(
      asset => asset.assetType === ASSET_TYPES.ERC721 && !asset.isSpecific
    );
  }, [offer]);

  // Handle Accept Offer button click (for general users, not targeted)
  const handleAcceptOfferButtonClick = useCallback(async () => {
    if (!offer) return;

    // If offer has ANY (collection) requests, show NFT selector
    if (hasCollectionRequests) {
      try {
        // Fetch user's NFTs
        const nfts = await fetchUserNFTs(walletAddress);
        setUserNFTsForSelection(nfts);

        // Extract collection requests
        const anyRequests = offer.requestedAssets.filter(
          asset => asset.assetType === ASSET_TYPES.ERC721 && !asset.isSpecific
        );
        setCollectionRequests(anyRequests);

        // Show selector
        setShowNFTSelector(true);
      } catch (error) {
        console.error('Failed to load your NFTs:', error);
      }
    } else {
      // No ANY requests, accept directly
      handleAcceptOfferDirect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer, hasCollectionRequests, walletAddress]);

  // Accept offer with selected NFTs from selector
  const handleAcceptWithSelectedNFTs = useCallback(async (selectedNFTs) => {
    if (!offer) return;

    setShowNFTSelector(false);
    setAcceptingCounter(true);

    try {
      // SWAP ASSETS: What they requested becomes what I offer, what they offered becomes what I request
      let swappedOffered = offer.requestedAssets || [];
      const swappedRequested = offer.offeredAssets || [];

      // Replace ANY requests with specific selected NFTs
      swappedOffered = swappedOffered.flatMap(asset => {
        // If it's a collection request (ANY), replace with selected NFTs
        if (asset.assetType === ASSET_TYPES.ERC721 && !asset.isSpecific) {
          const collectionAddress = asset.contractAddress?.toLowerCase();
          const selected = selectedNFTs[collectionAddress] || [];

          // Convert selected NFT IDs to asset format
          return selected.map(nftId => {
            const [, tokenId] = nftId.split('-');
            return {
              assetType: ASSET_TYPES.ERC721,
              contractAddress: asset.contractAddress,
              tokenIdOrAmount: tokenId,
              amount: 1,
              isSpecific: true,
              metadata: asset.metadata
            };
          });
        }

        // Keep specific NFTs and other assets as is
        return asset;
      });

      // Prepare assets: Convert API format to createOffer input format
      // API sends wei ("2000000000000000000"), createOffer expects ether ("2")
      const prepareAssets = (assets) => assets.map(a => ({
        assetType: a.assetType,
        contractAddress: a.contractAddress || '0x0000000000000000000000000000000000000000',
        tokenIdOrAmount: a.assetType === ASSET_TYPES.NATIVE || a.assetType === ASSET_TYPES.ERC20
          ? formatEther(BigInt(a.tokenIdOrAmount || 0))  // wei → ether ("2000000000000000000" → "2")
          : (a.tokenIdOrAmount || a.amount || 0).toString(),
        amount: a.isSpecific ? 0 : (a.amount || 1), // Specific true ise amount 0, false ise amount değeri
        isSpecific: !!a.isSpecific
      }));

      const result = await createOffer({
        offerType: 0, // SINGLE (specific trade)
        targetUser: offer.maker || offer.makerAddress || '0x0000000000000000000000000000000000000000',
        collectionAddress: '0x0000000000000000000000000000000000000000',
        duration: BigInt(7 * 24 * 60 * 60), // 7 days
        targetOfferId: BigInt(offer.offerId || 0), // AUTO-EXECUTE when accepted
        title: `Counter for ${offer.title || `Offer #${offer.offerId}`}`,
        description: 'Auto-accepted counter offer',
        offeredAssets: prepareAssets(swappedOffered),
        requestedAssets: prepareAssets(swappedRequested)
      });

      if (result.success) {
        await refresh();
        console.log('Counter offer created & executed!');
      }
    } catch (error) {
      console.error('Accept offer error:', error);
    } finally {
      setAcceptingCounter(false);
    }
  }, [offer, createOffer, refresh]);

  // Accept offer directly (no ANY requests)
  const handleAcceptOfferDirect = useCallback(async () => {
    if (!offer) return;

    setAcceptingCounter(true);

    try {
      // SWAP ASSETS: What they requested becomes what I offer, what they offered becomes what I request
      const swappedOffered = offer.requestedAssets || [];
      const swappedRequested = offer.offeredAssets || [];

      // Prepare assets: Convert API format to createOffer input format
      // API sends wei ("2000000000000000000"), createOffer expects ether ("2")
      const prepareAssets = (assets) => assets.map(a => ({
        assetType: a.assetType,
        contractAddress: a.contractAddress || '0x0000000000000000000000000000000000000000',
        tokenIdOrAmount: a.assetType === ASSET_TYPES.NATIVE || a.assetType === ASSET_TYPES.ERC20
          ? formatEther(BigInt(a.tokenIdOrAmount || 0))  // wei → ether ("2000000000000000000" → "2")
          : (a.tokenIdOrAmount || a.amount || 0).toString(),
        amount: a.isSpecific ? 0 : (a.amount || 1), // Specific true ise amount 0, false ise amount değeri
        isSpecific: !!a.isSpecific
      }));

      const result = await createOffer({
        offerType: 0, // SINGLE (specific trade)
        targetUser: offer.maker || offer.makerAddress || '0x0000000000000000000000000000000000000000',
        collectionAddress: '0x0000000000000000000000000000000000000000',
        duration: BigInt(7 * 24 * 60 * 60), // 7 days
        targetOfferId: BigInt(offer.offerId || 0), // AUTO-EXECUTE when accepted
        title: `Counter for ${offer.title || `Offer #${offer.offerId}`}`,
        description: 'Auto-accepted counter offer',
        offeredAssets: prepareAssets(swappedOffered),
        requestedAssets: prepareAssets(swappedRequested)
      });

      if (result.success) {
        await refresh();
        console.log('Counter offer created & executed!');
      }
    } catch (error) {
      console.error('Accept offer error:', error);
    } finally {
      setAcceptingCounter(false);
    }
  }, [offer, createOffer, refresh]);

  return (
    <DetailPage>
      <DetailWrapper>
        <TopRow>
          <BackButton onClick={() => navigate('/p2p')}>
            ← Back to offers
          </BackButton>

          <Tabs>
            <TabButton
              type="button"
              $active={activeTab === 'details'}
              onClick={() => setActiveTab('details')}
            >
              Offer Details
            </TabButton>
            <TabButton
              type="button"
              $active={activeTab === 'counter'}
              onClick={() => setActiveTab('counter')}
            >
              Counter Offers ({counterOfferCount})
            </TabButton>
          </Tabs>

          {!loading && !error && offer ? (
            isOwnOffer ? (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <OwnerBadge>Your Offer</OwnerBadge>
                {(offer?.statusString === 'ACTIVE' || offer?.status === 1) ? (
                  <CancelButton
                    type="button"
                    disabled={canceling || actionLoading}
                    onClick={handleCancelOffer}
                  >
                    {canceling ? 'Cancelling…' : 'Cancel Offer'}
                  </CancelButton>
                ) : null}
              </div>
            ) : (
              !isAcceptedStatus && isActiveStatus ? (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {canAccept && !isOpenOffer && hasEnoughBalance ? (
                    isTargetUser ? (
                      <TradeButton
                        ref={acceptButtonRef}
                        type="button"
                        onClick={handleAcceptOfferClick}
                        onMouseEnter={handleAcceptButtonHover}
                        onMouseLeave={handleAcceptButtonLeave}
                        style={{
                          position: 'relative',
                          overflow: 'hidden',
                          background: acceptingOffer ? '#dc2626' : undefined,
                          minWidth: '140px'
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            bottom: 0,
                            width: acceptingOffer ? `${((4 - acceptCountdown) / 4) * 100}%` : '0%',
                            background: 'rgba(0, 0, 0, 0.2)',
                            transition: 'width 1s linear',
                            pointerEvents: 'none'
                          }}
                        />
                        <span style={{ position: 'relative', zIndex: 1 }}>
                          {acceptingOffer ? `Cancel (${acceptCountdown})` : 'Accept Offer'}
                        </span>
                      </TradeButton>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <AcceptOfferButton
                          ref={acceptOfferButtonRef}
                          type="button"
                          disabled={checkingOwnership || acceptingCounter || createLoading}
                          onClick={handleAcceptOfferButtonClick}
                          onMouseEnter={handleAcceptButtonHover}
                          onMouseLeave={handleAcceptButtonLeave}
                          title="Accept this offer by creating a counter offer"
                        >
                          {checkingOwnership
                            ? 'Checking...'
                            : acceptingCounter || createLoading
                            ? 'Creating...'
                            : 'Accept Offer'}
                        </AcceptOfferButton>

                        {showNFTSelector && (
                          <NFTSelector
                            collectionRequests={collectionRequests}
                            userNFTs={userNFTsForSelection}
                            onConfirm={handleAcceptWithSelectedNFTs}
                            onCancel={() => setShowNFTSelector(false)}
                          />
                        )}
                      </div>
                    )
                  ) : null}
                  {isActiveStatus ? (
                    <TradeButton
                      type="button"
                      onClick={() => {
                        const targetId = offer.offerId ?? id;
                        if (!targetId) {
                          navigate('/p2p/create');
                          return;
                        }

                        navigate(`/p2p/create?target=${targetId}`, {
                          state: { counterOfferSource: offer }
                        });
                      }}
                    >
                      trade it
                    </TradeButton>
                  ) : null}
                </div>
              ) : null
            )
          ) : null}
        </TopRow>

        {loading ? <LoadingState>Loading offer...</LoadingState> : null}

        {!loading && error ? (
          <ErrorCard>
            <h2 style={{ margin: 0, color: '#1f2937' }}>Could not load offer</h2>
            <p style={{ margin: 0, color: '#475569' }}>{error}</p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <RetryButton onClick={refresh}>Retry</RetryButton>
              <RetryButton onClick={() => navigate('/p2p')}>Browse offers</RetryButton>
            </div>
          </ErrorCard>
        ) : null}

        {!loading && !error && offer ? (
          activeTab === 'details' ? (
            <>
              <Heading>
                <OfferTitle>{offer.title || `Offer #${offer.offerId}`}</OfferTitle>
                <OfferDescription>
                  {offer.description || 'Maker has not added a description for this trade.'}
                </OfferDescription>
              </Heading>

              <PurpleSurface>
                <AssetsPanel
                  title="Assets Being Offered"
                  assets={offer.offeredAssets}
                  emptyMessage="No assets provided by maker."
                />

                <DividerColumn />

                <AssetsPanel
                  title="Assets Requested"
                  assets={offer.requestedAssets}
                  emptyMessage={(
                    <>
                      Maker did not specify requested assets.
                      <br />
                      Feel free to create an offer.
                    </>
                  )}
                />
              </PurpleSurface>

              <MetaFooter>
                <OfferMeta offer={offer} />
              </MetaFooter>
            </>
          ) : (
            counterLoading ? (
              <LoadingState>Loading counter offers…</LoadingState>
            ) : counterError ? (
              <ErrorCard>
                <h2 style={{ margin: 0, color: '#1f2937' }}>Could not load counter offers</h2>
                <p style={{ margin: 0, color: '#475569' }}>{counterError}</p>
                <RetryButton onClick={refreshCounterOffers}>Retry</RetryButton>
              </ErrorCard>
            ) : (
              <CounterOffersList
                offers={counterOffers.length ? counterOffers : offer?.counterOffers || []}
                currentUserAddress={walletAddress}
                isOwner={isOwnOffer}
                onAccept={isOwnOffer ? handleAcceptCounter : undefined}
                acceptingOfferId={acceptingOfferId}
                parentOffer={offer}
              />
            )
          )
        ) : null}
      </DetailWrapper>

      {/* Accept Offer Tooltip */}
      {showAcceptTooltip && offer && (
        <AcceptOfferTooltip
          userGivesAssets={offer.requestedAssets}
          userGetsAssets={offer.offeredAssets}
          position={acceptTooltipPosition}
        />
      )}
    </DetailPage>
  );
};

export default P2P2OfferDetailPage;
