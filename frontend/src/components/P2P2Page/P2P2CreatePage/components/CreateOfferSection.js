import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { usePrivyOptimized } from '../../../../context';
import useUserNFTs from '../hooks/useUserNFTs';
import useRequestedAssets from '../hooks/useRequestedAssets';
import useP2P2Contract from '../hooks/useP2P2Contract';
import { ASSET_TYPES, OFFER_TYPES } from '../utils/constants';
import {
  CreateSectionContainer,
  StepSlot,
  StepTransition
} from '../styles';
import PrefillProgress from './PrefillProgress';
import OfferTypeStep from './OfferTypeStep';
import SelectAssetsStep from './SelectAssetsStep';
import RequestedAssetsStep from './RequestedAssetsStep';
import NFTSelectionContainer from './NFTSelectionContainer';
import OfferDetailsStep from './OfferDetailsStep';
import CounterOfferStep from './CounterOfferStep';
import usePrefillFlow from '../hooks/usePrefillFlow';
import { ZERO_ADDRESS, shortenAddress } from '../utils/assetHelpers';
import { useP2P2Events } from '../../../../context/P2P2EventsContext';

const INDEXER_WAIT_TIMEOUT_MS = 3000;

const clamp = (value, max) => {
  if (!value || value.length <= max) return value;
  return value.slice(0, max - 3) + '...';
};

const AnimatedStep = ({ active, children }) => {
  const visibleAttr = active ? 'true' : 'false';
  return (
    <StepSlot data-active={visibleAttr}>
      <StepTransition data-visible={visibleAttr}>{children}</StepTransition>
    </StepSlot>
  );
};

const CreateOfferSection = ({ counterOfferPrefill = { status: 'idle' } }) => {
  const { walletAddress } = usePrivyOptimized();
  const navigate = useNavigate();
  const API_BASE_URL =
    process.env.REACT_APP_BACKEND_URL ||
    process.env.REACT_APP_API_URL ||
    'https://api.monaliens.xyz';

  const { nfts, loading, error } = useUserNFTs(walletAddress);
  const {
    createOffer,
    loading: txLoading,
    txHash,
    step
  } = useP2P2Contract();
  const { waitForOfferCreated } = useP2P2Events();

  const [offerType, setOfferType] = useState('OPEN');
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [showNFTSelection, setShowNFTSelection] = useState(false);
  const [selectedCollectionForNFTs, setSelectedCollectionForNFTs] = useState(null);
  const [offeredNativeAmount, setOfferedNativeAmount] = useState('');
  const [offeredLmonAmount, setOfferedLmonAmount] = useState('');
  const [requestedNativeAmount, setRequestedNativeAmount] = useState('');
  const [requestedLmonAmount, setRequestedLmonAmount] = useState('');
  const [waitingForIndexer, setWaitingForIndexer] = useState(false);
  const [validationError, setValidationError] = useState(false);
  const [duration, setDuration] = useState(86400); // Default: 24h (1 day in seconds)

  const requestedAssetsManager = useRequestedAssets(API_BASE_URL);
  const {
    requestedAssets,
    setRequestedAssets,
    reset: resetRequestedAssets,
    listings,
    listingsLoading,
    listingsError,
    loadListings,
    removeRequestedAsset,
    addRequestedNative
  } = requestedAssetsManager;

  const {
    prefillStatus,
    prefillTargetId,
    prefillError,
    refreshPrefill,
    showPrefillProgress,
    showForm,
    prefillSteps,
    prefillStepStates,
    visiblePrefillLabel,
    counterContext
  } = usePrefillFlow({
    counterOfferPrefill,
    nfts,
    loading,
    offerType,
    setOfferType,
    setRequestedAssets,
    setSelectedAssets,
    setOfferedNativeAmount,
    setOfferedLmonAmount,
    setRequestedLmonAmount
  });

  const isSpecificOffer = offerType === 'SPECIFIC';
  const requestedAssetCount = useMemo(() => {
    let count = requestedAssets.length;
    if (requestedNativeAmount && parseFloat(requestedNativeAmount) > 0) count++;
    if (requestedLmonAmount && parseFloat(requestedLmonAmount) > 0) count++;
    return count;
  }, [requestedAssets.length, requestedNativeAmount, requestedLmonAmount]);
  const isCounterOffer = Boolean(prefillTargetId);

  useEffect(() => {
    if (offerType === 'OPEN') {
      resetRequestedAssets();
      setShowNFTSelection(false);
      setSelectedCollectionForNFTs(null);
    }
  }, [offerType, resetRequestedAssets]);

  useEffect(() => {
    if (!isCounterOffer) return;
    setShowNFTSelection(false);
    setSelectedCollectionForNFTs(null);
  }, [isCounterOffer]);

  const handleAssetSelect = useCallback((asset) => {
    setSelectedAssets((prev) => {
      const exists = prev.find((item) => item.id === asset.id);
      if (exists) {
        return prev.filter((item) => item.id !== asset.id);
      }
      return [...prev, asset];
    });
  }, []);

  const handleOfferedNativeChange = useCallback((value) => {
    const sanitized = value.replace(/[^0-9.]/g, '');
    setOfferedNativeAmount(sanitized);
  }, []);

  const handleRequestedNativeChange = useCallback((value) => {
    const sanitized = value.replace(/[^0-9.]/g, '');
    setRequestedNativeAmount(sanitized);
  }, []);

  const handleCollectionSelect = (collection) => {
    setSelectedCollectionForNFTs(collection);
    setShowNFTSelection(true);

    const collectionAddress =
      collection.contractAddress ||
      collection.primaryContract ||
      collection.address ||
      collection.id;

    if (collectionAddress) {
      loadListings(collectionAddress);
    }
  };

  const handleNFTSelectionSave = (selections) => {
    const currentAddress =
      selectedCollectionForNFTs?.contractAddress ||
      selectedCollectionForNFTs?.primaryContract ||
      selectedCollectionForNFTs?.address ||
      selectedCollectionForNFTs?.id;

    const otherSelections = requestedAssets.filter((asset) => {
      const assetAddress = asset.collectionAddress || asset.collectionId;
      return assetAddress !== currentAddress;
    });

    setRequestedAssets([...otherSelections, ...selections]);
    setShowNFTSelection(false);
  };

  const handleNFTSelectionCancel = () => {
    setShowNFTSelection(false);
  };

  const getCurrentSelections = () => {
    if (!selectedCollectionForNFTs) return [];

    const currentAddress =
      selectedCollectionForNFTs.contractAddress ||
      selectedCollectionForNFTs.primaryContract ||
      selectedCollectionForNFTs.address ||
      selectedCollectionForNFTs.id;

    return requestedAssets.filter((asset) => {
      const assetAddress = asset.collectionAddress || asset.collectionId;
      return assetAddress === currentAddress;
    });
  };

  const requestedSummary = useMemo(() => {
    const summary = [];

    // Add MON if specified
    if (requestedNativeAmount && parseFloat(requestedNativeAmount) > 0) {
      summary.push({
        id: 'requested-mon',
        type: 'token',
        symbol: 'MON',
        label: `${requestedNativeAmount} MON`,
        thumbnail: null
      });
    }

    // Add LMON if specified
    if (requestedLmonAmount && parseFloat(requestedLmonAmount) > 0) {
      summary.push({
        id: 'requested-lmon',
        type: 'token',
        symbol: 'LMON',
        label: `${requestedLmonAmount} LMON`,
        thumbnail: null
      });
    }

    if (!requestedAssets.length) {
      return summary;
    }

    const assetSummary = requestedAssets.map((asset) => {
      if (asset.type === 'token' && asset.assetType === ASSET_TYPES.NATIVE) {
        return {
          id: asset.id || 'requested-native-mon',
          type: 'token',
          symbol: 'MON',
          label: `${asset.amount} MON`,
          thumbnail: null
        };
      }

      if (asset.type === 'erc20' && asset.assetType === ASSET_TYPES.ERC20) {
        return {
          id: asset.id || 'requested-erc20-lmon',
          type: 'token',
          symbol: asset.symbol || 'LMON',
          label: `${asset.amount} ${asset.symbol || 'LMON'}`,
          thumbnail: null
        };
      }

      if (asset.type === 'collection') {
        const quantity = asset.quantity ?? 1;
        const collectionLabel =
          asset.collectionName ||
          shortenAddress(asset.collectionAddress) ||
          shortenAddress(asset.collectionKey) ||
          'Collection';

        return {
          id: asset.id,
          type: 'collection',
          label: `${quantity}× ${collectionLabel}`,
          thumbnail: null
        };
      }

      const labelParts = [asset.collectionName, asset.tokenId ? `#${asset.tokenId}` : null];
      if (asset.tokenAddress) {
        labelParts.push(`(${shortenAddress(asset.tokenAddress)})`);
      }

      const fallbackName =
        asset.name || (asset.tokenId ? `Token #${asset.tokenId}` : 'Specific NFT');
      const label = labelParts.filter(Boolean).join(' ').trim() || fallbackName;

      return {
        id: asset.id,
        type: 'specific',
        label,
        thumbnail: asset.image || asset.thumbnail || null
      };
    });

    return [...summary, ...assetSummary];
  }, [requestedAssets, requestedNativeAmount, requestedLmonAmount]);

  const handleSummaryRemove = useCallback(
    (assetId) => {
      if (isCounterOffer) return;
      removeRequestedAsset(assetId);
    },
    [isCounterOffer, removeRequestedAsset]
  );

  const formatOfferedSummary = useMemo(() => {
    const nftCount = selectedAssets.length;
    const mon = offeredNativeAmount && Number(offeredNativeAmount) > 0 ? offeredNativeAmount : '';
    const lmon = offeredLmonAmount && Number(offeredLmonAmount) > 0 ? offeredLmonAmount : '';

    const parts = [];
    if (nftCount === 1) {
      const one = selectedAssets[0];
      const tokenId = one?.tokenId ? `#${one.tokenId}` : 'NFT';
      parts.push(`NFT ${tokenId}`);
    } else if (nftCount > 1) {
      parts.push(`${nftCount} NFTs`);
    }

    if (mon) parts.push(`${mon} MON`);
    if (lmon) parts.push(`${lmon} LMON`);
    return parts.length ? parts.join(' + ') : 'Offer';
  }, [selectedAssets, offeredNativeAmount, offeredLmonAmount]);

  const formatRequestedSummary = useMemo(() => {
    if (!isSpecificOffer) return 'Open offer';

    let monTotal = 0;
    let specificCount = 0;
    const collectionParts = [];

    requestedAssets.forEach((asset) => {
      if (asset.type === 'token' && asset.assetType === ASSET_TYPES.NATIVE) {
        const value = parseFloat(asset.amount || '0');
        if (!Number.isNaN(value)) {
          monTotal += value;
        }
      } else if (asset.type === 'specific') {
        specificCount += 1;
      } else if (asset.type === 'collection') {
        const quantity = asset.quantity ?? 1;
        const name = asset.collectionName || 'collection';
        collectionParts.push(`${quantity} from ${name}`);
      }
    });

    // Add direct state values
    const mon = requestedNativeAmount && Number(requestedNativeAmount) > 0 ? Number(requestedNativeAmount) : 0;
    const lmon = requestedLmonAmount && Number(requestedLmonAmount) > 0 ? Number(requestedLmonAmount) : 0;

    const parts = [];
    if (specificCount === 1) parts.push('1 NFT');
    else if (specificCount > 1) parts.push(`${specificCount} NFTs`);
    parts.push(...collectionParts);
    if (mon > 0) parts.push(`${mon} MON`);
    if (lmon > 0) parts.push(`${lmon} LMON`);

    return parts.length ? parts.join(' + ') : 'Specific request';
  }, [requestedAssets, isSpecificOffer, requestedNativeAmount, requestedLmonAmount]);

  const generatedTitle = useMemo(
    () => clamp(formatOfferedSummary, 32),
    [formatOfferedSummary]
  );

  const generatedDescription = useMemo(() => {
    const base = isSpecificOffer
      ? `Offering: ${formatOfferedSummary}; Request: ${formatRequestedSummary}`
      : `Offering: ${formatOfferedSummary}; Open offer`;
    return clamp(base, 64);
  }, [formatOfferedSummary, formatRequestedSummary, isSpecificOffer]);

  const buildOfferedAssets = () => {
    const nftAssets = selectedAssets.map((nft) => ({
      assetType: ASSET_TYPES.ERC721,
      contractAddress: nft.contractAddress,
      tokenIdOrAmount: nft.tokenId,
      amount: 0, // Specific true olduğunda amount 0 olmalı
      isSpecific: true
    }));

    const assets = [...nftAssets];

    // Add MON if specified
    const monAmount = offeredNativeAmount.trim();
    if (monAmount && Number(monAmount) > 0) {
      assets.push({
        assetType: ASSET_TYPES.NATIVE,
        contractAddress: ZERO_ADDRESS,
        tokenIdOrAmount: monAmount,
        amount: 0,
        isSpecific: true
      });
    }

    // Add LMON if specified
    const lmonAmount = offeredLmonAmount.trim();
    if (lmonAmount && Number(lmonAmount) > 0) {
      assets.push({
        assetType: ASSET_TYPES.ERC20,
        contractAddress: '0xECc6F8fB4962cBF02D83CEE8c4d9c2C96204A17D', // LMON contract
        tokenIdOrAmount: lmonAmount,
        amount: 0,
        isSpecific: true
      });
    }

    return assets;
  };

  const buildRequestedAssets = () => {
    const assets = [];

    // Add MON if specified
    const monAmount = requestedNativeAmount.trim();
    if (monAmount && Number(monAmount) > 0) {
      assets.push({
        assetType: ASSET_TYPES.NATIVE,
        contractAddress: ZERO_ADDRESS,
        tokenIdOrAmount: monAmount,
        amount: 0,
        isSpecific: true
      });
    }

    // Add LMON if specified
    const lmonAmount = requestedLmonAmount.trim();
    if (lmonAmount && Number(lmonAmount) > 0) {
      assets.push({
        assetType: ASSET_TYPES.ERC20,
        contractAddress: '0xECc6F8fB4962cBF02D83CEE8c4d9c2C96204A17D', // LMON contract
        tokenIdOrAmount: lmonAmount,
        amount: 0,
        isSpecific: true
      });
    }

    // Add NFT assets from requestedAssets array
    const nftAssets = requestedAssets.map((asset) => {
      if (asset.type === 'token' && asset.assetType === ASSET_TYPES.NATIVE) {
        const amount = asset.amount || '0';
        return {
          assetType: ASSET_TYPES.NATIVE,
          contractAddress: ZERO_ADDRESS,
          tokenIdOrAmount: amount,
          amount: 0,
          isSpecific: true
        };
      }

      if (asset.type === 'erc20' && asset.assetType === ASSET_TYPES.ERC20) {
        const amount = asset.amount || '0';
        return {
          assetType: ASSET_TYPES.ERC20,
          contractAddress: asset.contractAddress,
          tokenIdOrAmount: amount,
          amount: 0,
          isSpecific: true
        };
      }

      if (asset.type === 'specific') {
        const contractAddress = asset.collectionAddress || asset.collectionId;
        return {
          assetType: ASSET_TYPES.ERC721,
          contractAddress: contractAddress || ZERO_ADDRESS,
          tokenIdOrAmount: asset.tokenId,
          amount: 0,
          isSpecific: true
        };
      }

      const contractAddress = asset.collectionAddress || asset.collectionId;
      return {
        assetType: ASSET_TYPES.ERC721,
        contractAddress: contractAddress || ZERO_ADDRESS,
        tokenIdOrAmount: 0,
        amount: asset.quantity ?? 1,
        isSpecific: false
      };
    });

    return [...assets, ...nftAssets];
  };

  const inferOfferType = () => {
    if (offerType === 'OPEN') return OFFER_TYPES.OPEN;

    const onlyCollections = requestedAssets.every((asset) => asset.type === 'collection');
    if (isSpecificOffer && requestedAssets.length > 0 && onlyCollections) {
      return OFFER_TYPES.COLLECTION;
    }

    const totalItems = selectedAssets.length + requestedAssets.length;
    return totalItems > 2 ? OFFER_TYPES.MULTI : OFFER_TYPES.SINGLE;
  };

  const violatesCollectionConstraint = useMemo(() => {
    if (!isSpecificOffer) return false;
    if (inferOfferType() !== OFFER_TYPES.COLLECTION) return false;

    const collectionAddresses = requestedAssets
      .filter((asset) => asset.type === 'collection')
      .map((asset) => (asset.collectionAddress || asset.collectionKey || '').toLowerCase())
      .filter(Boolean);

    return new Set(collectionAddresses).size > 1;
  }, [requestedAssets, isSpecificOffer]);

  const handleCreateOffer = async () => {
    setValidationError(false);

    if (!walletAddress) {
      setValidationError(true);
      toast.error('Please connect your wallet.');
      setTimeout(() => setValidationError(false), 600);
      return;
    }

    const hasNFTs = selectedAssets.length > 0;
    const hasMon = offeredNativeAmount && Number(offeredNativeAmount) > 0;
    const hasLmon = offeredLmonAmount && Number(offeredLmonAmount) > 0;

    if (!hasNFTs && !hasMon && !hasLmon) {
      setValidationError(true);
      toast.error('You must offer at least one asset (NFT, MON, or LMON).');
      setTimeout(() => setValidationError(false), 600);
      return;
    }

    const hasRequestedMon = requestedNativeAmount && Number(requestedNativeAmount) > 0;
    const hasRequestedLmon = requestedLmonAmount && Number(requestedLmonAmount) > 0;

    if (isSpecificOffer && requestedAssets.length === 0 && !hasRequestedMon && !hasRequestedLmon) {
      setValidationError(true);
      toast.error('Please select requested assets (NFTs, MON, or LMON) or switch to an open offer.');
      setTimeout(() => setValidationError(false), 600);
      return;
    }

    const totalRequestedNFTs = requestedAssets.reduce((total, asset) => {
      if (asset.type === 'token') return total;
      if (asset.type === 'collection') return total + (asset.quantity || 1);
      if (asset.type === 'specific') return total + 1;
      return total;
    }, 0);

    if (totalRequestedNFTs > 4) {
      setValidationError(true);
      toast.error('Maximum 4 NFTs can be requested (total).');
      setTimeout(() => setValidationError(false), 600);
      return;
    }

    if (violatesCollectionConstraint) {
      setValidationError(true);
      toast.error('Collection offer can only have one collection.');
      setTimeout(() => setValidationError(false), 600);
      return;
    }

    const requested = buildRequestedAssets();
    const offered = buildOfferedAssets();
    const offerKind = inferOfferType();

    const invalidCollectionAssets = requestedAssets.filter((asset) => {
      if (asset.type === 'collection' || asset.type === 'specific') {
        const address = asset.collectionAddress || asset.collectionId;
        return !address || address === ZERO_ADDRESS;
      }
      return false;
    });

    if (invalidCollectionAssets.length > 0) {
      setValidationError(true);
      toast.error('Invalid collection address found in requests.');
      setTimeout(() => setValidationError(false), 600);
      return;
    }

    const maybeCollectionAddress = requested.find(
      (asset) => asset.assetType === ASSET_TYPES.ERC721 && !asset.isSpecific
    )?.contractAddress;

    if (
      offerKind === OFFER_TYPES.COLLECTION &&
      (!maybeCollectionAddress || maybeCollectionAddress === ZERO_ADDRESS)
    ) {
      setValidationError(true);
      toast.error('Valid collection address required for collection offer.');
      setTimeout(() => setValidationError(false), 600);
      return;
    }

    try {
      const creationStartedAt = Date.now();
      const result = await createOffer({
        offerType: offerKind,
        targetUser: counterContext.targetUser || ZERO_ADDRESS,
        collectionAddress: maybeCollectionAddress || ZERO_ADDRESS,
        duration,
        targetOfferId: counterContext.targetOfferId || 0,
        title: generatedTitle,
        description: generatedDescription,
        offeredAssets: offered,
        requestedAssets: requested
      });

      if (result?.success) {
        let createdEvent = null;
        setWaitingForIndexer(true);
        toast.loading(
          `Waiting for offer confirmation (max ${INDEXER_WAIT_TIMEOUT_MS / 1000}s)…`,
          { id: 'p2p2-offer-sync' }
        );

        try {
          createdEvent = await waitForOfferCreated({
            maker: walletAddress,
            title: generatedTitle,
            after: creationStartedAt,
            timeout: INDEXER_WAIT_TIMEOUT_MS
          });
          toast.success('Offer confirmed! Redirecting…', { id: 'p2p2-offer-sync' });
        } catch (waitError) {
          if (waitError?.message === 'offerCreated-timeout') {
            toast.success('Offer created! Redirecting…', { id: 'p2p2-offer-sync' });
          } else {
            toast.error('Offer created but indexer response is delayed. Redirecting…', {
              id: 'p2p2-offer-sync'
            });
          }
        } finally {
          setWaitingForIndexer(false);
        }

        const state = createdEvent?.offerId ? { newOfferId: createdEvent.offerId } : undefined;
        navigate('/p2p', { replace: true, state });
      } else {
        toast.error('Offer creation failed');
      }
    } catch (err) {
      toast.error(`Offer creation failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleSaveRequestedNative = () => {
    if (isCounterOffer) return;
    addRequestedNative(requestedNativeAmount);
  };

  const isProcessing = txLoading || waitingForIndexer;

  return (
    <CreateSectionContainer>
      {prefillStatus === 'error' && prefillTargetId ? (
        <div
          style={{
            width: '100%',
            maxWidth: '860px',
            margin: '0 auto 20px',
            padding: '14px 18px',
            borderRadius: '18px',
            background: 'rgba(239, 68, 68, 0.14)',
            color: '#7f1d1d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            fontWeight: 600,
            fontSize: '14px'
          }}
        >
          <span>
            Could not load offer {visiblePrefillLabel || `#${prefillTargetId}`}.
            {prefillError ? ` (${prefillError})` : ''}
          </span>
          <button
            type="button"
            onClick={refreshPrefill}
            style={{
              border: 'none',
              background: 'rgba(239, 68, 68, 0.22)',
              color: '#7f1d1d',
              padding: '8px 16px',
              borderRadius: '999px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      <PrefillProgress
        visible={showPrefillProgress}
        steps={prefillSteps}
        stepStates={prefillStepStates}
      />

      {showForm && (
        <>
          {isCounterOffer ? (
            <CounterOfferStep
              prefillLabel={visiblePrefillLabel}
              targetOfferId={counterContext.targetOfferId || prefillTargetId}
              disabled={isProcessing}
            />
          ) : (
            <OfferTypeStep
              offerType={offerType}
              onChange={setOfferType}
              disabled={isProcessing}
            />
          )}

          <SelectAssetsStep
            loading={loading}
            error={error}
            nfts={nfts}
            selectedAssets={selectedAssets}
            onToggleAsset={handleAssetSelect}
            offeredNativeAmount={offeredNativeAmount}
            onNativeAmountChange={handleOfferedNativeChange}
            offeredLmonAmount={offeredLmonAmount}
            onLmonAmountChange={setOfferedLmonAmount}
            walletAddress={walletAddress}
            disabled={isProcessing}
            descriptionOverride={
              isCounterOffer
                ? `Select the assets you'll offer back (${selectedAssets.length} selected)`
                : undefined
            }
          />

          {!isCounterOffer && (
            <AnimatedStep active={isSpecificOffer}>
              <RequestedAssetsStep
                isVisible={isSpecificOffer}
                manager={requestedAssetsManager}
                onCollectionSelect={handleCollectionSelect}
                requestedMonAmount={requestedNativeAmount}
                onRequestedMonChange={setRequestedNativeAmount}
                requestedLmonAmount={requestedLmonAmount}
                onRequestedLmonChange={setRequestedLmonAmount}
                disabled={isProcessing}
              />
            </AnimatedStep>
          )}

          {!isCounterOffer && (
            <AnimatedStep active={showNFTSelection}>
              <NFTSelectionContainer
                selectedCollection={selectedCollectionForNFTs}
                listings={listings}
                listingsLoading={listingsLoading}
                listingsError={listingsError}
                onSave={handleNFTSelectionSave}
                onCancel={handleNFTSelectionCancel}
                initialSelections={getCurrentSelections()}
                disabled={isProcessing}
              />
            </AnimatedStep>
          )}

          <AnimatedStep active={!showNFTSelection || !isSpecificOffer}>
            <OfferDetailsStep
              isSpecificOffer={isSpecificOffer}
              requestedAssetCount={requestedAssetCount}
              counterContext={counterContext}
              prefillLabel={visiblePrefillLabel}
              requestedSummary={requestedSummary}
              requestedNativeAmount={requestedNativeAmount}
              onRequestedNativeChange={handleRequestedNativeChange}
              onSaveRequestedNative={handleSaveRequestedNative}
              generatedTitle={generatedTitle}
              generatedDescription={generatedDescription}
              violatesCollectionConstraint={violatesCollectionConstraint}
              handleSummaryRemove={handleSummaryRemove}
              txLoading={txLoading}
              isIndexing={waitingForIndexer}
              handleCreateOffer={handleCreateOffer}
              step={step}
              txHash={txHash}
              allowRequestedNativeEdit={!isCounterOffer}
              allowSummaryRemoval={!isCounterOffer}
              ctaLabel={isCounterOffer ? 'Create Counter Offer' : 'Create Offer'}
              disabled={isProcessing}
              validationError={validationError}
              duration={duration}
              onDurationChange={setDuration}
            />
          </AnimatedStep>
        </>
      )}
    </CreateSectionContainer>
  );
};

export default CreateOfferSection;
