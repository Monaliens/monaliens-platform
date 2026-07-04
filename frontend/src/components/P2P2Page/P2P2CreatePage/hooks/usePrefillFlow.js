import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ASSET_TYPES } from '../utils/constants';
import {
  ZERO_ADDRESS,
  createRequestedId,
  normalizeAddress,
  parseBigInt,
  shouldIgnoreAsset,
  shortenAddress,
  toMonDisplay
} from '../utils/assetHelpers';

const usePrefillFlow = ({
  counterOfferPrefill = {},
  nfts = [],
  loading = false,
  offerType,
  setOfferType,
  setRequestedAssets,
  setSelectedAssets,
  setOfferedNativeAmount,
  setOfferedLmonAmount,
  setRequestedLmonAmount
}) => {
  const {
    targetOfferId,
    sourceOffer,
    status = 'idle',
    error = null,
    refresh = () => {},
    hydratedFromState = false
  } = counterOfferPrefill || {};

  const [prefillInfo, setPrefillInfo] = useState(null);
  const [counterContext, setCounterContext] = useState({
    targetOfferId: 0,
    targetUser: ZERO_ADDRESS,
    sourceLabel: null
  });
  const [lastPrefillId, setLastPrefillId] = useState(null);
  const [prefillFlowDismissed, setPrefillFlowDismissed] = useState(!targetOfferId);
  const [pendingPrefill, setPendingPrefill] = useState(null);
  const [prefillTemplateApplied, setPrefillTemplateApplied] = useState(false);
  const [prefillInventoryMatched, setPrefillInventoryMatched] = useState(false);
  const [prefillProgressDismissed, setPrefillProgressDismissed] = useState(false);

  const templateTimerRef = useRef(null);
  const inventoryTimerRef = useRef(null);
  const completeTimerRef = useRef(null);
  const progressTimerRef = useRef(null);

  const clearTimer = useCallback((ref) => {
    if (ref.current) {
      clearTimeout(ref.current);
      ref.current = null;
    }
  }, []);

  const prefillOfferLabel = useMemo(() => {
    if (sourceOffer?.title) return sourceOffer.title;
    if (sourceOffer?.offerId) return `Offer #${sourceOffer.offerId}`;
    if (targetOfferId) return `Offer #${targetOfferId}`;
    return null;
  }, [sourceOffer, targetOfferId]);

  const visiblePrefillLabel = useMemo(() => {
    if (counterContext.sourceLabel) return counterContext.sourceLabel;
    if (prefillInfo?.requestedSummary) return prefillInfo.requestedSummary;
    return prefillOfferLabel;
  }, [counterContext.sourceLabel, prefillOfferLabel, prefillInfo]);

  useEffect(() => {
    if (status === 'loading') {
      clearTimer(templateTimerRef);
      clearTimer(inventoryTimerRef);
      clearTimer(completeTimerRef);
      clearTimer(progressTimerRef);
      setPrefillTemplateApplied(false);
      setPrefillInventoryMatched(false);
      setPrefillProgressDismissed(false);
    }

    if (status === 'loading' && targetOfferId !== lastPrefillId) {
      setPrefillInfo(null);
      setPendingPrefill(null);
    }
  }, [status, targetOfferId, lastPrefillId, clearTimer]);

  useEffect(() => {
    if (status === 'error') {
      setPrefillFlowDismissed(true);
      setPrefillProgressDismissed(false);
      clearTimer(templateTimerRef);
      clearTimer(inventoryTimerRef);
      clearTimer(completeTimerRef);
      clearTimer(progressTimerRef);
    }
  }, [status, clearTimer]);

  useEffect(() => {
    if (!targetOfferId) {
      setPrefillFlowDismissed(true);
      setPrefillTemplateApplied(false);
      setPrefillInventoryMatched(false);
      setPrefillProgressDismissed(false);
      clearTimer(templateTimerRef);
      clearTimer(inventoryTimerRef);
      clearTimer(completeTimerRef);
      clearTimer(progressTimerRef);
      return;
    }

    if (status === 'loading' || status === 'idle') {
      setPrefillFlowDismissed(false);
      setPrefillTemplateApplied(false);
      setPrefillInventoryMatched(false);
      setPrefillProgressDismissed(false);
      clearTimer(progressTimerRef);
    }
  }, [targetOfferId, status, clearTimer]);

  const prefillStage = useMemo(() => {
    if (!targetOfferId) return 'none';
    if (status === 'error') return 'error';
    if (status === 'loading' || status === 'idle') return 'fetch';
    if (!prefillTemplateApplied) return 'fetch';
    if (!prefillInventoryMatched) return 'template';
    if (!prefillProgressDismissed) return 'complete';
    if (!prefillFlowDismissed) return 'complete';
    return 'ready';
  }, [
    targetOfferId,
    status,
    prefillFlowDismissed,
    prefillTemplateApplied,
    prefillInventoryMatched,
    prefillProgressDismissed
  ]);

  useEffect(() => {
    if (!targetOfferId) return;
    if (status === 'error') return;
    if (prefillFlowDismissed) return;
    if (!prefillProgressDismissed) return;

    setPrefillFlowDismissed(true);
  }, [targetOfferId, status, prefillProgressDismissed, prefillFlowDismissed]);

  useEffect(() => {
    return () => {
      clearTimer(templateTimerRef);
      clearTimer(inventoryTimerRef);
      clearTimer(completeTimerRef);
      clearTimer(progressTimerRef);
    };
  }, [clearTimer]);

  useEffect(() => {
    if (!prefillInfo) return;
    if (prefillProgressDismissed) return;

    clearTimer(progressTimerRef);
    progressTimerRef.current = setTimeout(() => {
      setPrefillProgressDismissed(true);
      progressTimerRef.current = null;
    }, 300);

    return () => clearTimer(progressTimerRef);
  }, [prefillInfo, prefillProgressDismissed, clearTimer]);

  const prefillSteps = useMemo(
    () => [
      { key: 'fetch', title: 'Offer', subtitle: 'Loading base offer data' },
      { key: 'template', title: 'Template', subtitle: 'Copying requested items' },
      { key: 'inventory', title: 'Inventory', subtitle: 'Matching with your wallet' },
      { key: 'complete', title: 'Completed', subtitle: 'Counter-offer ready' }
    ],
    []
  );

  const prefillStepStates = useMemo(() => {
    if (!targetOfferId) return null;

    const states = {
      fetch: 'pending',
      template: 'pending',
      inventory: 'pending',
      complete: 'pending'
    };

    if (prefillStage === 'error') {
      states.fetch = 'error';
      return states;
    }

    if (prefillStage === 'fetch') {
      states.fetch = 'active';
      return states;
    }

    states.fetch = 'done';

    if (prefillStage === 'template') {
      states.template = 'active';
      return states;
    }

    states.template = 'done';

    if (prefillStage === 'inventory') {
      states.inventory = 'active';
      return states;
    }

    states.inventory = 'done';

    if (prefillStage === 'complete') {
      states.complete = 'active';
      return states;
    }

    if (prefillStage === 'ready') {
      states.complete = 'done';
    }

    return states;
  }, [targetOfferId, prefillStage]);

  const showPrefillProgress = Boolean(targetOfferId)
    && status !== 'error'
    && !prefillFlowDismissed
    && !prefillProgressDismissed;

  const showForm = !targetOfferId || status === 'error' || prefillFlowDismissed;

  const matchRequestedAssets = useCallback((requestedList = []) => {
    if (!Array.isArray(requestedList) || requestedList.length === 0) {
      return {
        complete: true,
        matchedNfts: [],
        missing: [],
        nativeAmountDisplay: '',
        nativeRequiredWei: null,
        lmonAmountDisplay: '',
        lmonRequiredWei: null
      };
    }

    const matchedNfts = [];
    const missing = [];
    let nativeAmountDisplay = '';
    let nativeRequiredWei = null;
    let lmonAmountDisplay = '';
    let lmonRequiredWei = null;

    requestedList.forEach((asset) => {
      if (shouldIgnoreAsset(asset)) {
        return;
      }
      if (!asset) return;

      if (asset.assetType === ASSET_TYPES.NATIVE) {
        nativeAmountDisplay = toMonDisplay(asset.tokenIdOrAmount || asset.amount || '0');
        nativeRequiredWei = parseBigInt(asset.tokenIdOrAmount || asset.amount);
        return;
      }

      if (asset.assetType === ASSET_TYPES.ERC20) {
        const isLmon = asset.contractAddress?.toLowerCase() === '0xecc6f8fb4962cbf02d83cee8c4d9c2c96204a17d';
        if (isLmon) {
          // LMON has 18 decimals, convert from wei to display
          const rawAmount = parseBigInt(asset.tokenIdOrAmount || asset.amount);
          if (rawAmount && rawAmount > 0n) {
            lmonAmountDisplay = (Number(rawAmount) / 1e18).toString();
            lmonRequiredWei = rawAmount;
          }
        }
        return;
      }

      if (asset.assetType === ASSET_TYPES.ERC721 && asset.isSpecific) {
        const contractAddress = normalizeAddress(asset.contractAddress || asset.collectionAddress || '');
        const tokenId = String(asset.tokenIdOrAmount ?? asset.tokenId ?? '');

        if (!contractAddress || !tokenId) {
          missing.push({
            type: 'specific',
            label: asset.metadata?.name || `Specific NFT`,
            reason: 'invalid'
          });
          return;
        }

        const matched = nfts.find((nft) =>
          normalizeAddress(nft.contractAddress) === contractAddress &&
          String(nft.tokenId) === tokenId
        );

        if (matched) {
          matchedNfts.push(matched);
        } else {
          const collectionName = asset.metadata?.collectionName || asset.metadata?.collection?.name;
          const label = collectionName
            ? `${collectionName} #${tokenId}`
            : `NFT #${tokenId} (${shortenAddress(contractAddress)})`;
          missing.push({
            type: 'specific',
            label,
            reason: 'missing-nft'
          });
        }
        return;
      }

      if (asset.assetType === ASSET_TYPES.ERC721 && !asset.isSpecific) {
        const collectionName = asset.metadata?.collectionName || asset.metadata?.name || 'Collection';
        missing.push({
          type: 'collection',
          label: `${asset.amount || 1}× ${collectionName}`,
          reason: 'collection-request'
        });
        return;
      }

      const fallback = asset.metadata?.name || 'Requested asset';
      missing.push({
        type: 'unsupported',
        label: fallback,
        reason: 'unsupported'
      });
    });

    return {
      complete: missing.length === 0,
      matchedNfts,
      missing,
      nativeAmountDisplay,
      nativeRequiredWei,
      lmonAmountDisplay,
      lmonRequiredWei
    };
  }, [nfts]);

  const buildRequestedPrefill = useCallback((offeredAssets = []) => {
    if (!Array.isArray(offeredAssets)) return [];

    return offeredAssets.reduce((acc, asset) => {
      if (shouldIgnoreAsset(asset)) {
        return acc;
      }
      if (!asset) return acc;

      if (asset.assetType === ASSET_TYPES.NATIVE) {
        const amount = toMonDisplay(asset.tokenIdOrAmount || asset.amount || '0');
        if (!amount || Number(amount) === 0) return acc;
        return [
          ...acc,
          {
            id: createRequestedId(),
            type: 'token',
            assetType: ASSET_TYPES.NATIVE,
            amount,
            source: 'prefill'
          }
        ];
      }

      if (asset.assetType === ASSET_TYPES.ERC20) {
        const isLmon = asset.contractAddress?.toLowerCase() === '0xecc6f8fb4962cbf02d83cee8c4d9c2c96204a17d';
        if (isLmon) {
          // LMON has 18 decimals, convert from wei to display
          const rawAmount = parseBigInt(asset.tokenIdOrAmount || asset.amount);
          if (rawAmount && rawAmount > 0n) {
            const amount = (Number(rawAmount) / 1e18).toString();
            return [
              ...acc,
              {
                id: createRequestedId(),
                type: 'erc20',
                assetType: ASSET_TYPES.ERC20,
                contractAddress: asset.contractAddress,
                amount,
                symbol: 'LMON',
                source: 'prefill'
              }
            ];
          }
        }
        return acc;
      }

      if (asset.assetType === ASSET_TYPES.ERC721) {
        const contractAddress = asset.contractAddress || asset.collectionAddress || ZERO_ADDRESS;
        const collectionKey = normalizeAddress(contractAddress);
        const collectionName = asset.metadata?.collectionName || asset.metadata?.collection?.name || asset.metadata?.name || 'NFT Collection';

        if (asset.isSpecific) {
          return [
            ...acc,
            {
              id: createRequestedId(),
              type: 'specific',
              collectionName,
              collectionAddress: contractAddress,
              collectionKey,
              tokenId: String(asset.tokenIdOrAmount ?? asset.tokenId ?? '0'),
              name: asset.metadata?.name || collectionName,
              image: asset.metadata?.image || asset.metadata?.imageLarge || asset.metadata?.imageSmall || null,
              source: 'prefill'
            }
          ];
        }

        return [
          ...acc,
          {
            id: createRequestedId(),
            type: 'collection',
            collectionName,
            collectionAddress: contractAddress,
            collectionKey,
            quantity: asset.amount || 1,
            source: 'prefill'
          }
        ];
      }

      return acc;
    }, []);
  }, []);

  useEffect(() => {
    if (!targetOfferId || status !== 'ready' || !sourceOffer) return;
    if (loading) return;
    if (prefillInfo && targetOfferId === lastPrefillId) return;

    const requestedFromOffer = (sourceOffer.requestedAssets || []).filter((asset) => !shouldIgnoreAsset(asset));
    const offeredFromOffer = (sourceOffer.offeredAssets || []).filter((asset) => !shouldIgnoreAsset(asset));
    const matchResult = matchRequestedAssets(requestedFromOffer);
    const requestedPrefillList = buildRequestedPrefill(offeredFromOffer);

    const payload = {
      targetId: targetOfferId,
      matchResult,
      requestedPrefillList,
      context: {
        targetOfferId: Number(targetOfferId) || 0,
        targetUser: sourceOffer.maker || sourceOffer.makerAddress || ZERO_ADDRESS,
        sourceLabel: sourceOffer.title || `Offer #${sourceOffer.offerId || targetOfferId}`
      }
    };

    clearTimer(templateTimerRef);
    clearTimer(inventoryTimerRef);
    clearTimer(completeTimerRef);
    clearTimer(progressTimerRef);

    setPrefillTemplateApplied(false);
    setPrefillInventoryMatched(false);
    setPendingPrefill(null);
    setPrefillProgressDismissed(false);

    templateTimerRef.current = setTimeout(() => {
      setPrefillTemplateApplied(true);
      setPendingPrefill(payload);
      templateTimerRef.current = null;
    }, 100);

    setOfferType('SPECIFIC');

    return () => {
      clearTimer(templateTimerRef);
    };
  }, [
    targetOfferId,
    status,
    sourceOffer,
    loading,
    matchRequestedAssets,
    buildRequestedPrefill,
    clearTimer,
    prefillInfo,
    lastPrefillId,
    setOfferType
  ]);

  useEffect(() => {
    if (!pendingPrefill) return;
    if (pendingPrefill.context?.targetOfferId !== Number(targetOfferId || 0)) {
      return;
    }
    if (!prefillTemplateApplied) return;
    if (offerType && offerType !== 'SPECIFIC') return;

    clearTimer(inventoryTimerRef);
    clearTimer(completeTimerRef);
    clearTimer(progressTimerRef);

    setPrefillInventoryMatched(false);

    const { targetId, matchResult, requestedPrefillList, context } = pendingPrefill;

    const requestedSummary = (() => {
      if (!context || !sourceOffer) return null;
      const offeredAssets = Array.isArray(sourceOffer.offeredAssets) ? sourceOffer.offeredAssets : [];
      const parts = offeredAssets
        .filter((asset) => !shouldIgnoreAsset(asset))
        .map((asset) => {
          if (asset.assetType === ASSET_TYPES.NATIVE) {
            return `${toMonDisplay(asset.tokenIdOrAmount || asset.amount || '0')} MON`;
          }
          if (asset.assetType === ASSET_TYPES.ERC20) {
            const isLmon = asset.contractAddress?.toLowerCase() === '0xecc6f8fb4962cbf02d83cee8c4d9c2c96204a17d';
            if (isLmon) {
              const rawAmount = parseBigInt(asset.tokenIdOrAmount || asset.amount);
              if (rawAmount && rawAmount > 0n) {
                const amount = (Number(rawAmount) / 1e18).toFixed(2);
                return `${amount} LMON`;
              }
            }
          }
          if (asset.assetType === ASSET_TYPES.ERC721) {
            const displayName = asset.metadata?.name || asset.metadata?.collectionName || `NFT #${asset.tokenIdOrAmount}`;
            return displayName;
          }
          return null;
        })
        .filter(Boolean);

      if (!parts.length) return null;
      return parts.join(' + ');
    })();

    const infoPayload = {
      id: targetId,
      completed: matchResult.complete,
      missing: matchResult.missing,
      hydratedFromState,
      nativeAmount: matchResult.nativeAmountDisplay || '',
      nativeRequiredWei: matchResult.nativeRequiredWei,
      lmonAmount: matchResult.lmonAmountDisplay || '',
      lmonRequiredWei: matchResult.lmonRequiredWei,
      requestedCount: requestedPrefillList.length,
      appliedAt: Date.now(),
      requestedSummary
    };

    inventoryTimerRef.current = setTimeout(() => {
      if (requestedPrefillList.length > 0) {
        setRequestedAssets(requestedPrefillList);
      }

      setSelectedAssets(matchResult.matchedNfts);
      setOfferedNativeAmount(matchResult.nativeAmountDisplay || '');
      if (setOfferedLmonAmount) {
        setOfferedLmonAmount(matchResult.lmonAmountDisplay || '');
      }
      setCounterContext(context);
      setPrefillInventoryMatched(true);

      completeTimerRef.current = setTimeout(() => {
        setPrefillInfo(infoPayload);
        setLastPrefillId(targetId);
        setPendingPrefill(null);
        completeTimerRef.current = null;
      }, 100);

      inventoryTimerRef.current = null;
    }, 100);

    return () => {
      clearTimer(inventoryTimerRef);
      clearTimer(completeTimerRef);
    };
  }, [
    pendingPrefill,
    targetOfferId,
    prefillTemplateApplied,
    hydratedFromState,
    setRequestedAssets,
    sourceOffer,
    clearTimer,
    setSelectedAssets,
    setOfferedNativeAmount,
    setOfferedLmonAmount,
    offerType
  ]);

  return {
    prefillStatus: status,
    prefillTargetId: targetOfferId,
    prefillError: error,
    refreshPrefill: refresh,
    showPrefillProgress,
    showForm,
    prefillSteps,
    prefillStepStates,
    visiblePrefillLabel,
    counterContext
  };
};

export default usePrefillFlow;
