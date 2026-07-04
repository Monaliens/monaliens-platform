import { CONTRACT_ADDRESSES } from '../../../utils/constants';

// Duration presets in hours
export const DURATION_PRESETS = [
  { value: 6, label: '6', unit: 'Hours' },
  { value: 12, label: '12', unit: 'Hours' },
  { value: 24, label: '1', unit: 'Day' },
  { value: 48, label: '2', unit: 'Days' },
  { value: 168, label: '1', unit: 'Week' },
  { value: 336, label: '2', unit: 'Weeks' }
];

// Asset display configuration
export const ASSET_DISPLAY_CONFIG = {
  maxGridHeight: 300, // pixels
  imageSize: {
    width: '100%',
    height: 120 // pixels
  },
  emptyState: {
    iconSize: 48,
    messages: {
      noTokens: "You don't have any tokens to raffle at the moment.",
      noNFTs: "You don't have any NFTs to raffle at the moment."
    }
  }
};

// API configuration for asset fetching
export const API_CONFIG = {
  baseUrl: 'https://api.monaliens.xyz',
  rpc: {
    url: 'https://testnet-rpc.monad.xyz'
  },
  endpoints: {
    tokens: (address) => `/api/tokens/${address}`, // Separate endpoint for token balances
    nfts: (address) => `/api/magic-eden/monad-testnet/users/${address}/tokens`
  },
  timeout: 30000, // 30 seconds
  retryAttempts: 2
};

// Fallback token list when API fails
export const FALLBACK_TOKENS = [
  {
    address: 'native',
    symbol: 'MON',
    name: 'Monad',
    decimals: 18,
    balance: '0.0',
    isNative: true
  },
  {
    address: CONTRACT_ADDRESSES.MON_TOKEN,
    symbol: 'MON',
    name: 'Monad Token',
    decimals: 18,
    balance: '0.0',
    isNative: false
  }
];

// Asset validation configuration
export const ASSET_VALIDATION = {
  token: {
    requiredFields: ['address', 'symbol', 'decimals', 'balance'],
    optionalFields: ['name', 'logo', 'isNative']
  },
  nft: {
    requiredFields: ['tokenId', 'contractAddress'],
    optionalFields: ['name', 'image', 'collection', 'metadata']
  }
};

// Asset processing utilities
export const ASSET_PROCESSORS = {
  // Process token data from API response
  processTokens: (tokens) => {
    if (!Array.isArray(tokens)) return [];
    
    return tokens.map(token => ({
      address: token.contractAddress,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      balance: token.balanceFormatted,
      logo: token.logo,
      isNative: token.isNative || false
    })).filter(token => {
      // Validate required fields
      return ASSET_VALIDATION.token.requiredFields.every(field => 
        token[field] !== undefined && token[field] !== null
      );
    });
  },

  // Process NFT data from API response
  processNFTs: (nfts) => {
    if (!Array.isArray(nfts)) return [];
    
    return nfts.map(nft => ({
      tokenId: nft.tokenId,
      contractAddress: nft.contractAddress,
      name: nft.name || `#${nft.tokenId}`,
      image: nft.image || nft.metadata?.image,
      collection: nft.collection || { name: 'Unknown Collection' },
      metadata: nft.metadata
    })).filter(nft => {
      // Validate required fields
      return ASSET_VALIDATION.nft.requiredFields.every(field => 
        nft[field] !== undefined && nft[field] !== null
      );
    });
  }
};

// Asset type configurations
export const ASSET_TYPES = {
  TOKEN: {
    id: 'token',
    label: 'Tokens',
    icon: 'T',
    description: 'ERC-20 tokens and native currency',
    apiEndpoint: 'tokens',
    processor: ASSET_PROCESSORS.processTokens,
    fallback: FALLBACK_TOKENS,
    displayFields: {
      primary: (asset) => asset.name || asset.symbol,
      secondary: (asset) => `Balance: ${asset.balance} ${asset.symbol}`,
      image: (asset) => asset.logo
    }
  },
  NFT: {
    id: 'nft',
    label: 'NFTs',
    icon: 'N',
    description: 'ERC-721 and ERC-1155 tokens',
    apiEndpoint: 'nfts',
    processor: ASSET_PROCESSORS.processNFTs,
    fallback: [],
    displayFields: {
      primary: (asset) => asset.name || `#${asset.tokenId}`,
      secondary: (asset) => asset.collection?.name || 'Unknown Collection',
      image: (asset) => asset.image
    }
  }
};

// Loading states configuration
export const LOADING_CONFIG = {
  assets: {
    showSpinner: true,
    message: 'Loading your assets...',
    timeout: 30000
  },
  submission: {
    showSpinner: true,
    message: 'Creating raffle...',
    steps: [
      'Validating form data...',
      'Preparing transaction...',
      'Waiting for confirmation...',
      'Finalizing raffle...'
    ]
  }
};

// Error handling configuration
export const ERROR_CONFIG = {
  asset: {
    fetch: 'Failed to load your assets. Please try again.',
    validation: 'Invalid asset data received.',
    timeout: 'Request timed out. Please check your connection.',
    network: 'Network error. Please try again.'
  },
  submission: {
    validation: 'Please fix the form errors before submitting.',
    transaction: 'Transaction failed. Please try again.',
    network: 'Network error during submission. Please try again.',
    unknown: 'An unexpected error occurred. Please try again.'
  }
}; 