import { useState, useCallback, useEffect, useRef } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount, usePublicClient } from 'wagmi';
import { parseEther, formatEther, decodeEventLog, encodeFunctionData } from 'viem';
import { KENO_CONTRACT_ADDRESS, KENO_ABI, KENO_WS_URL, getMultiplierValue } from '../utils/constants';
import { getEntropyFeeLimitWei } from '../../../utils/entropyFeeSettings';
import { playSound } from '../utils/audioManager';
import { useGameWallet } from '../../../context';
import toast from 'react-hot-toast';

export const useKeno = ({ refetchBalance } = {}) => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { isUsingGameWallet, sendTransaction: gameWalletSendTx, refreshBalance: refreshGameBalance, address: gameWalletAddress, canAfford, getShortage, GAS_RESERVE } = useGameWallet();

  // Active address: use game wallet when in game mode, otherwise main wallet
  const activeAddress = isUsingGameWallet && gameWalletAddress ? gameWalletAddress : address;
  const prevActiveAddressRef = useRef(activeAddress);

  // Transaction states
  const [txState, setTxState] = useState('idle'); // idle, starting, confirming, waiting_vrf, drawing, completed
  const [txHash, setTxHash] = useState(null);

  // Game state
  const [selectedNumbers, setSelectedNumbers] = useState(new Set());
  const [drawnNumbers, setDrawnNumbers] = useState([]);
  const [currentDrawIndex, setCurrentDrawIndex] = useState(-1);
  const [gameResult, setGameResult] = useState(null);
  const [currentGameId, setCurrentGameId] = useState(null);
  const [error, setError] = useState(null);

  // Animation lock to prevent multiple animations
  const isAnimatingRef = useRef(false);
  const animationAbortRef = useRef(null);

  // Reset game state when active wallet changes (for game wallet toggle)
  useEffect(() => {
    if (prevActiveAddressRef.current !== activeAddress && activeAddress) {
      // Abort any running animation
      if (animationAbortRef.current) {
        animationAbortRef.current.aborted = true;
      }
      isAnimatingRef.current = false;
      setTxState('idle');
      setTxHash(null);
      setDrawnNumbers([]);
      setCurrentDrawIndex(-1);
      setGameResult(null);
      setCurrentGameId(null);
      setError(null);
      // Keep selectedNumbers for convenience
    }
    prevActiveAddressRef.current = activeAddress;
  }, [activeAddress]);

  const { writeContract, data: writeData, error: writeError, reset: resetWrite } = useWriteContract();
  const { isSuccess: isConfirmed, isError: isTxError, error: txReceiptError } = useWaitForTransactionReceipt({
    hash: writeData,
    enabled: !!writeData
  });

  // Get min/max bet
  const { data: minBet } = useReadContract({
    address: KENO_CONTRACT_ADDRESS,
    abi: KENO_ABI,
    functionName: 'minBet',
    query: { enabled: !!KENO_CONTRACT_ADDRESS }
  });

  const { data: maxBet } = useReadContract({
    address: KENO_CONTRACT_ADDRESS,
    abi: KENO_ABI,
    functionName: 'maxBet',
    query: { enabled: !!KENO_CONTRACT_ADDRESS }
  });

  // Get entropy fee - refetch every 2 seconds
  const { data: entropyFee } = useReadContract({
    address: KENO_CONTRACT_ADDRESS,
    abi: KENO_ABI,
    functionName: 'getEntropyFee',
    query: {
      enabled: !!KENO_CONTRACT_ADDRESS,
      refetchInterval: 2000
    }
  });

  // Toggle number selection
  const toggleNumber = useCallback((num) => {
    if (txState !== 'idle') return;

    setSelectedNumbers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(num)) {
        newSet.delete(num);
      } else if (newSet.size < 10) {
        newSet.add(num);
        // Play select sound when number is selected
        playSound('select');
      } else {
        toast.error('Maximum 10 numbers');
      }
      return newSet;
    });
  }, [txState]);

  // Auto-pick random numbers (count=10 means clear and pick fresh 10)
  const autoPick = useCallback((count) => {
    if (txState !== 'idle') return;

    // If count is 10, clear selection first and pick 10 fresh numbers
    const startFresh = count === 10;
    const currentSet = startFresh ? new Set() : selectedNumbers;

    const available = [];
    for (let i = 1; i <= 40; i++) {
      if (!currentSet.has(i)) {
        available.push(i);
      }
    }

    const maxToPick = startFresh ? 10 : (10 - currentSet.size);
    const toAdd = Math.min(count, maxToPick, available.length);
    const picked = [];

    for (let i = 0; i < toAdd; i++) {
      const idx = Math.floor(Math.random() * available.length);
      picked.push(available[idx]);
      available.splice(idx, 1);
    }

    if (startFresh) {
      setSelectedNumbers(new Set(picked));
    } else {
      setSelectedNumbers(prev => new Set([...prev, ...picked]));
    }
  }, [selectedNumbers, txState]);

  // Clear selection
  const clearSelection = useCallback(() => {
    if (txState !== 'idle') return;
    setSelectedNumbers(new Set());
  }, [txState]);

  // Risk level mapping: 'classic'=0, 'low'=1, 'medium'=2, 'high'=3
  const RISK_LEVEL_MAP = {
    'classic': 0,
    'low': 1,
    'medium': 2,
    'high': 3
  };

  // Start game
  const startGame = useCallback(async (betAmount, riskLevel = 'classic') => {
    if (!activeAddress) {
      toast.error('Please connect wallet');
      return;
    }

    if (selectedNumbers.size === 0) {
      toast.error('Select at least 1 number');
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
    const numbersArray = Array.from(selectedNumbers).sort((a, b) => a - b);
    const riskLevelNum = RISK_LEVEL_MAP[riskLevel] || 0;

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
        setTxState('starting');
        setError(null);
        setGameResult(null);
        setDrawnNumbers([]);
        setCurrentDrawIndex(-1);
        setTxHash(null);

        // Play bet sound
        playSound('bet');

        // Encode function call
        const data = encodeFunctionData({
          abi: KENO_ABI,
          functionName: 'play',
          args: [numbersArray, riskLevelNum]
        });

        // Send via game wallet (signless!)
        const { hash, receipt } = await gameWalletSendTx({
          to: KENO_CONTRACT_ADDRESS,
          value: totalValue,
          data
        });

        setTxHash(hash);
        setTxState('waiting_vrf');

        // Extract gameId from receipt
        if (receipt?.logs) {
          for (const log of receipt.logs) {
            try {
              const decoded = decodeEventLog({
                abi: KENO_ABI,
                data: log.data,
                topics: log.topics
              });
              if (decoded.eventName === 'BetPlaced') {
                const gameId = decoded.args.gameId.toString();
                setCurrentGameId(gameId);
                toast.success('Bet placed! Waiting for draw...');
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
        handleError(err, 'Start game failed');
      }
      return;
    }

    // ===== MAIN WALLET MODE (existing flow) =====
    try {
      setTxState('starting');
      setError(null);
      setGameResult(null);
      setDrawnNumbers([]);
      setCurrentDrawIndex(-1);

      // Play bet sound
      playSound('bet');

      writeContract({
        address: KENO_CONTRACT_ADDRESS,
        abi: KENO_ABI,
        functionName: 'play',
        args: [numbersArray, riskLevelNum],
        value: totalValue
      });
    } catch (err) {
      handleError(err, 'Start game failed');
    }
  }, [activeAddress, selectedNumbers, writeContract, entropyFee, isUsingGameWallet, gameWalletSendTx, refreshGameBalance, refetchBalance, canAfford, getShortage, GAS_RESERVE]);

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
      setTxState('idle');
      setError(txReceiptError.message || '');
      toast.error('Transaction failed');
    }
  }, [isTxError, txReceiptError]);

  // Handle write errors
  useEffect(() => {
    if (writeError) {
      handleError(writeError, 'Transaction failed');
    }
  }, [writeError]);

  // Process confirmed transactions
  useEffect(() => {
    const processConfirmedTx = async () => {
      if (!isConfirmed || !txHash || !publicClient) return;

      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: KENO_ABI,
              data: log.data,
              topics: log.topics
            });

            if (decoded.eventName === 'BetPlaced') {
              const gameId = decoded.args.gameId.toString();
              setCurrentGameId(gameId);
              setTxState('waiting_vrf');
              toast.success('Bet placed! Waiting for draw...');
              // Refresh balance after bet is placed
              refetchBalance?.();
            }

            if (decoded.eventName === 'GameResult') {
              // Skip if already animating (WebSocket already triggered)
              if (isAnimatingRef.current) return;

              const drawnNums = decoded.args.drawnNumbers.map(n => Number(n));
              const hits = Number(decoded.args.hits);
              const won = decoded.args.won;
              const payout = decoded.args.payout;
              // Event doesn't have multiplier, pass 0 (will be calculated)
              const multiplier = 0;

              animateDrawing(drawnNums, hits, won, payout, multiplier);
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

  // Animate number drawing with lock to prevent multiple animations
  const animateDrawing = useCallback((drawnNums, hits, won, payout, multiplier) => {
    // Prevent multiple animations
    if (isAnimatingRef.current) return;

    isAnimatingRef.current = true;

    // Store ALL drawn numbers immediately, animate via currentDrawIndex
    setDrawnNumbers(drawnNums);
    setCurrentDrawIndex(0);
    setTxState('drawing');

    let currentIndex = 0;

    const drawNext = () => {
      if (currentIndex < drawnNums.length) {
        const drawnNum = drawnNums[currentIndex];
        setCurrentDrawIndex(currentIndex + 1);
        
        // Play reveal sound for each number
        playSound('reveal');
        
        // Check if this number is a match (selected and drawn)
        // We need to check selectedNumbers here, but it's in closure
        // We'll check it after state update
        setTimeout(() => {
          // Check if this number matches (is selected)
          // Note: selectedNumbers might be stale in closure, but we check current state
          const isMatch = selectedNumbers.has(drawnNum);
          if (isMatch) {
            playSound('match');
          }
        }, 50);
        
        currentIndex++;
        setTimeout(drawNext, 250);
      } else {
        // Animation complete, show result after delay
        setTimeout(() => {
          setGameResult({
            won,
            hits,
            payout: formatEther(payout),
            multiplier: multiplier || 0,
            drawnNumbers: drawnNums
          });
          setTxState('completed');
          // Refresh balance after game result
          refetchBalance?.();

          // Play win/lose sound
          if (won) {
            playSound('win');
            toast.success(`${hits} hits! Won ${formatEther(payout)} MON!`);
          } else {
            playSound('lose');
            toast.error(`${hits} hits - No win this time`);
          }

          isAnimatingRef.current = false;
        }, 600);
      }
    };

    // Start animation
    setTimeout(drawNext, 100);
  }, [refetchBalance, selectedNumbers]);

  // WebSocket for real-time VRF updates
  const wsRef = useRef(null);

  // ===== STALLED STATE RECOVERY =====
  // If starting/confirming gets stuck for 30+ seconds, try to recover gameId from receipt
  useEffect(() => {
    if (txState !== 'starting' && txState !== 'confirming') return;
    if (!activeAddress) return;

    const stalledTimeout = setTimeout(async () => {
      // Already recovered
      if (txState === 'idle' || txState === 'waiting_vrf' || txState === 'drawing' || txState === 'completed') return;

      const hashToCheck = txHash || writeData;
      if (hashToCheck && publicClient) {
        try {
          const receipt = await publicClient.getTransactionReceipt({ hash: hashToCheck });
          if (receipt?.status === 'success' && receipt.logs) {
            for (const log of receipt.logs) {
              try {
                const decoded = decodeEventLog({
                  abi: KENO_ABI,
                  data: log.data,
                  topics: log.topics
                });
                if (decoded.eventName === 'BetPlaced') {
                  const gameId = decoded.args.gameId.toString();
                  setCurrentGameId(gameId);
                  setTxState('waiting_vrf');
                  toast.success('Bet placed! Waiting for draw...');
                  refetchBalance?.();
                  return;
                }
              } catch (_) {}
            }
          }
        } catch (_) {}
      }

      // Could not recover gameId from receipt — reset to idle
      toast.error('Game start timed out. Please try again.');
      setTxState('idle');
      setTxHash(null);
      resetWrite?.();
    }, 10000);

    return () => clearTimeout(stalledTimeout);
  }, [txState, txHash, writeData, publicClient, activeAddress, refetchBalance, resetWrite]);

  useEffect(() => {
    if (!KENO_WS_URL || !currentGameId) return;

    const connect = () => {
      try {
        const ws = new WebSocket(KENO_WS_URL);

        ws.onopen = () => {
          wsRef.current = ws;
          ws.send(JSON.stringify({ type: 'subscribe', gameId: currentGameId }));
        };

        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.event === 'gameResult' && data.gameId === currentGameId) {
              // Skip if already animating
              if (isAnimatingRef.current) return;

              const drawnNums = data.drawnNumbers.map(n => Number(n));
              const hits = Number(data.hits);
              const won = data.won;
              const payout = BigInt(data.payout);
              const multiplier = data.multiplier || 0;

              animateDrawing(drawnNums, hits, won, payout, multiplier);
            }
          } catch (err) {
            // Silent fail
          }
        };

        ws.onclose = () => {
          setTimeout(connect, 2000);
        };
      } catch (err) {
        // Silent fail
      }
    };

    connect();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [currentGameId, animateDrawing]);


  // Reset state
  const resetState = useCallback(() => {
    // Abort any running animation
    if (animationAbortRef.current) {
      animationAbortRef.current.aborted = true;
    }
    isAnimatingRef.current = false;

    setTxState('idle');
    setTxHash(null);
    setGameResult(null);
    setDrawnNumbers([]);
    setCurrentDrawIndex(-1);
    setCurrentGameId(null);
    setError(null);
    // Keep selected numbers for quick replay
    resetWrite?.();
  }, [resetWrite]);

  // Get potential payout for current selection
  const getPotentialPayout = useCallback((betAmount) => {
    if (!betAmount || selectedNumbers.size === 0) return {};

    const pickCount = selectedNumbers.size;
    const payouts = {};

    for (let hits = 0; hits <= pickCount; hits++) {
      const mult = getMultiplierValue(pickCount, hits);
      if (mult > 0) {
        payouts[hits] = (parseFloat(betAmount) * mult * 0.975).toFixed(4); // 2.5% fee
      }
    }

    return payouts;
  }, [selectedNumbers]);

  // Get number state for display
  const getNumberState = useCallback((num) => {
    const isSelected = selectedNumbers.has(num);
    const drawIndex = drawnNumbers.indexOf(num);
    // Only show as drawn if animation has reached this number
    const isRevealed = drawIndex !== -1 && drawIndex < currentDrawIndex;
    const isHit = isSelected && isRevealed;
    const isMiss = isSelected && gameResult && drawIndex === -1;

    if (isHit) return 'hit';
    if (isMiss) return 'miss';
    if (isRevealed) return 'drawn';
    if (isSelected) return 'selected';
    return 'default';
  }, [selectedNumbers, drawnNumbers, currentDrawIndex, gameResult]);

  // Get draw order for a number (only if revealed)
  const getDrawOrder = useCallback((num) => {
    const index = drawnNumbers.indexOf(num);
    // Only show order if animation has reached this number
    if (index >= 0 && index < currentDrawIndex) {
      return index + 1;
    }
    return null;
  }, [drawnNumbers, currentDrawIndex]);

  return {
    // Actions
    toggleNumber,
    autoPick,
    clearSelection,
    startGame,
    resetState,

    // State
    selectedNumbers,
    drawnNumbers,
    currentDrawIndex,
    txState,
    txHash,
    gameResult,
    error,

    // Contract data
    minBet: minBet ? formatEther(minBet) : '10',
    maxBet: maxBet ? formatEther(maxBet) : '500',
    entropyFee: entropyFee ? formatEther(entropyFee) : '0',

    // Helpers
    getPotentialPayout,
    getNumberState,
    getDrawOrder,
    isGameActive: txState === 'waiting_vrf' || txState === 'drawing',
    isDrawing: txState === 'drawing',

    // Game wallet
    isUsingGameWallet
  };
};
