import { useState, useCallback, useEffect, useRef } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount, usePublicClient } from 'wagmi';
import { parseEther, formatEther, decodeEventLog, encodeFunctionData } from 'viem';
import { DICE_CONTRACT_ADDRESS, DICE_ABI, DICE_WS_URL, DICE_API_URL } from '../utils/constants';
import { getEntropyFeeLimitWei } from '../../../utils/entropyFeeSettings';
import { playSound } from '../utils/audioManager';
import { useGameWallet } from '../../../context';
import toast from 'react-hot-toast';

export const useDice = ({ refetchBalance } = {}) => {
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

  // Active address - use game wallet when in game mode, otherwise main wallet
  const activeAddress = isUsingGameWallet && gameWalletAddress ? gameWalletAddress : address;
  const prevActiveAddressRef = useRef(activeAddress);

  // Transaction states
  const [txState, setTxState] = useState('idle'); // idle, betting, confirming, waiting_vrf
  const [txHash, setTxHash] = useState(null);
  const [currentGameId, setCurrentGameId] = useState(null);

  // Game state
  const [gameResult, setGameResult] = useState(null);
  const [error, setError] = useState(null);

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

  // Audio refs for looping sounds
  const rollingAudioRef = useRef(null);

  // Multipliers cache from API
  const [multipliers, setMultipliers] = useState({});
  const [thresholdRange, setThresholdRange] = useState({ min: 4, max: 97 });

  const { writeContract, data: writeData, error: writeError, reset: resetWrite } = useWriteContract();
  const { isSuccess: isConfirmed, isError: isTxError, error: txReceiptError } = useWaitForTransactionReceipt({
    hash: writeData,
    enabled: !!writeData
  });

  // Get min/max bet
  const { data: minBet } = useReadContract({
    address: DICE_CONTRACT_ADDRESS,
    abi: DICE_ABI,
    functionName: 'minBet'
  });

  const { data: maxBet } = useReadContract({
    address: DICE_CONTRACT_ADDRESS,
    abi: DICE_ABI,
    functionName: 'maxBet'
  });

  // Get entropy fee
  const { data: entropyFee } = useReadContract({
    address: DICE_CONTRACT_ADDRESS,
    abi: DICE_ABI,
    functionName: 'getEntropyFee'
  });

  // Play dice - now includes entropy fee
  const play = useCallback(async (threshold, isOver, betAmount) => {
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
    // Add entropy fee to bet amount
    const fee = entropyFee || BigInt(0);
    const totalValue = betAmountWei + fee;

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
          abi: DICE_ABI,
          functionName: 'play',
          args: [threshold, isOver]
        });

        // Send via game wallet (signless!)
        const { hash, receipt } = await gameWalletSendTx({
          to: DICE_CONTRACT_ADDRESS,
          value: totalValue,
          data
        });

        setTxHash(hash);
        setTxState('confirming');

        // Extract gameId from BetPlaced event in receipt
        if (receipt?.logs) {
          for (const log of receipt.logs) {
            try {
              const decoded = decodeEventLog({
                abi: DICE_ABI,
                data: log.data,
                topics: log.topics
              });

              if (decoded.eventName === 'BetPlaced') {
                const gameId = decoded.args.gameId.toString();
                setCurrentGameId(gameId);
                setTxState('waiting_vrf');
                toast.success('Bet placed! Waiting for result...');
                // Start rolling sound loop
                playSound('rolling', { loop: true }).then(audio => {
                  if (audio) rollingAudioRef.current = audio;
                });
                break;
              }
            } catch (e) {
              // Not our event
            }
          }
        }

        // Refresh balances
        refreshGameBalance?.();
        refetchBalance?.();

      } catch (err) {
        if (err.message?.includes('rejected') || err.message?.includes('denied')) {
          setError('Transaction rejected');
          setTxState('idle');
          toast.error('Transaction rejected');
        } else {
          handleError(err, 'Bet failed');
        }
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
        address: DICE_CONTRACT_ADDRESS,
        abi: DICE_ABI,
        functionName: 'play',
        args: [threshold, isOver],
        value: totalValue
      });
    } catch (err) {
      handleError(err, 'Bet failed');
    }
  }, [address, writeContract, entropyFee, isUsingGameWallet, gameWalletSendTx, refreshGameBalance, refetchBalance, canAfford, getShortage, GAS_RESERVE]);

  // Fetch all multipliers from API on mount
  useEffect(() => {
    const fetchMultipliers = async () => {
      try {
        const res = await fetch(`${DICE_API_URL}/multipliers`);
        const data = await res.json();
        if (data.success && data.data) {
          setMultipliers(data.data);
          // Extract min/max from API response keys
          const thresholds = Object.keys(data.data).map(Number);
          if (thresholds.length > 0) {
            setThresholdRange({
              min: Math.min(...thresholds),
              max: Math.max(...thresholds)
            });
          }
        }
      } catch (err) {
        console.error('Error fetching multipliers:', err);
      }
    };
    fetchMultipliers();
  }, []);

  // Get multiplier from cached data (no RPC call)
  const getMultiplier = useCallback((threshold, isOver) => {
    if (threshold < thresholdRange.min || threshold > thresholdRange.max) return 0;
    const mult = multipliers[threshold];
    if (!mult) return 0;
    return isOver ? mult.over : mult.under;
  }, [multipliers, thresholdRange]);

  // Get win chance - calculated locally (same formula as contract)
  const getWinChance = useCallback((threshold, isOver) => {
    if (threshold < thresholdRange.min || threshold > thresholdRange.max) return 0;
    return isOver ? (100 - threshold) : (threshold - 1);
  }, [thresholdRange]);

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
              abi: DICE_ABI,
              data: log.data,
              topics: log.topics
            });

            // BetPlaced means bet is confirmed, now waiting for VRF
            if (decoded.eventName === 'BetPlaced') {
              const gameId = decoded.args.gameId.toString();
              setCurrentGameId(gameId);
              setTxState('waiting_vrf');
              toast.success('Bet placed! Waiting for result...');
              // Refresh balance after bet is placed
              refetchBalance?.();
              // Start rolling sound loop
              playSound('rolling', { loop: true }).then(audio => {
                if (audio) rollingAudioRef.current = audio;
              });
              break;
            }

            // GameResult in same tx (shouldn't happen with VRF, but fallback)
            if (decoded.eventName === 'GameResult') {
              const result = {
                gameId: decoded.args.gameId.toString(),
                player: decoded.args.player,
                betAmount: formatEther(decoded.args.betAmount),
                threshold: Number(decoded.args.threshold),
                isOver: decoded.args.isOver,
                result: Number(decoded.args.result),
                won: decoded.args.won,
                payout: formatEther(decoded.args.payout)
              };
              // Stop rolling sound
              if (rollingAudioRef.current) {
                rollingAudioRef.current.pause();
                rollingAudioRef.current.currentTime = 0;
                rollingAudioRef.current = null;
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
              // Popup shows result, no toast needed
              break;
            }
          } catch (e) {
            // Not our event
          }
        }
      } catch (err) {
        console.error('Error processing tx:', err);
        setTxState('idle');
      }
    };

    processConfirmedTx();
  }, [isConfirmed, txHash, publicClient]);

  // WebSocket for real-time updates (VRF callback result)
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const currentGameIdRef = useRef(null);

  // Keep ref in sync with state
  useEffect(() => {
    currentGameIdRef.current = currentGameId;
  }, [currentGameId]);

  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket(DICE_WS_URL);

        ws.onopen = () => {
          wsRef.current = ws;

          // Subscribe to current game if we have one
          if (currentGameIdRef.current) {
            ws.send(JSON.stringify({ type: 'subscribe', gameId: currentGameIdRef.current }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const gameId = data.gameId?.toString();

            // GameResult from VRF callback
            // Check against active address (game wallet or main wallet)
            if (data.event === 'gameResult' && data.player?.toLowerCase() === activeAddress?.toLowerCase()) {
              // Check if this is for our current game
              const pendingGameId = currentGameIdRef.current;
              if (pendingGameId && gameId === pendingGameId) {
                const result = {
                  gameId: data.gameId,
                  player: data.player,
                  betAmount: data.betAmount,
                  threshold: data.threshold,
                  isOver: data.isOver,
                  result: data.result,
                  won: data.won,
                  payout: data.payout
                };
                // Stop rolling sound
                if (rollingAudioRef.current) {
                  rollingAudioRef.current.pause();
                  rollingAudioRef.current.currentTime = 0;
                  rollingAudioRef.current = null;
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
                refetchBalance?.();

                // Popup shows result, no toast needed
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
  }, [activeAddress]);

  // Subscribe to game when currentGameId changes
  useEffect(() => {
    if (currentGameId && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', gameId: currentGameId }));
    }
  }, [currentGameId]);

  // Reset state
  const resetState = useCallback(() => {
    // Stop rolling sound if playing
    if (rollingAudioRef.current) {
      rollingAudioRef.current.pause();
      rollingAudioRef.current.currentTime = 0;
      rollingAudioRef.current = null;
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

    // Contract data
    minBet: minBet ? formatEther(minBet) : '0.01',
    maxBet: maxBet ? formatEther(maxBet) : '100',
    entropyFee: entropyFee ? formatEther(entropyFee) : '0',
    minThreshold: thresholdRange.min,
    maxThreshold: thresholdRange.max,

    // Helpers
    getMultiplier,
    getWinChance,

    // Game wallet
    isUsingGameWallet
  };
};
