import { useCallback, useMemo, useState } from 'react';

const PRIORITY_COLLECTION_ID = '0xae280ca8dfaaf852b0af828cd72391ce7874fbb6';

// Blacklisted collections (test collections, etc.)
const BLACKLISTED_COLLECTIONS = [
  '0x195c46193ed98935ddf00f7d93147ab1835672f1', // testt
  '0x1bc92fcde64c92d47d4a5acb9634b28872b38946'  // Poply x ExoSpirits
];

const normalizeAddress = (value) => (value || '').toLowerCase();

const isValidAddress = (str) => {
  // Check if string looks like an Ethereum address (0x followed by 40 hex chars)
  return /^0x[a-fA-F0-9]{40}$/.test(str);
};

const getCollectionIdForApi = (collection) => {
  if (!collection) return '';
  return collection.id || collection.contractAddress || collection.address || '';
};

const getCollectionAddress = (collection) => {
  if (!collection) return '';
  // API returns primaryContract as the contract address
  return collection.contractAddress || collection.primaryContract || collection.address || collection.id || '';
};

const getCollectionName = (collection) => collection?.name || '';

const getTokenId = (nft) => {
  if (!nft) return '';
  const raw = nft.tokenId ?? nft.token_id ?? nft.id ?? '';
  return String(raw).trim();
};

const createRequestedId = () => `requested-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const useRequestedAssets = (apiBaseUrl) => {
  const [requestedAssets, setRequestedAssets] = useState([]);
  const [collections, setCollections] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionsError, setCollectionsError] = useState('');
  const [collectionSearch, setCollectionSearch] = useState('');
  const [isCollectionPickerOpen, setCollectionPickerOpen] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState('');
  const [quantityRequest, setQuantityRequest] = useState('1');
  const [manualForm, setManualForm] = useState({ tokenId: '', tokenAddress: '' });
  const [tokenRequestForm, setTokenRequestForm] = useState({ nativeAmount: '' });
  const [feedback, setFeedback] = useState('');

  const clearFeedback = useCallback(() => {
    setFeedback('');
  }, []);

  const loadCollections = useCallback(async () => {
    setCollectionsLoading(true);
    setCollectionsError('');

    try {
      // Use verified collections endpoint (same as Bleep, Snapshot, Airdrop)
      const response = await fetch(`${apiBaseUrl}/api/nft/verified-collections`);
      if (!response.ok) {
        throw new Error(`Failed to fetch collections: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data?.collections) {
        // Filter collections with images only
        let nextCollections = result.data.collections.filter(
          (collection) => collection.image && collection.image.trim() !== ''
        );

        // Filter out blacklisted collections
        nextCollections = nextCollections.filter((collection) => {
          const address = normalizeAddress(collection.address || collection.id);
          return !BLACKLISTED_COLLECTIONS.some(
            (blacklisted) => normalizeAddress(blacklisted) === address
          );
        });

        // Filter out collections with "Poply" in their name
        nextCollections = nextCollections.filter((collection) => {
          const collectionName = (collection.name || '').toLowerCase();
          return !collectionName.includes('poply');
        });

        // Transform to ensure consistent format with id field
        nextCollections = nextCollections.map(col => ({
          id: col.address || col.id,
          address: col.address || col.id,
          primaryContract: col.address || col.id,
          name: col.name,
          symbol: col.symbol || '',
          image: col.image,
          items: col.items,
          totalVolume: col.totalVolume,
          floorPrice: col.floorPrice
        }));

        // Move priority collection (Lil Monaliens) to the top
        const priorityIndex = nextCollections.findIndex(
          (collection) => collection.id === PRIORITY_COLLECTION_ID || collection.address === PRIORITY_COLLECTION_ID
        );

        if (priorityIndex > 0) {
          const [priorityCollection] = nextCollections.splice(priorityIndex, 1);
          nextCollections.unshift(priorityCollection);
        }

        setCollections(nextCollections);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
      setCollectionsError(error.message || 'Failed to load collections');
      setCollections([]);
    } finally {
      setCollectionsLoading(false);
    }
  }, [apiBaseUrl]);

  const loadCollectionByAddress = useCallback(async (contractAddress) => {
    if (!contractAddress || !isValidAddress(contractAddress)) {
      return null;
    }

    // Check if address is blacklisted
    const normalizedAddress = normalizeAddress(contractAddress);
    if (BLACKLISTED_COLLECTIONS.some((blacklisted) => normalizeAddress(blacklisted) === normalizedAddress)) {
      console.log('Collection address is blacklisted:', contractAddress);
      return null;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/collections/${contractAddress}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch collection: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        const collectionData = result.data;

        // Return a standardized collection object
        return {
          id: collectionData.address || contractAddress,
          contractAddress: collectionData.address || contractAddress,
          primaryContract: collectionData.address || contractAddress,
          address: collectionData.address || contractAddress,
          name: collectionData.name || `Collection ${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}`,
          symbol: collectionData.symbol || '',
          image: collectionData.image || '',
          description: collectionData.description || '',
          tokenCount: collectionData.tokenCount || '0'
        };
      }

      throw new Error('Invalid response format');
    } catch (error) {
      console.error('Error fetching collection by address:', error);
      // Return a minimal collection object with the address
      return {
        id: contractAddress,
        contractAddress: contractAddress,
        primaryContract: contractAddress,
        address: contractAddress,
        name: `${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}`,
        symbol: '',
        image: '',
        description: ''
      };
    }
  }, [apiBaseUrl]);

  const loadListings = useCallback(async (collectionId) => {
    if (!collectionId) {
      return;
    }

    setListingsLoading(true);
    setListingsError('');
    setListings([]);

    try {
      // Use collections/items endpoint (same as Bleep)
      const response = await fetch(`${apiBaseUrl}/api/collections/items/${collectionId}?limit=100`);
      if (!response.ok) {
        throw new Error(`Failed to fetch NFTs: ${response.status}`);
      }

      const result = await response.json();

      // API returns data.items, not data.tokens
      let tokens = result.data?.items || result.items || result.data?.tokens || result.tokens || [];

      if (Array.isArray(tokens)) {
        // Filter out tokens without images
        tokens = tokens.filter((token) => token.image && token.image.trim() !== '');
      } else {
        tokens = [];
      }

      setListings(tokens);
    } catch (error) {
      console.error('Error fetching NFTs:', error);
      setListingsError(error.message || 'Failed to load NFTs');
      setListings([]);
    } finally {
      setListingsLoading(false);
    }
  }, [apiBaseUrl]);

  const ensureCollections = useCallback(() => {
    if (collectionsLoading) return;
    if (collections.length > 0) return;
    loadCollections();
  }, [collections.length, collectionsLoading, loadCollections]);

  const handleCollectionSelect = useCallback((collection) => {
    setSelectedCollection(collection);
    setCollectionPickerOpen(false);
    setListings([]);
    setListingsError('');
    setQuantityRequest('1');
    setManualForm({ tokenId: '', tokenAddress: '' });
    clearFeedback();

    const collectionId = getCollectionIdForApi(collection);
    loadListings(collectionId);
  }, [clearFeedback, loadListings]);

  const handleCollectionSearchChange = useCallback(async (value) => {
    setCollectionSearch(value);

    // Check if the value is a valid contract address
    const trimmedValue = value.trim();
    if (isValidAddress(trimmedValue)) {
      // Try to load collection by address
      setCollectionsLoading(true);
      const collection = await loadCollectionByAddress(trimmedValue);
      setCollectionsLoading(false);

      if (collection) {
        // Add to collections list if not already there
        setCollections((prevCollections) => {
          const exists = prevCollections.some(
            (c) => normalizeAddress(c.contractAddress || c.id) === normalizeAddress(trimmedValue)
          );

          if (!exists) {
            return [collection, ...prevCollections];
          }
          return prevCollections;
        });

        // Auto-select the collection
        handleCollectionSelect(collection);
      }
    }
  }, [loadCollectionByAddress, handleCollectionSelect]);

  const reopenCollectionPicker = useCallback(() => {
    setCollectionPickerOpen(true);
    setSelectedCollection(null);
    setListings([]);
    setListingsError('');
    setQuantityRequest('1');
    setManualForm({ tokenId: '', tokenAddress: '' });
    clearFeedback();
  }, [clearFeedback]);

  const handleQuantityInputChange = useCallback((value) => {
    if (value === '' || /^\d+$/.test(value)) {
      setQuantityRequest(value);
      clearFeedback();
    }
  }, [clearFeedback]);

  const addQuantityRequest = useCallback(() => {
    if (!selectedCollection) {
      setFeedback('Select a collection first.');
      return;
    }

    const quantityNumber = Number(quantityRequest);
    if (!Number.isInteger(quantityNumber) || quantityNumber <= 0) {
      setFeedback('Quantity must be a positive integer.');
      return;
    }

    const collectionAddress = getCollectionAddress(selectedCollection);
    const collectionKey = normalizeAddress(collectionAddress || getCollectionIdForApi(selectedCollection));
    const collectionName = getCollectionName(selectedCollection);

    setRequestedAssets((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.type === 'collection' && item.collectionKey === collectionKey
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: quantityNumber
        };
        return updated;
      }

      return [
        ...prev,
        {
          id: createRequestedId(),
          type: 'collection',
          collectionName,
          collectionAddress,
          collectionKey,
          quantity: quantityNumber
        }
      ];
    });

    setQuantityRequest('1');
    clearFeedback();
  }, [selectedCollection, quantityRequest, clearFeedback]);

  const handleManualFieldChange = useCallback((field, value) => {
    setManualForm((prev) => ({
      ...prev,
      [field]: value
    }));
    clearFeedback();
  }, [clearFeedback]);

  const handleTokenRequestChange = useCallback((value) => {
    setTokenRequestForm({ nativeAmount: value });
    clearFeedback();
  }, [clearFeedback]);

  const addManualRequest = useCallback(() => {
    if (!selectedCollection) {
      setFeedback('Select a collection first.');
      return;
    }

    const tokenId = manualForm.tokenId.trim();
    if (!tokenId) {
      setFeedback('Token ID is required.');
      return;
    }

    const tokenAddress = manualForm.tokenAddress.trim();
    const collectionAddress = getCollectionAddress(selectedCollection);
    const collectionKey = normalizeAddress(collectionAddress || getCollectionIdForApi(selectedCollection));
    const collectionName = getCollectionName(selectedCollection);

    const duplicate = requestedAssets.some(
      (item) =>
        item.type === 'specific' &&
        item.collectionKey === collectionKey &&
        item.tokenId === tokenId
    );

    if (duplicate) {
      setFeedback('This NFT is already in your request list.');
      return;
    }

    setRequestedAssets((prev) => ([
      ...prev,
      {
        id: createRequestedId(),
        type: 'specific',
        collectionName,
        collectionAddress,
        collectionKey,
        tokenId,
        tokenAddress: tokenAddress || null,
        name: `Token #${tokenId}`,
        image: null,
        source: 'manual'
      }
    ]));

    setManualForm({ tokenId: '', tokenAddress: '' });
    clearFeedback();
  }, [manualForm, selectedCollection, requestedAssets, clearFeedback]);

  // Add requested native token (MON)
  const addRequestedNative = useCallback((amountStr) => {
    const raw = (amountStr || '').trim();
    const num = Number(raw);

    setRequestedAssets((prev) => {
      // Remove any existing native token entries; we keep at most one
      const others = prev.filter(
        (item) => !(item.type === 'token' && item.assetType === 0)
      );

      // If empty or non-positive, treat as removal
      if (!raw || !Number.isFinite(num) || num <= 0) {
        return others;
      }

      // Save/update as a single entry
      return [
        ...others,
        {
          id: 'requested-native-mon',
          type: 'token',
          assetType: 0, // ASSET_TYPES.NATIVE
          contractAddress: null,
          amount: raw
        }
      ];
    });

    // Keep the form value in sync with the saved amount (or clear if removed)
    setTokenRequestForm({ nativeAmount: raw && Number.isFinite(num) && num > 0 ? raw : '' });
    clearFeedback();
  }, [clearFeedback]);

  // (ERC20 removed; MON-only support)

  const toggleRequestedNFT = useCallback((nft) => {
    if (!selectedCollection) {
      return;
    }

    const tokenId = getTokenId(nft);
    if (!tokenId) {
      setFeedback('Unable to add this NFT. Missing token ID.');
      return;
    }

    const collectionAddress = getCollectionAddress(selectedCollection);
    const collectionKey = normalizeAddress(collectionAddress || getCollectionIdForApi(selectedCollection));
    const collectionName = getCollectionName(selectedCollection);
    const displayName = nft.name || `Token #${tokenId}`;
    const image = nft.image || null;

    setRequestedAssets((prev) => {
      const existing = prev.find(
        (item) =>
          item.type === 'specific' &&
          item.collectionKey === collectionKey &&
          item.tokenId === tokenId
      );

      if (existing) {
        return prev.filter((item) => item.id !== existing.id);
      }

      return [
        ...prev,
        {
          id: createRequestedId(),
          type: 'specific',
          collectionName,
          collectionAddress,
          collectionKey,
          tokenId,
          name: displayName,
          image,
          source: 'listing'
        }
      ];
    });

    clearFeedback();
  }, [selectedCollection, clearFeedback]);

  const removeRequestedAsset = useCallback((id) => {
    setRequestedAssets((prev) => prev.filter((item) => item.id !== id));
    clearFeedback();
  }, [clearFeedback]);

  const isNFTAlreadyRequested = useCallback((nft) => {
    const tokenId = getTokenId(nft);
    if (!selectedCollection || !tokenId) {
      return false;
    }

    const collectionKey = normalizeAddress(
      getCollectionAddress(selectedCollection) || getCollectionIdForApi(selectedCollection)
    );

    return requestedAssets.some(
      (item) =>
        item.type === 'specific' &&
        item.collectionKey === collectionKey &&
        item.tokenId === tokenId
    );
  }, [requestedAssets, selectedCollection]);

  const filteredCollections = useMemo(() => {
    if (!collectionSearch.trim()) {
      return collections;
    }

    const query = collectionSearch.trim().toLowerCase();

    // If it's a valid address, only show exact match
    if (isValidAddress(query)) {
      return collections.filter((collection) => {
        const collectionAddr = normalizeAddress(
          collection.contractAddress || collection.primaryContract || collection.address || collection.id
        );
        return collectionAddr === query;
      });
    }

    // Otherwise, search by name/symbol
    return collections.filter((collection) => {
      const nameMatch = collection.name?.toLowerCase().includes(query);
      const symbolMatch = collection.symbol?.toLowerCase().includes(query);
      return nameMatch || symbolMatch;
    });
  }, [collectionSearch, collections]);

  const reset = useCallback(() => {
    setRequestedAssets([]);
    setCollections([]);
    setCollectionsError('');
    setCollectionSearch('');
    setCollectionPickerOpen(true);
    setSelectedCollection(null);
    setListings([]);
    setListingsError('');
    setQuantityRequest('1');
    setManualForm({ tokenId: '', tokenAddress: '' });
    setFeedback('');
  }, []);

  return {
    requestedAssets,
    setRequestedAssets,
    requestError: feedback,
    collections: filteredCollections,
    collectionsLoading,
    collectionsError,
    collectionSearch,
    setCollectionSearch: handleCollectionSearchChange,
    ensureCollections,
    isCollectionPickerOpen,
    openCollectionPicker: reopenCollectionPicker,
    selectCollection: handleCollectionSelect,
    selectedCollection,
    listings,
    listingsLoading,
    listingsError,
    toggleRequestedNFT,
    isNFTAlreadyRequested,
    quantityRequest,
    handleQuantityInputChange,
    addQuantityRequest,
    manualForm,
    handleManualFieldChange,
    addManualRequest,
    tokenRequestForm,
    handleTokenRequestChange,
    addRequestedNative,
    removeRequestedAsset,
    reset,
    loadCollections,
    loadListings,
    loadCollectionByAddress
  };
};

export default useRequestedAssets;
