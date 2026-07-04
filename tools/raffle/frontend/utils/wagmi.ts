import { configureChains, createConfig } from 'wagmi'
import { publicProvider } from 'wagmi/providers/public'
import { getRpcUrl, getChainId, getBlockchainConfig } from './deployments'

// Get configuration from local config
const rpcUrl = getRpcUrl()
const chainId = getChainId()
const blockchainConfig = getBlockchainConfig()

// Define Monad Testnet
export const monadTestnet = {
  id: chainId,
  name: blockchainConfig.name,
  network: 'monad-testnet',
  nativeCurrency: {
    decimals: blockchainConfig.decimals,
    name: blockchainConfig.symbol,
    symbol: blockchainConfig.symbol,
  },
  rpcUrls: {
    public: { http: [rpcUrl] },
    default: { http: [rpcUrl] },
  },
  blockExplorers: {
    default: { 
      name: blockchainConfig.explorer.name, 
      url: blockchainConfig.explorer.url 
    },
  },
  testnet: true,
} as const

const { chains, publicClient, webSocketPublicClient } = configureChains(
  [monadTestnet],
  [publicProvider()]
)

// Simple wagmi config for Privy integration
// Privy handles all wallet connections internally, so we don't need additional connectors
export const wagmiConfig = createConfig({
  autoConnect: false, // Let Privy handle connection
  connectors: [], // Empty - Privy provides its own connectors
  publicClient,
  webSocketPublicClient,
})

export { chains, publicClient, webSocketPublicClient }