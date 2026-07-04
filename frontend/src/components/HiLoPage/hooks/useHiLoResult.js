import { useEffect, useRef, useState } from 'react';
import { useWatchContractEvent, usePublicClient } from 'wagmi';
import { HILO_CONTRACT_ADDRESS, HILO_ABI } from '../utils/constants';
import { decodeEventLog } from 'viem';
import { getGame } from '../utils/hiloApi';
import { useGameWallet } from '../../../context';

/**
 * Hook to listen for GameResult events and automatically show results
 * Updated for 3-step flow: startGame -> revealFirstCard -> play -> GameResult
 * @param {string} address - User wallet address (main wallet)
 * @param {Function} onResult - Callback when result is received
 * @param {number|string} gameId - Game ID to listen for
 */
export const useHiLoResult = (address, onResult, gameId = null) => {
  const publicClient = usePublicClient();
  const { isUsingGameWallet, address: gameWalletAddress } = useGameWallet();

  // CRITICAL: Use game wallet address when in game mode, otherwise main wallet
  const activeAddress = isUsingGameWallet && gameWalletAddress ? gameWalletAddress : address;

  const [pendingGameId, setPendingGameId] = useState(gameId);
  const timeoutRef = useRef(null);

  // Update pending game ID when prop changes
  useEffect(() => {
    if (gameId) {
      setPendingGameId(gameId);
    }
  }, [gameId]);

  // Watch for GameResult events
  useWatchContractEvent({
    address: HILO_CONTRACT_ADDRESS,
    abi: HILO_ABI,
    eventName: 'GameResult',
    enabled: !!pendingGameId && !!activeAddress, // Only enable when waiting for result
    onLogs: (logs) => {
      if (!pendingGameId) {
        return;
      }

      logs.forEach((log) => {
        try {
          const eventGameId = log.args.gameId;
          const eventPlayer = log.args.player;

          // Check if this is our event
          if (pendingGameId && eventGameId &&
              eventGameId.toString() === pendingGameId.toString()) {

            // Verify it's our address (game wallet or main wallet)
            if (eventPlayer?.toLowerCase() === activeAddress?.toLowerCase()) {
              const result = {
                gameId: eventGameId,
                player: eventPlayer,
                firstCard: Number(log.args.firstCard),
                secondCard: Number(log.args.secondCard),
                predictHigh: log.args.predictHigh,
                winner: log.args.winner,
                payout: log.args.payout,
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

              // Reset pending game ID
              setPendingGameId(null);
            }
          }
        } catch (err) {
          // Error processing event
        }
      });
    }
  });

  // Polling fallback: Check for result by querying contract events manually
  useEffect(() => {
    if (!pendingGameId || !activeAddress || !publicClient) return;

    let startBlock = null;

    const pollInterval = setInterval(async () => {
      try {
        if (!startBlock) {
          startBlock = await publicClient.getBlockNumber();
        }

        const currentBlock = await publicClient.getBlockNumber();

        const eventAbi = HILO_ABI.find(item => item.name === 'GameResult' && item.type === 'event');
        if (!eventAbi) return;

        const logs = await publicClient.getLogs({
          address: HILO_CONTRACT_ADDRESS,
          event: {
            type: 'event',
            name: 'GameResult',
            inputs: eventAbi.inputs
          },
          fromBlock: startBlock - 10n,
          toBlock: currentBlock
        });

        for (const log of logs) {
          try {
            const decoded = decodeEventLog({
              abi: HILO_ABI,
              data: log.data,
              topics: log.topics
            });

            if (decoded.eventName === 'GameResult') {
              const eventGameId = decoded.args.gameId;
              const eventPlayer = decoded.args.player;

              if (eventGameId &&
                  eventGameId.toString() === pendingGameId.toString()) {

                // Verify it's our address (game wallet or main wallet)
                if (eventPlayer?.toLowerCase() === activeAddress?.toLowerCase()) {
                  const result = {
                    gameId: eventGameId,
                    player: eventPlayer,
                    firstCard: Number(decoded.args.firstCard),
                    secondCard: Number(decoded.args.secondCard),
                    predictHigh: decoded.args.predictHigh,
                    winner: decoded.args.winner,
                    payout: decoded.args.payout,
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

                  setPendingGameId(null);
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
    }, 3000); // Poll every 3 seconds

    return () => {
      clearInterval(pollInterval);
    };
  }, [pendingGameId, activeAddress, publicClient, onResult]);

  // API fallback: Check API after 3 seconds if no result received
  useEffect(() => {
    if (!pendingGameId || !activeAddress) return;

    const apiCheckTimeout = setTimeout(async () => {
      try {
        const apiData = await getGame(pendingGameId.toString());

        if (apiData.success && apiData.data && apiData.data.state === 'completed') {
          const game = apiData.data;
          const result = {
            gameId: BigInt(game.gameId),
            player: game.player,
            firstCard: game.firstCard,
            secondCard: game.secondCard,
            predictHigh: game.predictHigh,
            winner: game.won,
            payout: BigInt(game.payout?.wei || '0'),
            blockNumber: BigInt(game.resultBlockNumber || 0),
            transactionHash: game.resultTxHash || '',
            fromApi: true
          };

          // Clear timeout
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }

          if (onResult) {
            onResult(result);
          }

          setPendingGameId(null);
          return;
        }
      } catch (err) {
        // Error checking API
      }
    }, 3000);

    return () => {
      clearTimeout(apiCheckTimeout);
    };
  }, [pendingGameId, activeAddress, onResult]);

  // Set timeout for result (2 minutes)
  useEffect(() => {
    if (pendingGameId && activeAddress) {
      timeoutRef.current = setTimeout(() => {
        if (onResult) {
          onResult({
            timeout: true,
            gameId: pendingGameId
          });
        }
        setPendingGameId(null);
      }, 120000); // 2 minutes

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
  }, [pendingGameId, activeAddress, onResult]);

  return { pendingGameId, setPendingGameId };
};
