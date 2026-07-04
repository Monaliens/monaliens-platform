import type { AppProps } from 'next/app'
import { PrivyProvider } from '@privy-io/react-auth'
import { PrivyWagmiConnector } from '@privy-io/wagmi-connector'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { wagmiConfig, chains, publicClient, webSocketPublicClient } from '@/utils/wagmi'
import { RaffleProvider } from '@/context/RaffleContext'
import Layout from '@/components/Layout'
import NetworkGuard from '@/components/NetworkGuard'
import '@/styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <PrivyProvider
      appId="cmao1xdj70078lb0ljkawrvml"
      config={{
        loginMethods: ['wallet', 'email', 'google'],
        appearance: {
          theme: 'dark',
          accentColor: '#0ea5e9',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <PrivyWagmiConnector wagmiChainsConfig={{ chains, publicClient, webSocketPublicClient }}>
          <RaffleProvider>
            <NetworkGuard>
              <Layout>
                <Component {...pageProps} />
              </Layout>
            </NetworkGuard>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#1f2937',
                  color: '#f9fafb',
                  border: '1px solid #374151',
                },
                success: {
                  iconTheme: {
                    primary: '#10b981',
                    secondary: '#f9fafb',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#f9fafb',
                  },
                },
              }}
            />
          </RaffleProvider>
        </PrivyWagmiConnector>
      </QueryClientProvider>
    </PrivyProvider>
  )
}