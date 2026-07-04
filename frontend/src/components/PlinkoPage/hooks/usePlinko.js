import { useState, useCallback, useEffect, useRef } from 'react';
import { useReadContract, useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { parseEther, formatEther, encodeFunctionData } from 'viem';
import {
  PLINKO_CONTRACT_ADDRESS,
  PLINKO_ABI,
  PLINKO_WS_URL,
  RISK_LEVELS,
  RISK_LEVEL_NAMES,
  VALID_ROWS,
  MULTIPLIERS
} from '../utils/constants';
import { getRecentGames } from '../utils/plinkoApi';
import { useGameWallet } from '../../../context';
import toast from 'react-hot-toast';

export const usePlinko = ({ refetchBalance } = {}) => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const {
    isUsingGameWallet,
    address: gameWalletAddress,
    sendTransaction: gameWalletSendTx,
    refreshBalance: refreshGameBalance,
    canAfford,
    getShortage
  } = useGameWallet();

  const { writeContract } = useWriteContract();
  const activeAddress = isUsingGameWallet && gameWalletAddress ? gameWalletAddress : address;
  const prevActiveAddressRef = useRef(activeAddress);

  // Unified bet tracking: each bet goes through sending → waiting → dropping → done
  // Key: tempId (number) | gameId (string) — transitions update the key when gameId is known
  const [activeBets, setActiveBets] = useState(new Map());
  const tempIdRef = useRef(0);
  const MAX_CONCURRENT = 10;

  // Active animations - multiple balls can animate at once
  const [activeAnimations, setActiveAnimations] = useState([]);

  // Game state
  const [recentResults, setRecentResults] = useState([]);

  // Selection state
  const [selectedRisk, setSelectedRisk] = useState(RISK_LEVELS.HIGH);
  const [selectedRows, setSelectedRows] = useState(10);

  // Track which gameIds we've already added to prevent duplicates
  const addedGameIdsRef = useRef(new Set());

  // Track gameIds that received results via WebSocket
  const completedGameIdsRef = useRef(new Set());
  const batchInFlightRef = useRef(false);

  // Get risk name from value
  const getRiskName = (riskValue) => RISK_LEVEL_NAMES[riskValue];

  // Derived counts from activeBets
  const sendingCount = [...activeBets.values()].filter(b => b.state === 'sending').length;
  const pendingCount = [...activeBets.values()].filter(b => b.state === 'waiting').length;
  const animatingCount = activeAnimations.length;
  const isAnimating = animatingCount > 0;

  // Reset game state when wallet changes
  useEffect(() => {
    if (prevActiveAddressRef.current !== activeAddress && activeAddress) {
      setActiveBets(new Map());
      tempIdRef.current = 0;
      setActiveAnimations([]);
      addedGameIdsRef.current.clear();
      completedGameIdsRef.current.clear();
    }
    prevActiveAddressRef.current = activeAddress;
  }, [activeAddress]);

  // Cleanup stuck bets (sending > 60s, waiting > 30s)
  useEffect(() => {
    const cleanup = setInterval(() => {
      setActiveBets(prev => {
        const now = Date.now();
        let hasStuck = false;

        prev.forEach((bet) => {
          const timeout = bet.state === 'sending' ? 60000 : 30000;
          if (now - bet.timestamp > timeout) {
            hasStuck = true;
          }
        });

        if (!hasStuck) return prev;

        const next = new Map();
        prev.forEach((bet, key) => {
          const timeout = bet.state === 'sending' ? 60000 : 30000;
          if (now - bet.timestamp <= timeout) {
            next.set(key, bet);
          }
        });
        return next;
      });
    }, 5000);

    return () => clearInterval(cleanup);
  }, []);

  // Manual clear stuck games
  const clearStuck = useCallback(() => {
    setActiveBets(new Map());
    tempIdRef.current = 0;
    completedGameIdsRef.current.clear();
  }, []);

  // Update rows when risk changes
  useEffect(() => {
    const riskName = getRiskName(selectedRisk);
    const validRows = VALID_ROWS[riskName];
    if (!validRows.includes(selectedRows)) {
      setSelectedRows(validRows[validRows.length - 1]);
    }
  }, [selectedRisk, selectedRows]);

  // Fetch initial recent results
  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await getRecentGames(30);
        if (res.success && res.data) {
          setRecentResults(res.data);
        }
      } catch (err) {}
    };
    fetchRecent();
  }, []);

  // Contract reads
  const { data: minBet } = useReadContract({
    address: PLINKO_CONTRACT_ADDRESS,
    abi: PLINKO_ABI,
    functionName: 'minBet'
  });

  const { data: maxBet } = useReadContract({
    address: PLINKO_CONTRACT_ADDRESS,
    abi: PLINKO_ABI,
    functionName: 'maxBet'
  });

  // Get multipliers for current config
  const getMultipliersForConfig = useCallback(() => {
    const riskName = getRiskName(selectedRisk);
    return MULTIPLIERS[riskName]?.[selectedRows] || [];
  }, [selectedRisk, selectedRows]);

  // Get valid rows for current risk
  const getValidRowsForRisk = useCallback(() => {
    const riskName = getRiskName(selectedRisk);
    return VALID_ROWS[riskName] || [];
  }, [selectedRisk]);

  // Remove completed animation by gameId — also remove from activeBets
  const onAnimationComplete = useCallback((gameId) => {
    setActiveAnimations(prev => prev.filter(a => a.gameId !== gameId));
    addedGameIdsRef.current.delete(gameId);

    const gid = gameId?.toString();
    if (gid) {
      setActiveBets(prev => {
        const next = new Map(prev);
        next.delete(gid);
        return next;
      });
    }
  }, []);

  // Add result to active animations
  const addAnimation = useCallback((result) => {
    const gameId = result.gameId?.toString();

    if (addedGameIdsRef.current.has(gameId)) {
      return;
    }
    addedGameIdsRef.current.add(gameId);

    setActiveAnimations(prev => [...prev, result]);
  }, []);

  const play = useCallback((betAmount) => {
    if (!address) {
      toast.error('Please connect wallet');
      return;
    }

    if (isUsingGameWallet) {
      const totalActive = activeBets.size;
      if (totalActive >= MAX_CONCURRENT) {
        toast.error(`Max ${MAX_CONCURRENT} pending bets`);
        return;
      }

      const totalNeeded = parseFloat(betAmount);
      if (!canAfford(totalNeeded)) {
        const shortage = getShortage(totalNeeded);
        toast.error(`Insufficient balance! Short by ${shortage.toFixed(2)} MON.`);
        return;
      }

      const betAmountWei = parseEther(betAmount.toString());
      const tempId = ++tempIdRef.current;
      const risk = selectedRisk;
      const rows = selectedRows;

      setActiveBets(prev => {
        const next = new Map(prev);
        next.set(tempId, { state: 'sending', betAmount, risk, rows, timestamp: Date.now() });
        return next;
      });

      gameWalletSendTx({
        to: PLINKO_CONTRACT_ADDRESS,
        value: betAmountWei,
        data: encodeFunctionData({
          abi: PLINKO_ABI,
          functionName: 'play',
          args: [risk, rows]
        }),
        waitForReceipt: false
      }).then(({ hash }) => {
        if (publicClient) {
          publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 })
            .then(receipt => {
              if (receipt.status === 'reverted') {
                setActiveBets(prev => {
                  const next = new Map(prev);
                  next.delete(tempId);
                  return next;
                });
                toast.error('Bet reverted on-chain');
              }
            })
            .catch(() => {});
        }
      }).catch(err => {
        setActiveBets(prev => {
          const next = new Map(prev);
          next.delete(tempId);
          return next;
        });
        handleError(err);
      });

      return;
    }

    // Normal wallet tx
    const betAmountWei = parseEther(betAmount.toString());
    try {
      writeContract({
        address: PLINKO_CONTRACT_ADDRESS,
        abi: PLINKO_ABI,
        functionName: 'play',
        args: [selectedRisk, selectedRows],
        value: betAmountWei
      });
    } catch (err) {
      handleError(err);
    }
  }, [address, isUsingGameWallet, gameWalletSendTx, writeContract, selectedRisk, selectedRows, canAfford, getShortage, activeBets.size, publicClient]);

  const handleError = (err) => {
    const msg = err.message || '';
    if (msg.includes('rejected') || msg.includes('denied') || msg.includes('User denied')) {
      toast.error('Rejected');
      return;
    }
    if (msg.toLowerCase().includes('nonce')) {
      toast.error('Nonce sync, try again');
      return;
    }
    if (msg.includes('insufficient') || msg.includes('balance')) {
      toast.error('Insufficient balance');
      return;
    }
    if (msg.includes('gas') || msg.includes('execution reverted')) {
      toast.error('TX failed');
      return;
    }
    const shortMsg = msg.length > 30 ? msg.slice(0, 30) + '...' : msg;
    toast.error(shortMsg);
  };

  // WebSocket for real-time updates
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const processedGameIds = useRef(new Set());
  const isConnectingRef = useRef(false);
  const refreshGameBalanceRef = useRef(refreshGameBalance);
  const refetchBalanceRef = useRef(refetchBalance);

  useEffect(() => {
    refreshGameBalanceRef.current = refreshGameBalance;
  }, [refreshGameBalance]);

  useEffect(() => {
    refetchBalanceRef.current = refetchBalance;
  }, [refetchBalance]);

  useEffect(() => {
    if (!activeAddress) return;

    let cancelled = false;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 50;
    const BASE_DELAY = 2000;

    const connect = () => {
      if (cancelled || isConnectingRef.current) return;

      isConnectingRef.current = true;

      try {
        const ws = new WebSocket(PLINKO_WS_URL);

        ws.onopen = () => {
          isConnectingRef.current = false;
          reconnectAttempts = 0;
          wsRef.current = ws;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'GamePending') {
              const gameData = data.data;
              const gameId = gameData.gameId?.toString();

              if (
                gameId &&
                gameData.player?.toLowerCase() === activeAddress?.toLowerCase() &&
                !completedGameIdsRef.current.has(gameId)
              ) {
                setActiveBets(prev => {
                  // Check if gameId already tracked
                  if (prev.has(gameId)) return prev;

                  const next = new Map(prev);

                  // Find the oldest 'sending' entry to assign this gameId
                  let assigned = false;
                  for (const [key, bet] of next) {
                    if (bet.state === 'sending') {
                      next.delete(key);
                      next.set(gameId, { state: 'waiting', betAmount: gameData.betAmount || bet.betAmount, risk: gameData.riskLevel || bet.risk, rows: gameData.rows || bet.rows, gameId, timestamp: Date.now() });
                      assigned = true;
                      break;
                    }
                  }

                  // No sending entry to assign to — standalone waiting
                  if (!assigned) {
                    next.set(gameId, { state: 'waiting', betAmount: gameData.betAmount, risk: gameData.riskLevel, rows: gameData.rows, gameId, timestamp: Date.now() });
                  }

                  return next;
                });
              }
            }

            if (data.type === 'GameResult') {
              const gameData = data.data;
              const gameId = gameData.gameId?.toString();

              if (gameId && processedGameIds.current.has(gameId)) return;
              if (gameId) {
                processedGameIds.current.add(gameId);
                if (processedGameIds.current.size > 100) {
                  const arr = Array.from(processedGameIds.current);
                  processedGameIds.current = new Set(arr.slice(-50));
                }
              }

              setRecentResults(prev => [gameData, ...prev].slice(0, 30));

              if (gameData.player?.toLowerCase() === activeAddress?.toLowerCase()) {
                completedGameIdsRef.current.add(gameId);
                if (completedGameIdsRef.current.size > 100) {
                  const arr = Array.from(completedGameIdsRef.current);
                  completedGameIdsRef.current = new Set(arr.slice(-50));
                }

                // Remove from activeBets (no longer waiting)
                setActiveBets(prev => {
                  if (prev.has(gameId)) {
                    const next = new Map(prev);
                    next.delete(gameId);
                    return next;
                  }
                  return prev;
                });

                const result = {
                  gameId: gameData.gameId,
                  player: gameData.player,
                  betAmount: gameData.betAmount,
                  riskLevel: gameData.riskLevel,
                  rows: gameData.rows,
                  bucketIndex: gameData.bucketIndex,
                  multiplier: gameData.multiplier,
                  payout: gameData.payout,
                  path: gameData.path
                };
                addAnimation(result);

                refreshGameBalanceRef.current?.();
                refetchBalanceRef.current?.();
              }
            }
          } catch (err) {}
        };

        ws.onclose = () => {
          isConnectingRef.current = false;
          wsRef.current = null;
          if (!cancelled && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = Math.min(BASE_DELAY * Math.pow(1.5, Math.min(reconnectAttempts - 1, 5)), 30000);
            reconnectTimeoutRef.current = setTimeout(connect, delay);
          }
        };

        ws.onerror = () => {
          isConnectingRef.current = false;
        };
      } catch (err) {
        isConnectingRef.current = false;
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      isConnectingRef.current = false;
    };
  }, [activeAddress, addAnimation]);

  const resetState = useCallback(() => {
    setActiveBets(new Map());
    tempIdRef.current = 0;
    setActiveAnimations([]);
    addedGameIdsRef.current.clear();
    completedGameIdsRef.current.clear();
  }, []);

  // Multi-bet function — single tx via playBatch
  const playMultiple = useCallback(async (betAmount, count = 10) => {
    if (batchInFlightRef.current) {
      return;
    }

    if (!address) {
      toast.error('Please connect wallet');
      return;
    }
    if (!isUsingGameWallet) {
      const betWei = parseEther(betAmount.toString());
      const totalWei = betWei * BigInt(count);
      try {
        writeContract({
          address: PLINKO_CONTRACT_ADDRESS,
          abi: PLINKO_ABI,
          functionName: 'playBatch',
          args: [selectedRisk, selectedRows, count],
          value: totalWei
        });
      } catch (err) {
        handleError(err);
      }
      return;
    }

    const actualCount = Math.min(count, MAX_CONCURRENT - activeBets.size);
    if (actualCount <= 0) {
      toast.error(`Max ${MAX_CONCURRENT} pending bets`);
      return;
    }

    const betWei = parseEther(betAmount.toString());
    const totalWei = betWei * BigInt(actualCount);
    const risk = selectedRisk;
    const rows = selectedRows;

    if (!canAfford(parseFloat(betAmount) * actualCount)) {
      const shortage = getShortage(parseFloat(betAmount) * actualCount);
      toast.error(`Insufficient balance! Short by ${shortage.toFixed(2)} MON.`);
      return;
    }

    batchInFlightRef.current = true;

    // Pre-add N sending entries so the UI updates immediately
    const tempIds = Array.from({ length: actualCount }, () => ++tempIdRef.current);
    setActiveBets(prev => {
      const next = new Map(prev);
      tempIds.forEach(tempId => {
        next.set(tempId, { state: 'sending', betAmount, risk, rows, timestamp: Date.now() });
      });
      return next;
    });

    try {
      const { hash } = await gameWalletSendTx({
        to: PLINKO_CONTRACT_ADDRESS,
        value: totalWei,
        data: encodeFunctionData({
          abi: PLINKO_ABI,
          functionName: 'playBatch',
          args: [risk, rows, actualCount]
        }),
        gasLimit: String(actualCount * 500000), // generous limit; actual usage determines cost
        waitForReceipt: false
      });

      console.log(`Plinko batch x${actualCount} TX broadcast`);
      // Poll receipt to catch on-chain reverts (tx broadcast ≠ tx success)
      if (publicClient) {
        publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 })
          .then(receipt => {
            if (receipt.status === 'reverted') {
              setActiveBets(prev => {
                const next = new Map(prev);
                tempIds.forEach(id => next.delete(id));
                return next;
              });
              toast.error('Bet failed on-chain');
            }
          })
          .catch(() => {}); // timeout or error — cleanup interval handles it
      }
    } catch (err) {
      setActiveBets(prev => {
        const next = new Map(prev);
        tempIds.forEach(id => next.delete(id));
        return next;
      });
      handleError(err);
    } finally {
      batchInFlightRef.current = false;
    }
  }, [address, isUsingGameWallet, gameWalletSendTx, writeContract, selectedRisk, selectedRows, canAfford, getShortage, activeBets.size, publicClient]);

  return {
    // Actions
    play,
    playMultiple,
    resetState,
    clearStuck,
    setSelectedRisk,
    setSelectedRows,
    onAnimationComplete,

    // State
    sendingCount,
    pendingCount,
    animatingCount,
    isAnimating,
    activeAnimations,
    recentResults,
    selectedRisk,
    selectedRows,

    // Contract data
    minBet: minBet ? formatEther(minBet) : '0.01',
    maxBet: maxBet ? formatEther(maxBet) : '10',

    // Helpers
    getMultipliersForConfig,
    getValidRowsForRisk,
    getRiskName,

    // Game Wallet
    isUsingGameWallet
  };
};
