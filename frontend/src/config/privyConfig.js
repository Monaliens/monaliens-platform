import { defineChain } from 'viem';

// Hardhat Local Network for testing
export const hardhatLocal = defineChain({
  id: 31337,
  name: 'Hardhat Local',
  network: 'hardhat',
  nativeCurrency: {
    decimals: 18,
    name: 'ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
    },
    public: {
      http: ['http://127.0.0.1:8545'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Local Explorer',
      url: 'http://localhost:8545',
    },
  },
  testnet: true,
});

// Monad definition - no longer used
export const monad = defineChain({
  id: 143, // Monad ChainID
  name: 'Monad',
  network: 'monad',
  nativeCurrency: {
    decimals: 18,
    name: 'MON',
    symbol: 'MON',
  },
  rpcUrls: {
    default: {
      http: [
        'https://rpc.monad.xyz',
        'https://rpc1.monad.xyz',
        'https://rpc2.monad.xyz',
        'https://rpc3.monad.xyz',
      ],
    },
    public: {
      http: [
        'https://rpc.monad.xyz',
        'https://rpc1.monad.xyz',
        'https://rpc2.monad.xyz',
        'https://rpc3.monad.xyz',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://monadexplorer.com',
    },
  },
  testnet: false,
});

// FIXED: Static URL constants to prevent re-renders - no dynamic window checks
const BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000'
  : 'https://monaliens-fe.vercel.app';

const LOGO_URL = `${BASE_URL}/monaliens.jpg`;

// Static embedded wallets config - frozen to prevent mutations
const EMBEDDED_WALLETS_CONFIG = Object.freeze({
  createOnLogin: 'users-without-wallets',
  noPromptOnSignature: true
});

// Static appearance config - frozen to prevent mutations
const APPEARANCE_CONFIG = Object.freeze({
  theme: 'white',
  accentColor: '#6930c3',
  logo: LOGO_URL
});

// Static wallet connect config - frozen to prevent mutations
const WALLET_CONNECT_CONFIG = Object.freeze({
  projectId: 'b7a018b93719d138f242edb8ee59348a',
  metadata: Object.freeze({
    name: 'Monaliens',
    description: 'Monad blockchain NFT collection and spin wheel game',
    url: BASE_URL,
    icons: Object.freeze([LOGO_URL])
  })
});

// Static notifications config - frozen to prevent mutations
const NOTIFICATIONS_CONFIG = Object.freeze({
  transactionCompletedEnabled: true
});

// Completely static Privy configuration - no dynamic values
const privyConfig = Object.freeze({
  appId: "cmao1xdj70078lb0ljkawrvml", // Test App ID - change for real application
  config: Object.freeze({
    // For users without a wallet, create an embedded wallet
    embeddedWallets: EMBEDDED_WALLETS_CONFIG,
    loginMethods: Object.freeze(['wallet']),
    appearance: APPEARANCE_CONFIG,
    // Set Hardhat Local as default for testing, Monad for production
    defaultChain: hardhatLocal,
    supportedChains: Object.freeze([hardhatLocal, monad]),
    // Allow network switching
    switchChain: 'encouraged',
    // Enable JavaScript wallet providers and set required settings
    walletConnect: WALLET_CONNECT_CONFIG,
    // Reduce errors between browser and network
    notifications: NOTIFICATIONS_CONFIG
  })
});

export default privyConfig; 