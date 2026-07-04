import { useEffect, useRef, useState } from 'react';
import { useWatchContractEvent, usePublicClient } from 'wagmi';
import { COIN_FLIP_CONTRACT_ADDRESS, COIN_FLIP_ABI } from '../utils/constants';
import { decodeEventLog } from 'viem';
import { getUserFlips } from '../utils/flipApi';
import { useGameWallet } from '../../../context';

/**
 * Hook to listen for CoinflipResult events and automatically show results
 * @param {string} address - User wallet address
 * @param {Function} onResult - Callback when result is received
 * @param {number|string} sequenceNumber - Sequence number to listen for
 */
export const useFlipResult = (address, onResult, sequenceNumber = null) => {
  const publicClient = usePublicClient();
  const { isUsingGameWallet, address: gameWalletAddress } = useGameWallet();

  // Use game wallet address when in game mode, otherwise main wallet
  const activeAddress = isUsingGameWallet && gameWalletAddress ? gameWalletAddress : address;
  const [pendingSequence, setPendingSequence] = useState(sequenceNumber);
  const timeoutRef = useRef(null);

  // Update pending sequence when prop changes
  useEffect(() => {
    if (sequenceNumber) {
      setPendingSequence(sequenceNumber);
    }
  }, [sequenceNumber]);

  // Watch for CoinflipResult events using useWatchContractEvent
  useWatchContractEvent({
    address: COIN_FLIP_CONTRACT_ADDRESS,
    abi: COIN_FLIP_ABI,
    eventName: 'CoinflipResult',
    enabled: !!pendingSequence && !!activeAddress, // Only enable when waiting for result
    onLogs: (logs) => {
      if (!pendingSequence) {
        return;
      }

      logs.forEach((log, index) => {
        try {
          const eventSequenceNumber = log.args.sequenceNumber;
          const eventPlayer = log.args.player;

          // Check if this is our event
          if (pendingSequence && eventSequenceNumber &&
              eventSequenceNumber.toString() === pendingSequence.toString()) {

            // Verify it's our address (game wallet or main wallet)
            if (eventPlayer?.toLowerCase() === activeAddress?.toLowerCase()) {
              const result = {
                sequenceNumber: eventSequenceNumber,
                player: eventPlayer,
                choice: log.args.choice, // true = heads, false = tails
                result: log.args.result, // true = heads, false = tails
                winner: log.args.winner,
                randomNumber: log.args.randomNumber,
                blockNumber: log.blockNumber,
                transactionHash: log.transactionHash
              };
              
              // Clear timeout
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
              }
              
              // Call callback
              if (onResult) {
                onResult(result);
              }
              
              // Reset pending sequence
              setPendingSequence(null);
            }
          }
        } catch (err) {
          // Error processing event
        }
      });
    }
  });

  // Polling fallback: Check for result by querying contract events manually
  // Similar to script's approach - query getGame and check if completed
  useEffect(() => {
    if (!pendingSequence || !activeAddress || !publicClient) return;
    
    let startBlock = null;
    
    const pollInterval = setInterval(async () => {
      try {
        // First, get current block to track from where we started
        if (!startBlock) {
          startBlock = await publicClient.getBlockNumber();
        }
        
        const currentBlock = await publicClient.getBlockNumber();
        
        // Get all CoinflipResult events from start block (no filter to avoid RPC limits, like script)
        // Use topics to filter by event signature only, then filter by sequenceNumber in code
        const eventAbi = COIN_FLIP_ABI.find(item => item.name === 'CoinflipResult' && item.type === 'event');
        if (!eventAbi) {
          return;
        }
        
        const logs = await publicClient.getLogs({
          address: COIN_FLIP_CONTRACT_ADDRESS,
          event: {
            type: 'event',
            name: 'CoinflipResult',
            inputs: eventAbi.inputs
          },
          fromBlock: startBlock - 10n, // Start from a bit before to catch any missed events
          toBlock: currentBlock
        });
        
        for (const log of logs) {
          try {
            const decoded = decodeEventLog({
              abi: COIN_FLIP_ABI,
              data: log.data,
              topics: log.topics
            });
            
            if (decoded.eventName === 'CoinflipResult') {
              const eventSequenceNumber = decoded.args.sequenceNumber;
              const eventPlayer = decoded.args.player;
              
              // Check if this is our sequence number (like script does)
              if (eventSequenceNumber &&
                  eventSequenceNumber.toString() === pendingSequence.toString()) {

                // Verify it's our address (game wallet or main wallet)
                if (eventPlayer?.toLowerCase() === activeAddress?.toLowerCase()) {
                  const result = {
                    sequenceNumber: eventSequenceNumber,
                    player: eventPlayer,
                    choice: decoded.args.choice,
                    result: decoded.args.result,
                    winner: decoded.args.winner,
                    randomNumber: decoded.args.randomNumber,
                    blockNumber: log.blockNumber,
                    transactionHash: log.transactionHash
                  };
                  
                  clearInterval(pollInterval);
                  if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                  }
                  
                  if (onResult) {
                    onResult(result);
                  }
                  
                  setPendingSequence(null);
                  return;
                }
              }
            }
          } catch (err) {
            // Error decoding log
          }
        }
      } catch (err) {
        // Polling error
      }
    }, 5000); // Poll every 5 seconds (like script checks)
    
    return () => {
      clearInterval(pollInterval);
    };
  }, [pendingSequence, activeAddress, publicClient, onResult]);

  // API fallback: Check API after 4 seconds if no result received
  useEffect(() => {
    if (!pendingSequence || !activeAddress) return;

    const apiCheckTimeout = setTimeout(async () => {
      try {
        // Fetch user flips from API (use active address - game or main wallet)
        const apiData = await getUserFlips(activeAddress, 20);
        
        if (apiData.success && apiData.data && apiData.data.length > 0) {
          // Find flip with matching sequence number
          const matchingFlip = apiData.data.find(flip => {
            const flipSeq = flip.sequenceNumber?.toString();
            const pendingSeq = pendingSequence?.toString();
            return flipSeq === pendingSeq || flipSeq === pendingSequence;
          });
          
          if (matchingFlip && matchingFlip.result && matchingFlip.result !== null && matchingFlip.result !== '') {
            // Convert API result to match event format
            const result = {
              sequenceNumber: BigInt(matchingFlip.sequenceNumber || pendingSequence),
              player: matchingFlip.player || activeAddress,
              choice: matchingFlip.choice === 'heads' || matchingFlip.choice === true, // Convert string to boolean
              result: matchingFlip.result === 'heads' || matchingFlip.result === true, // Convert string to boolean
              winner: matchingFlip.winner === true || matchingFlip.winner === 'true',
              randomNumber: matchingFlip.randomNumber || BigInt(0),
              blockNumber: BigInt(matchingFlip.blockNumber || 0),
              transactionHash: matchingFlip.transactionHash || matchingFlip.txHash || '',
              resultTransactionHash: matchingFlip.resultTransactionHash || matchingFlip.resultTxHash,
              fromApi: true // Flag to indicate this came from API
            };
            
            // Clear timeout
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            
            // Call callback
            if (onResult) {
              onResult(result);
            }
            
            // Reset pending sequence
            setPendingSequence(null);
            return;
          }
        }
      } catch (err) {
        // Error checking API
      }
    }, 4000); // Check after 4 seconds

    return () => {
      clearTimeout(apiCheckTimeout);
    };
  }, [pendingSequence, activeAddress, onResult]);

  // Set timeout for result (2 minutes like in scripts)
  useEffect(() => {
    if (pendingSequence && activeAddress) {
      timeoutRef.current = setTimeout(() => {
        if (onResult) {
          onResult({
            timeout: true,
            sequenceNumber: pendingSequence
          });
        }
        setPendingSequence(null);
      }, 120000); // 2 minutes

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
  }, [pendingSequence, activeAddress, onResult]);

  // Update pending sequence when prop changes
  useEffect(() => {
    if (sequenceNumber) {
      setPendingSequence(sequenceNumber);
    }
  }, [sequenceNumber]);

  return { pendingSequence, setPendingSequence };
};

