// Solana Mainnet-Beta configuration
export const SOLANA_NETWORK = 'mainnet-beta';
export const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';

// Solana endpoint configuration
export const solanaEndpoint = SOLANA_RPC_URL;

// Return empty array to use Wallet Standard auto-detection
// Modern wallets (Phantom, Solflare, etc.) register themselves via Wallet Standard
export const getSolanaWallets = () => [];

// Solana Explorer URL
export const getSolanaExplorerUrl = (address) =>
  `https://solscan.io/account/${address}`;

// Helper to detect if an address is Solana (base58, not starting with 0x)
export const isSolanaAddress = (address) => {
  if (!address) return false;
  // EVM addresses start with 0x and are 42 characters
  if (address.startsWith('0x')) return false;
  // Solana addresses are base58 encoded, typically 32-44 characters
  return address.length >= 32 && address.length <= 44;
};

// Helper to detect if an address is EVM
export const isEVMAddress = (address) => {
  if (!address) return false;
  return address.startsWith('0x') && address.length === 42;
};

// Get wallet type from address
export const getWalletType = (address) => {
  if (isSolanaAddress(address)) return 'solana';
  if (isEVMAddress(address)) return 'evm';
  return 'unknown';
};
