import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

// Load .env if not already loaded
dotenv.config();

const COINFLIP_ABI = [
  'event CoinflipStarted(address indexed player, uint64 indexed sequenceNumber, bool choice, uint256 amount, bool isNative)',
  'event CoinflipResult(uint64 indexed sequenceNumber, address indexed player, bool choice, bool result, bool winner, bytes32 randomNumber)',
  'event Withdrawal(address indexed admin, uint256 amount, bool isNative)',
  'function getGame(uint64 sequenceNumber) external view returns (address player, bool choice, uint256 amount, bool isNative, bool completed)',
  'function contractBalance() external view returns (uint256)',
  'function getStatistics() external view returns (uint256 gamesPlayed, uint256 wins, uint256 losses, uint256 payoutNative, uint256 payoutLMON, uint256 volumeNative, uint256 volumeLMON)',
];

export function getContract() {
  const wsRpcUrl = process.env.WS_RPC_URL;
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!wsRpcUrl) {
    throw new Error('WS_RPC_URL environment variable is not set');
  }

  if (!contractAddress) {
    throw new Error('CONTRACT_ADDRESS environment variable is not set');
  }

  // Use WebSocketProvider for event listening (real-time, no polling)
  const provider = new ethers.WebSocketProvider(wsRpcUrl);
  console.log(' Using WebSocketProvider (real-time events)');
  console.log(` Connected to: ${wsRpcUrl}`);

  const contract = new ethers.Contract(contractAddress, COINFLIP_ABI, provider);

  return { provider, contract };
}

/**
 * Get HTTP provider for API calls
 */
export function getHttpProvider() {
  const httpRpcUrl = process.env.HTTP_RPC_URL;

  if (!httpRpcUrl) {
    throw new Error('HTTP_RPC_URL environment variable is not set');
  }

  console.log(` Using HTTP RPC: ${httpRpcUrl}`);
  return new ethers.JsonRpcProvider(httpRpcUrl);
}

