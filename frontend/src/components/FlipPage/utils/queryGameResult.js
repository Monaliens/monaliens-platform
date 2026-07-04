import { decodeEventLog } from 'viem';
import { COIN_FLIP_CONTRACT_ADDRESS, COIN_FLIP_ABI } from './constants';

/**
 * Query game result from transaction hash
 * @param {string} txHash - Transaction hash
 * @returns {Promise<Object>} Game result object
 */
export async function queryGameResultByTxHash(txHash) {
  try {
    // Get public client (you might need to pass this as parameter)
    // For now, we'll use a workaround - this should be called from a component with access to publicClient
    const { createPublicClient, http } = await import('viem');
    const { monadMainnet } = await import('../../config/reownConfig');
    
    const client = createPublicClient({
      chain: monadMainnet,
      transport: http('https://rpc.monad.xyz')
    });
    
    // Get transaction receipt
    const receipt = await client.getTransactionReceipt({ hash: txHash });
    
    // Find CoinflipStarted event to get sequence number
    let sequenceNumber = null;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: COIN_FLIP_ABI,
          data: log.data,
          topics: log.topics
        });
        
        if (decoded.eventName === 'CoinflipStarted') {
          sequenceNumber = decoded.args.sequenceNumber;
          break;
        }
      } catch (e) {
        // Not our event, continue
      }
    }
    
    if (!sequenceNumber) {
      throw new Error('CoinflipStarted event not found in transaction');
    }
    
    // Query getGame function
    const gameResult = await client.readContract({
      address: COIN_FLIP_CONTRACT_ADDRESS,
      abi: COIN_FLIP_ABI,
      functionName: 'getGame',
      args: [sequenceNumber]
    });
    
    return {
      sequenceNumber: sequenceNumber.toString(),
      gameResult: {
        player: gameResult.player,
        choice: gameResult.choice, // true = heads, false = tails
        amount: gameResult.amount.toString(),
        isNative: gameResult.isNative,
        result: gameResult.result, // true = heads, false = tails
        winner: gameResult.winner,
        randomNumber: gameResult.randomNumber,
        completed: gameResult.completed,
        timestamp: gameResult.timestamp?.toString()
      },
      txHash
    };
  } catch (error) {
    throw error;
  }
}

