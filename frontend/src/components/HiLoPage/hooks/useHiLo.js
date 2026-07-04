import { useState, useCallback, useEffect, useRef } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount, usePublicClient } from 'wagmi';
import { parseEther, formatEther, decodeEventLog, encodeFunctionData } from 'viem';
import { HILO_CONTRACT_ADDRESS, HILO_ABI, GameState } from '../utils/constants';
import { getEntropyFeeLimitWei } from '../../../utils/entropyFeeSettings';
import { startGame as startGameAPI, getActiveGame, getGame } from '../utils/hiloApi';
import { playSound } from '../utils/audioManager';
import { useGameWallet } from '../../../context';
import toast from 'react-hot-toast';

const WS_URL = process.env.REACT_APP_HILO_WS_URL || 'wss://your-api-url/ws/hilo';

/**
 * Hook for HiLo game with 3-step flow:
 * 1. startGame() - Creates game, waits 3 blocks
 * 2. revealFirstCard() - Reveals first card from blockhash
 * 3. play() - Place bet + predict, VRF reveals second card
 */
export const useHiLo = ({ refetchBalance } = {}) => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { isUsingGameWallet, address: gameWalletAddress, sendTransaction: gameWalletSendTx, refreshBalance: refreshGameBalance, canAfford, getShortage, GAS_RESERVE } = useGameWallet();

  // Active address: use game wallet when in game mode, otherwise main wallet
  const activeAddress = isUsingGameWallet ? gameWalletAddress : address;

  // Transaction states
  const [txState, setTxState] = useState('idle');
  const [txHash, setTxHash] = useState(null);

  // Game state
  const [gameId, setGameId] = useState(null);
  const [gameState, setGameState] = useState(GameState.None);
  const [firstCard, setFirstCard] = useState(null);
  const [secondCard, setSecondCard] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [blocksRemaining, setBlocksRemaining] = useState(0);
  const [error, setError] = useState(null);
  const [multipliers, setMultipliers] = useState({ high: null, low: null });
  const [isInitialized] = useState(false);
  const autoStartRef = useRef(false);
  const resultProcessedRef = useRef(false); // Prevents duplicate result processing
  const prevActiveAddressRef = useRef(activeAddress);

  // Reset game state when active wallet changes (for game wallet toggle)
  useEffect(() => {
    if (prevActiveAddressRef.current !== activeAddress && activeAddress) {
      // Wallet changed - reset everything to allow re-fetch
      autoStartRef.current = false;
      resultProcessedRef.current = false;
      setGameId(null);
      setGameState(GameState.None);
      setFirstCard(null);
      setSecondCard(null);
      setGameResult(null);
      setTxState('idle');
      setError(null);
    }
    prevActiveAddressRef.current = activeAddress;
  }, [activeAddress]);

  const { writeContract, data: writeData, error: writeError, reset: resetWrite } = useWriteContract();
  const { isSuccess: isConfirmed, isError: isTxError, error: txReceiptError } = useWaitForTransactionReceipt({
    hash: writeData,
    enabled: !!writeData
  });

  // Get Entropy fee (Pyth VRF)
  const { data: entropyFee } = useReadContract({
    address: HILO_CONTRACT_ADDRESS,
    abi: HILO_ABI,
    functionName: 'getEntropyFee'
  });

  // Get min/max bet
  const { data: minBet } = useReadContract({
    address: HILO_CONTRACT_ADDRESS,
    abi: HILO_ABI,
    functionName: 'minBet'
  });

  const { data: maxBet } = useReadContract({
    address: HILO_CONTRACT_ADDRESS,
    abi: HILO_ABI,
    functionName: 'maxBet'
  });

  // Step 1: Start game (via backend API)
  const startGame = useCallback(async () => {
    if (!activeAddress) {
      toast.error('Please connect wallet');
      return;
    }

    try {
      setTxState('starting');
      setError(null);
      setTxHash(null);
      setFirstCard(null);
      setSecondCard(null);
      setGameResult(null);
      resultProcessedRef.current = false; // Reset for new game

      // Play deal sound
      playSound('deal');

      // Call backend API to start game (use activeAddress for game wallet support)
      const result = await startGameAPI(activeAddress);

      if (!result.success) {
        setError(result.error);
        setTxState('idle');
        toast.error(result.error || 'Failed to start game');
        return;
      }

      // Set game ID from response
      const gId = BigInt(result.gameId);
      setGameId(gId);
      setTxHash(result.txHash);

      // If this is an existing game, load its state
      if (result.isExisting) {
        toast.success('Resuming existing game...');
        // Fetch game data from backend
        const gameData = await getGame(result.gameId);
        if (gameData.success && gameData.data) {
          const game = gameData.data;
          if (game.firstCard) {
            setFirstCard(game.firstCard);
            setGameState(GameState.WaitingBet);
            setTxState('idle');
          } else {
            setGameState(GameState.WaitingReveal);
            setTxState('waiting-blocks');
          }
        }
      } else {
        // New game started
        setGameState(GameState.WaitingReveal);
        setTxState('waiting-blocks');
        toast.success('Game started! Waiting for blocks...');

        // Poll for first card reveal (in case WS message was missed)
        const pollForFirstCard = async () => {
          for (let i = 0; i < 30; i++) { // Poll for up to 30 seconds
            await new Promise(r => setTimeout(r, 1000));
            try {
              const gameData = await getGame(result.gameId);
              if (gameData.success && gameData.data?.firstCard) {
                setFirstCard(gameData.data.firstCard);
                setGameState(GameState.WaitingBet);
                setTxState('idle');
                toast.success(`First card revealed: ${gameData.data.firstCard}`);
                return;
              }
            } catch (e) {
              // Silent fail for poll errors
            }
          }
        };
        pollForFirstCard();
      }

    } catch (err) {
      handleError(err, 'Start game failed');
    }
  }, [activeAddress]);

  // Step 2: Reveal first card
  const revealFirstCard = useCallback(async () => {
    if (!gameId) {
      toast.error('No active game');
      return;
    }

    try {
      setTxState('revealing');
      setError(null);

      // Play flip sound for card reveal
      playSound('flip');

      // ===== GAME WALLET MODE =====
      if (isUsingGameWallet) {
        try {
          // Encode function call
          const data = encodeFunctionData({
            abi: HILO_ABI,
            functionName: 'revealFirstCard',
            args: [gameId]
          });

          // Send via game wallet (signless!)
          const { hash, receipt } = await gameWalletSendTx({
            to: HILO_CONTRACT_ADDRESS,
            value: 0n,
            data
          });

          setTxHash(hash);

          // Extract FirstCardRevealed event from receipt
          if (receipt?.logs) {
            for (const log of receipt.logs) {
              try {
                const decoded = decodeEventLog({
                  abi: HILO_ABI,
                  data: log.data,
                  topics: log.topics
                });
                if (decoded.eventName === 'FirstCardRevealed') {
                  const card = Number(decoded.args.firstCard);
                  setFirstCard(card);
                  setGameState(GameState.WaitingBet);
                  setTxState('idle');
                  toast.success(`First card revealed: ${card}`);
                  break;
                }
              } catch (e) {
                // Not our event
              }
            }
          }

          // Refresh game wallet balance
          refreshGameBalance?.();

        } catch (err) {
          handleError(err, 'Reveal failed');
        }
        return;
      }

      // ===== MAIN WALLET MODE =====
      writeContract({
        address: HILO_CONTRACT_ADDRESS,
        abi: HILO_ABI,
        functionName: 'revealFirstCard',
        args: [gameId]
      });
    } catch (err) {
      handleError(err, 'Reveal failed');
    }
  }, [gameId, writeContract, isUsingGameWallet, gameWalletSendTx, refreshGameBalance]);

  // Step 3: Play (bet + predict)
  const play = useCallback(async (predictHigh, betAmount) => {
    if (!gameId) {
      toast.error('No active game');
      return;
    }

    if (!entropyFee) {
      toast.error('Loading entropy fee...');
      return;
    }

    // Check if entropy fee exceeds user's custom limit
    const maxEntropyFee = getEntropyFeeLimitWei();
    if (entropyFee > maxEntropyFee) {
      toast.error('Fee exceeds your limit! Adjust in settings or try later.');
      return;
    }

    const betAmountWei = parseEther(betAmount.toString());
    const totalAmount = betAmountWei + entropyFee;

    // ===== GAME WALLET MODE =====
    if (isUsingGameWallet) {
      // Check if game wallet can afford the bet + fees + reserve
      const entropyFeeInMon = parseFloat(formatEther(entropyFee));
      const totalNeeded = parseFloat(betAmount) + entropyFeeInMon;
      if (!canAfford(totalNeeded)) {
        const shortage = getShortage(totalNeeded);
        toast.error(`Insufficient game wallet balance! Need ${(totalNeeded + GAS_RESERVE).toFixed(2)} MON (including ${GAS_RESERVE} MON reserve). Short by ${shortage.toFixed(2)} MON.`);
        return;
      }

      try {
        setTxState('betting');
        setError(null);

        // Play bet sound
        playSound('bet');

        // Encode function call
        const data = encodeFunctionData({
          abi: HILO_ABI,
          functionName: 'play',
          args: [gameId, predictHigh]
        });

        // Send via game wallet (signless!)
        const { hash, receipt } = await gameWalletSendTx({
          to: HILO_CONTRACT_ADDRESS,
          value: totalAmount,
          data
        });

        setTxHash(hash);
        setGameState(GameState.WaitingVRF);
        setTxState('waiting-result');

        // Extract events from receipt
        if (receipt?.logs) {
          for (const log of receipt.logs) {
            try {
              const decoded = decodeEventLog({
                abi: HILO_ABI,
                data: log.data,
                topics: log.topics
              });

              // GameResult event - VRF fulfilled immediately (FakeVRF on devnet)
              if (decoded.eventName === 'GameResult') {
                // Skip if already processed
                if (resultProcessedRef.current) {
                  break;
                }
                resultProcessedRef.current = true;

                const result = {
                  gameId: decoded.args.gameId,
                  player: decoded.args.player,
                  firstCard: Number(decoded.args.firstCard),
                  secondCard: Number(decoded.args.secondCard),
                  predictHigh: decoded.args.predictHigh,
                  winner: decoded.args.winner,
                  payout: decoded.args.payout
                };
                setSecondCard(result.secondCard);
                setGameResult(result);
                setGameState(GameState.Completed);
                setTxState('idle');

                // Play win/lose sound
                if (result.winner) {
                  playSound('correct');
                  playSound('win');
                  toast.success(`You won! Card: ${result.secondCard}`);
                } else {
                  playSound('lose');
                  toast.error(`You lost. Card: ${result.secondCard}`);
                }
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
        handleError(err, 'Bet failed');
      }
      return;
    }

    // ===== MAIN WALLET MODE =====
    try {
      setTxState('betting');
      setError(null);

      // Play bet sound
      playSound('bet');

      writeContract({
        address: HILO_CONTRACT_ADDRESS,
        abi: HILO_ABI,
        functionName: 'play',
        args: [gameId, predictHigh],
        value: totalAmount
      });
    } catch (err) {
      handleError(err, 'Bet failed');
    }
  }, [gameId, entropyFee, writeContract, isUsingGameWallet, gameWalletSendTx, refreshGameBalance, refetchBalance, canAfford, getShortage, GAS_RESERVE]);

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

  // Process confirmed transactions
  useEffect(() => {
    const processConfirmedTx = async () => {
      if (!isConfirmed || !txHash || !publicClient) return;

      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: HILO_ABI,
              data: log.data,
              topics: log.topics
            });

            // GameStarted event - Step 1 complete
            if (decoded.eventName === 'GameStarted') {
              const gId = decoded.args.gameId;
              setGameId(gId);
              setGameState(GameState.WaitingReveal);
              setTxState('waiting-blocks');
              toast.success('Game started! Waiting for 3 blocks...');
              break;
            }

            // FirstCardRevealed event - Step 2 complete
            if (decoded.eventName === 'FirstCardRevealed') {
              const card = Number(decoded.args.firstCard);
              setFirstCard(card);
              setGameState(GameState.WaitingBet);
              setTxState('idle');
              // Play flip sound for card reveal
              playSound('flip');
              toast.success(`First card revealed: ${card}`);
              break;
            }

            // BetPlaced event - Step 3 started
            if (decoded.eventName === 'BetPlaced') {
              // Don't break - continue to check for GameResult in same tx
              // FakeVRF fulfills immediately in same transaction
              setGameState(GameState.WaitingVRF);
              setTxState('waiting-result');
              // Refresh balance after bet is placed
              refetchBalance?.();
            }

            // GameResult event - Game completed (VRF fulfilled)
            if (decoded.eventName === 'GameResult') {
              // Skip if already processed (prevents duplicate toasts)
              if (resultProcessedRef.current) {
                break;
              }
              resultProcessedRef.current = true;

              const result = {
                gameId: decoded.args.gameId,
                player: decoded.args.player,
                firstCard: Number(decoded.args.firstCard),
                secondCard: Number(decoded.args.secondCard),
                predictHigh: decoded.args.predictHigh,
                winner: decoded.args.winner,
                payout: decoded.args.payout
              };
              setSecondCard(result.secondCard);
              setGameResult(result);
              setGameState(GameState.Completed);
              setTxState('idle');
              // Refresh balance after game result
              refetchBalance?.();

              // Play win/lose sound
              if (result.winner) {
                playSound('correct'); // Correct guess sound
                playSound('win'); // Win sound
                toast.success(`You won! Card: ${result.secondCard}`);
              } else {
                playSound('lose'); // Lose sound
                toast.error(`You lost. Card: ${result.secondCard}`);
              }
              break;
            }
          } catch (e) {
            // Not our event
          }
        }
      } catch (err) {
        // Silent fail for tx processing errors
      }
    };

    processConfirmedTx();
  }, [isConfirmed, txHash, publicClient]);

  // WebSocket connection for real-time updates
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Handle WebSocket message for first card reveal
  const handleFirstCardRevealed = useCallback((data) => {
    // Only process if it's our game
    if (gameId && data.gameId === gameId.toString()) {
      setFirstCard(data.firstCard);
      setGameState(GameState.WaitingBet);
      setTxState('idle');
      // Play flip sound for card reveal
      playSound('flip');
      toast.success(`First card revealed: ${data.firstCard}`);
    }
  }, [gameId]);

  // Handle WebSocket message for game result (Pyth Entropy callback)
  const handleGameResultWS = useCallback((data) => {
    // Only process if it's our game AND not already processed
    if (gameId && data.gameId === gameId.toString()) {
      // Skip if already processed (prevents duplicate toasts)
      if (resultProcessedRef.current) {
        return;
      }
      resultProcessedRef.current = true;

      const result = {
        gameId: data.gameId,
        player: data.player,
        firstCard: data.firstCard,
        secondCard: data.secondCard,
        predictHigh: data.predictHigh,
        winner: data.winner,
        payout: data.payout
      };
      setSecondCard(result.secondCard);
      setGameResult(result);
      setGameState(GameState.Completed);
      setTxState('idle');
      // Refresh balance after game result
      refetchBalance?.();

      // Play win/lose sound
      if (result.winner) {
        playSound('correct'); // Correct guess sound
        playSound('win'); // Win sound
        toast.success(`You won! Card: ${result.secondCard}`);
      } else {
        playSound('lose'); // Lose sound
        toast.error(`You lost. Card: ${result.secondCard}`);
      }
    }
  }, [gameId, refetchBalance]);

  // WebSocket connection effect
  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
          wsRef.current = ws;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === 'firstCardRevealed') {
              handleFirstCardRevealed(data);
            }
            // Handle game result from Pyth Entropy callback
            if (data.event === 'gameResult') {
              handleGameResultWS(data);
            }
          } catch (err) {
            // Silent fail for message errors
          }
        };

        ws.onclose = () => {
          reconnectTimeoutRef.current = setTimeout(connect, 2000);
        };

        ws.onerror = () => {
          // Silent fail for WS errors
        };

      } catch (err) {
        // Silent fail for connection errors
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [handleFirstCardRevealed, handleGameResultWS]);

  // Subscribe to game when gameId changes
  useEffect(() => {
    if (gameId && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', gameId: gameId.toString() }));
    }
  }, [gameId]);

  // Poll for blocks remaining (lightweight, just for UI countdown)
  useEffect(() => {
    if (gameState !== GameState.WaitingReveal || !gameId || !publicClient) return;

    const checkBlocks = async () => {
      try {
        const remaining = await publicClient.readContract({
          address: HILO_CONTRACT_ADDRESS,
          abi: HILO_ABI,
          functionName: 'getBlocksUntilReveal',
          args: [gameId]
        });
        setBlocksRemaining(Number(remaining));
      } catch (err) {
        // Silent fail for block check errors
      }
    };

    checkBlocks();
    const interval = setInterval(checkBlocks, 1000);
    return () => clearInterval(interval);
  }, [gameState, gameId, publicClient]);

  // Fetch multipliers when first card is revealed (with cleanup)
  useEffect(() => {
    if (!firstCard || !publicClient) {
      setMultipliers({ high: null, low: null });
      return;
    }

    let isMounted = true;
    
    const fetchMultipliers = async () => {
      try {
        const result = await publicClient.readContract({
          address: HILO_CONTRACT_ADDRESS,
          abi: HILO_ABI,
          functionName: 'getMultipliers',
          args: [firstCard]
        });

        // Only update if still mounted
        if (!isMounted) return;
        
        // Result is [highMultiplier, lowMultiplier] in PRECISION (10000 = 1.00x)
        const highMult = Number(result[0]) / 10000;
        const lowMult = Number(result[1]) / 10000;

        setMultipliers({
          high: highMult > 0 ? highMult.toFixed(2) : null,
          low: lowMult > 0 ? lowMult.toFixed(2) : null
        });
      } catch (err) {
        if (isMounted) {
          setMultipliers({ high: null, low: null });
        }
      }
    };

    fetchMultipliers();
    
    return () => {
      isMounted = false;
    };
  }, [firstCard, publicClient]);

  // Reset state
  const resetState = useCallback(() => {
    setTxState('idle');
    setTxHash(null);
    setGameId(null);
    setGameState(GameState.None);
    setFirstCard(null);
    setSecondCard(null);
    setGameResult(null);
    setBlocksRemaining(0);
    setError(null);
    setMultipliers({ high: null, low: null });
    resultProcessedRef.current = false; // Reset for new game
    resetWrite?.();
  }, [resetWrite]);

  // Auto-init: Check for active game or start new one when wallet connects
  useEffect(() => {
    if (!activeAddress || autoStartRef.current) return;

    const initGame = async () => {
      autoStartRef.current = true;

      try {
        // Check if player has an active game (use activeAddress for game wallet support)
        const activeGameResult = await getActiveGame(activeAddress);

        // If game is expired, backend returns hasActiveGame: false
        if (activeGameResult.success && activeGameResult.expiredGameId) {
          // Previous game expired, start new one
          toast.info('Previous game expired, starting new game...');
          autoStartRef.current = false;
          startGame();
          return;
        }

        if (activeGameResult.success && activeGameResult.hasActiveGame && activeGameResult.activeGameId && activeGameResult.activeGameId !== '0') {
          // Resume existing game
          const gameData = await getGame(activeGameResult.activeGameId);

          if (gameData.success && gameData.data) {
            const game = gameData.data;

            // Check if game is expired in DB
            if (game.state === 'expired') {
              toast.info('Previous game expired, starting new game...');
              autoStartRef.current = false;
              startGame();
              return;
            }

            // If game is completed, don't set gameId (prevents re-triggering old result)
            // Just start a new game
            if (game.state === 'completed' || game.state === 4) {
              autoStartRef.current = false;
              startGame();
              return;
            }

            setGameId(BigInt(game.gameId));
            setTxHash(game.startTxHash);

            if (game.firstCard) {
              setFirstCard(game.firstCard);
              setGameState(GameState.WaitingBet);
              setTxState('idle');
            } else {
              setGameState(GameState.WaitingReveal);
              setTxState('waiting-blocks');
            }
            return;
          }
        }

        // No active game, start new one
        autoStartRef.current = false;
        startGame();

      } catch (err) {
        // Still try to start game on error
        autoStartRef.current = false;
        startGame();
      }
    };

    // Small delay to ensure wallet is ready
    const timer = setTimeout(initGame, 500);
    return () => clearTimeout(timer);
  }, [activeAddress, startGame]);

  // Auto-restart: Start new game when current game completes
  useEffect(() => {
    if (gameState !== GameState.Completed) return;

    // Wait 3 seconds for result to be visible, then start new game
    const timer = setTimeout(() => {
      autoStartRef.current = false; // Allow new game to start
      resetState();
      startGame();
    }, 3000);

    return () => clearTimeout(timer);
  }, [gameState, resetState, startGame]);

  return {
    // Actions
    startGame,
    revealFirstCard,
    play,
    resetState,

    // State
    txState,
    txHash,
    gameId,
    gameState,
    firstCard,
    secondCard,
    gameResult,
    blocksRemaining,
    error,

    // Contract data
    entropyFee: entropyFee ? formatEther(entropyFee) : null,
    minBet: minBet ? formatEther(minBet) : null,
    maxBet: maxBet ? formatEther(maxBet) : null,

    // Dynamic multipliers
    multipliers,

    // Auto-init state
    isInitialized,

    // Game wallet
    isUsingGameWallet
  };
};
