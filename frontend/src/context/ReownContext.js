import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, cookieToInitialState } from 'wagmi'
import { createAppKit } from '@reown/appkit/react'
import { config, networks, projectId, wagmiAdapter } from '../config/reownConfig'
import { monadMainnet } from '../config/reownConfig'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds - data stays fresh
      gcTime: 5 * 60 * 1000, // 5 minutes - cache time
      refetchInterval: false, // Disable auto polling
      refetchOnWindowFocus: false, // Don't refetch on tab focus
      retry: 1, // Only 1 retry on failure
    },
  },
})

// Determine the correct URL based on environment
const getAppUrl = () => {
  // Use actual hostname if available (handles www, non-www, etc.)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    return `${protocol}//${hostname}`;
  }

  // Fallback for SSR/build time
  if (process.env.NODE_ENV === 'development') {
    return process.env.DEV_FRONTEND_URL || 'https://dev.your-domain';
  }

  // Check if this is staging environment
  const isStaging = process.env.REACT_APP_ENV === 'staging';

  if (isStaging) {
    return process.env.STAGING_URL || 'https://staging.your-domain';
  }

  return process.env.FRONTEND_URL || 'https://your-domain';
};

const appUrl = getAppUrl();

const metadata = {
  name: 'Monaliens',
  description: 'Monad blockchain NFT collection and spin wheel game',
  url: appUrl,
  icons: [`${appUrl}/monaliens.jpg`],
}

// Initialize AppKit - only initialize if projectId exists
if (projectId) {
  createAppKit({
    adapters: [wagmiAdapter],
    projectId: projectId,
    networks: networks,
    defaultNetwork: monadMainnet,
    metadata,
    features: { analytics: true },
    chainImages: {
      143: '/unicorn/monad-logo.png', // Monad Mainnet chain ID
    },
    themeVariables: {
      "--w3m-accent": "#8b5cf6",
      "--w3m-font-family": "Lexend",
      "--wui-color-fg-100": "#ffffff",
      "--wui-color-fg-200": "#ffffff",
      "--wui-color-fg-150": "#ffffff",
    },
  })
} else {
  console.error("AppKit Initialization Error: Project ID is missing.")
}

export default function ReownContextProvider({ children, cookies = null }) {
  // Calculate initial state for Wagmi SSR hydration (not needed for CRA, but keeping for compatibility)
  const initialState = cookies ? cookieToInitialState(config, cookies) : undefined

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}