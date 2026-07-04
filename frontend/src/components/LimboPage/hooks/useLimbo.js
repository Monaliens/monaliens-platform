import { useState, useCallback, useEffect, useRef } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount, usePublicClient } from 'wagmi';
import { parseEther, formatEther, decodeEventLog, encodeFunctionData } from 'viem';
import { LIMBO_CONTRACT_ADDRESS, LIMBO_ABI, LIMBO_WS_URL, PRECISION } from '../utils/constants';
import { getEntropyFeeLimitWei } from '../../../utils/entropyFeeSettings';
import { getRecentGames } from '../utils/limboApi';
import { playSound } from '../utils/audioManager';
import { useGameWallet } from '../../../context';
import toast from 'react-hot-toast';

export const useLimbo = ({ refetchBalance } = {}) => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const {
    isUsingGameWallet,
    address: gameWalletAddress,
    sendTransaction: gameWalletSendTx,
    refreshBalance: refreshGameBalance,
    canAfford,
    getShortage,
    GAS_RESERVE
  } = useGameWallet();

  // Use game wallet address when in game mode, otherwise main wallet
  const activeAddress = isUsingGameWallet && gameWalletAddress ? gameWalletAddress : address;
  const prevActiveAddressRef = useRef(activeAddress);

  // Transaction states
  const [txState, setTxState] = useState('idle'); // idle, betting, confirming, waiting_vrf
  const [txHash, setTxHash] = useState(null);
  const [currentGameId, setCurrentGameId] = useState(null);

  // Game state
  const [gameResult, setGameResult] = useState(null);
  const [error, setError] = useState(null);
  const [recentResults, setRecentResults] = useState([]);

  // Reset game state when active wallet changes (for game wallet toggle)
  useEffect(() => {
    if (prevActiveAddressRef.current !== activeAddress && activeAddress) {
      setTxState('idle');
      setTxHash(null);
      setCurrentGameId(null);
      setGameResult(null);
      setError(null);
    }
    prevActiveAddressRef.current = activeAddress;
  }, [activeAddress]);

  // Audio ref for looping sounds
  const tickAudioRef = useRef(null);

  // Fetch initial recent results from API
  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await getRecentGames(30);
        if (res.success && res.data) {
          const multipliers = res.data.map(g => g.resultMultiplier).filter(Boolean);
          setRecentResults(multipliers);
        }
      } catch (err) {
        // Silent fail
      }
    };
    fetchRecent();
  }, []);

  const { writeContract, data: writeData, error: writeError, reset: resetWrite } = useWriteContract();
  const { isSuccess: isConfirmed, isError: isTxError, error: txReceiptError } = useWaitForTransactionReceipt({
    hash: writeData,
    enabled: !!writeData
  });

  // Get min/max bet
  const { data: minBet } = useReadContract({
    address: LIMBO_CONTRACT_ADDRESS,
    abi: LIMBO_ABI,
    functionName: 'minBet'
  });

  const { data: maxBet } = useReadContract({
    address: LIMBO_CONTRACT_ADDRESS,
    abi: LIMBO_ABI,
    functionName: 'maxBet'
  });

  // Get entropy fee
  const { data: entropyFee } = useReadContract({
    address: LIMBO_CONTRACT_ADDRESS,
    abi: LIMBO_ABI,
    functionName: 'getEntropyFee'
  });

  // Play limbo
  const play = useCallback(async (targetMultiplier, betAmount) => {
    if (!address) {
      toast.error('Please connect wallet');
      return;
    }

    // Check if entropy fee exceeds user's custom limit
    const maxEntropyFee = getEntropyFeeLimitWei();
    if (entropyFee && entropyFee > maxEntropyFee) {
      toast.error('Fee exceeds your limit! Adjust in settings or try later.');
      return;
    }

    const betAmountWei = parseEther(betAmount.toString());
    const fee = entropyFee || BigInt(0);
    const totalValue = betAmountWei + fee;

    // Convert targetMultiplier (float like 2.00) to PRECISION (20000)
    const targetInPrecision = Math.floor(parseFloat(targetMultiplier) * PRECISION);

    // ===== GAME WALLET MODE =====
    if (isUsingGameWallet) {
      // Check if game wallet can afford the bet + fees + reserve
      const entropyFeeInMon = parseFloat(formatEther(fee));
      const totalNeeded = parseFloat(betAmount) + entropyFeeInMon;
      if (!canAfford(totalNeeded)) {
        const shortage = getShortage(totalNeeded);
        toast.error(`Insufficient game wallet balance! Need ${(totalNeeded + GAS_RESERVE).toFixed(2)} MON (including ${GAS_RESERVE} MON reserve). Short by ${shortage.toFixed(2)} MON.`);
        return;
      }

      try {
        setTxState('betting');
        setError(null);
        setGameResult(null);
        setCurrentGameId(null);

        // Play bet sound
        playSound('bet');

        // Encode function call
        const data = encodeFunctionData({
          abi: LIMBO_ABI,
          functionName: 'play',
          args: [BigInt(targetInPrecision)]
        });

        // Send via game wallet (signless!)
        const { hash, receipt } = await gameWalletSendTx({
          to: LIMBO_CONTRACT_ADDRESS,
          value: totalValue,
          data
        });

        setTxHash(hash);

        // Extract gameId from BetPlaced event in receipt
        if (receipt?.logs) {
          for (const log of receipt.logs) {
            try {
              const decoded = decodeEventLog({
                abi: LIMBO_ABI,
                data: log.data,
                topics: log.topics
              });
              if (decoded.eventName === 'BetPlaced') {
                const gameId = decoded.args.gameId.toString();
                setCurrentGameId(gameId);
                setTxState('waiting_vrf');
                toast.success('Bet placed! Waiting for result...');
                // Start tick sound loop while waiting for VRF
                playSound('tick', { loop: true }).then(audio => {
                  if (audio) tickAudioRef.current = audio;
                });
                break;
              }
            } catch (e) {
              // Not our event
            }
          }
        }

        // Refresh game wallet balance
        refreshGameBalance?.();
        refetchBalance?.();

      } catch (err) {
        handleError(err, 'Bet failed');
      }
      return;
    }

    // ===== MAIN WALLET MODE (existing flow) =====
    try {
      setTxState('betting');
      setError(null);
      setGameResult(null);
      setCurrentGameId(null);

      // Play bet sound
      playSound('bet');

      writeContract({
        address: LIMBO_CONTRACT_ADDRESS,
        abi: LIMBO_ABI,
        functionName: 'play',
        args: [BigInt(targetInPrecision)],
        value: totalValue
      });
    } catch (err) {
      handleError(err, 'Bet failed');
    }
  }, [address, writeContract, entropyFee, isUsingGameWallet, gameWalletSendTx, refreshGameBalance, refetchBalance, canAfford, getShortage, GAS_RESERVE]);

  // Calculate win chance locally (11000 range formula)
  const getWinChance = useCallback((targetMultiplier) => {
    if (!targetMultiplier || targetMultiplier < 1.01) return 0;
    // threshold = (99 * 100) / target
    // winChance = threshold / 11000 * 100
    const threshold = (99 * 100) / targetMultiplier;
    const chance = (threshold / 11000) * 100;
    return Math.min(chance, 99).toFixed(2);
  }, []);

  // Error handler
  const handleError = (err, prefix) => {
    const msg = err.message || '';
    if (msg.includes('rejected') || msg.includes('denied') || msg.includes('User denied')) {
      setError('Transaction rejected');
      setTxState('idle');
      toast.error('Transaction rejected');
    } else {
      setError(msg);
      setTxState('idle');
      toast.error(`${prefix}: ${msg}`);
    }
  };

  // Watch transaction state
  useEffect(() => {
    if (writeData) {
      setTxHash(writeData);
      setTxState('confirming');
    }
  }, [writeData]);

  // Handle transaction failure
  useEffect(() => {
    if (isTxError && txReceiptError) {
      const errorMessage = txReceiptError.message || '';
      setTxState('idle');
      setError(errorMessage);
      toast.error('Transaction failed');
    }
  }, [isTxError, txReceiptError]);

  // Handle write errors
  useEffect(() => {
    if (writeError) {
      handleError(writeError, 'Transaction failed');
    }
  }, [writeError]);

  // Process confirmed transactions - look for BetPlaced event
  useEffect(() => {
    const processConfirmedTx = async () => {
      if (!isConfirmed || !txHash || !publicClient) return;

      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: LIMBO_ABI,
              data: log.data,
              topics: log.topics
            });

            if (decoded.eventName === 'BetPlaced') {
              const gameId = decoded.args.gameId.toString();
              setCurrentGameId(gameId);
              setTxState('waiting_vrf');
              toast.success('Bet placed! Waiting for result...');
              // Refresh balance after bet is placed
              refetchBalance?.();
              // Start tick sound loop while waiting for VRF
              playSound('tick', { loop: true }).then(audio => {
                if (audio) tickAudioRef.current = audio;
              });
              break;
            }

            if (decoded.eventName === 'GameResult') {
              const result = {
                gameId: decoded.args.gameId.toString(),
                player: decoded.args.player,
                betAmount: formatEther(decoded.args.betAmount),
                targetMultiplier: (Number(decoded.args.targetMultiplier) / PRECISION).toFixed(2),
                resultMultiplier: (Number(decoded.args.resultMultiplier) / PRECISION).toFixed(2),
                won: decoded.args.won,
                payout: formatEther(decoded.args.payout)
              };
              // Stop tick sound
              if (tickAudioRef.current) {
                tickAudioRef.current.pause();
                tickAudioRef.current.currentTime = 0;
                tickAudioRef.current = null;
              }
              // Play win/lose sound
              if (result.won) {
                playSound('win');
              } else {
                playSound('lose');
              }
              setGameResult(result);
              setTxState('idle');
              // Refresh balance after game result
              refetchBalance?.();
              break;
            }
          } catch (e) {
            // Not our event
          }
        }
      } catch (err) {
        setTxState('idle');
      }
    };

    processConfirmedTx();
  }, [isConfirmed, txHash, publicClient]);

  // WebSocket for real-time updates (VRF callback result)
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const processedGameIds = useRef(new Set());
  const currentGameIdRef = useRef(null);

  // Keep ref in sync with state
  useEffect(() => {
    currentGameIdRef.current = currentGameId;
  }, [currentGameId]);

  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket(LIMBO_WS_URL);

        ws.onopen = () => {
          wsRef.current = ws;

          if (currentGameIdRef.current) {
            ws.send(JSON.stringify({ type: 'subscribe', gameId: currentGameIdRef.current }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.event === 'gameResult') {
              // Skip if already processed this gameId
              const gameId = data.gameId?.toString();
              if (gameId && processedGameIds.current.has(gameId)) {
                return;
              }
              if (gameId) {
                processedGameIds.current.add(gameId);
                // Keep set size manageable
                if (processedGameIds.current.size > 100) {
                  const arr = Array.from(processedGameIds.current);
                  processedGameIds.current = new Set(arr.slice(-50));
                }
              }

              // Add to recent results (for all players)
              setRecentResults(prev => {
                const newResult = data.resultMultiplier;
                const updated = [newResult, ...prev].slice(0, 30);
                return updated;
              });

              // Handle own game result (check both main wallet and game wallet)
              if (data.player?.toLowerCase() === activeAddress?.toLowerCase()) {
                const pendingGameId = currentGameIdRef.current;
                if (pendingGameId && gameId === pendingGameId) {
                  const result = {
                    gameId: data.gameId,
                    player: data.player,
                    betAmount: data.betAmount,
                    targetMultiplier: data.targetMultiplier,
                    resultMultiplier: data.resultMultiplier,
                    won: data.won,
                    payout: data.payout
                  };
                  // Stop tick sound
                  if (tickAudioRef.current) {
                    tickAudioRef.current.pause();
                    tickAudioRef.current.currentTime = 0;
                    tickAudioRef.current = null;
                  }
                  // Play win/lose sound
                  if (result.won) {
                    playSound('win');
                  } else {
                    playSound('lose');
                  }
                  setGameResult(result);
                  setTxState('idle');
                  setCurrentGameId(null);
                  // Refresh balance after game result
                  refreshGameBalance?.();
                  refetchBalance?.();
                }
              }
            }
          } catch (err) {
            // Silent fail
          }
        };

        ws.onclose = () => {
          reconnectTimeoutRef.current = setTimeout(connect, 2000);
        };

        ws.onerror = () => {
          // Silent fail
        };
      } catch (err) {
        // Silent fail
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [activeAddress, refreshGameBalance, refetchBalance]);

  // Subscribe to game when currentGameId changes
  useEffect(() => {
    if (currentGameId && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', gameId: currentGameId }));
    }
  }, [currentGameId]);

  // Reset state
  const resetState = useCallback(() => {
    // Stop tick sound if playing
    if (tickAudioRef.current) {
      tickAudioRef.current.pause();
      tickAudioRef.current.currentTime = 0;
      tickAudioRef.current = null;
    }
    setTxState('idle');
    setTxHash(null);
    setGameResult(null);
    setError(null);
    setCurrentGameId(null);
    resetWrite?.();
  }, [resetWrite]);

  return {
    // Actions
    play,
    resetState,

    // State
    txState,
    txHash,
    gameResult,
    error,
    currentGameId,
    recentResults,

    // Contract data
    minBet: minBet ? formatEther(minBet) : '0.01',
    maxBet: maxBet ? formatEther(maxBet) : '100',
    entropyFee: entropyFee ? formatEther(entropyFee) : '0',

    // Helpers
    getWinChance,

    // Game Wallet
    isUsingGameWallet
  };
};
