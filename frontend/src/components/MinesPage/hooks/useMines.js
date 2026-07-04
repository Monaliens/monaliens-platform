import { useState, useCallback, useEffect, useRef } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount, usePublicClient } from 'wagmi';
import { useSignMessage } from 'wagmi';
import { parseEther, formatEther, decodeEventLog, encodeFunctionData } from 'viem';
import { MINES_CONTRACT_ADDRESS, MINES_ABI, MINES_WS_URL, PRECISION } from '../utils/constants';
import { getEntropyFeeLimitWei } from '../../../utils/entropyFeeSettings';
import { playSound } from '../utils/audioManager';
import * as minesApi from '../utils/minesApi';
import { useGameWallet } from '../../../context';
import toast from 'react-hot-toast';

export const useMines = ({ refetchBalance } = {}) => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { signMessageAsync } = useSignMessage();
  const {
    isUsingGameWallet,
    sendTransaction: gameWalletSendTx,
    signWithGameWallet,
    refreshBalance: refreshGameBalance,
    address: gameWalletAddress,
    canAfford,
    getShortage,
    GAS_RESERVE
  } = useGameWallet();

  // Active address - use game wallet when in game mode, otherwise main wallet
  const activeAddress = isUsingGameWallet && gameWalletAddress ? gameWalletAddress : address;

  // Transaction states
  const [txState, setTxState] = useState('idle'); // idle, starting, confirming, waiting_vrf, active, revealing, cashing_out
  const [txHash, setTxHash] = useState(null);

  // Game state
  const [currentGame, setCurrentGame] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [revealedTiles, setRevealedTiles] = useState(new Set());
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [minePositions, setMinePositions] = useState([]);
  const [finalSeed, setFinalSeed] = useState(null);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Session state
  const [hasSession, setHasSession] = useState(minesApi.hasValidSession(activeAddress));

  // Multipliers cache
  const [multipliers, setMultipliers] = useState([]);

  // Ref to track current game ID (avoids stale closure issues)
  const currentGameIdRef = useRef(null);
  const prevActiveAddressRef = useRef(activeAddress);

  // Reset game state when active wallet changes (for game wallet toggle)
  useEffect(() => {
    if (prevActiveAddressRef.current !== activeAddress && activeAddress) {
      // Wallet changed - reset everything to allow clean re-fetch
      setTxState('idle');
      setTxHash(null);
      setCurrentGame(null);
      setGameResult(null);
      setRevealedTiles(new Set());
      setCurrentMultiplier(1);
      setMinePositions([]);
      setFinalSeed(null);
      setError(null);
      setIsInitializing(true);
      currentGameIdRef.current = null;
      // Clear session so new address must re-authenticate
      minesApi.clearSession();
      setHasSession(false);
    }
    prevActiveAddressRef.current = activeAddress;
  }, [activeAddress]);

  // Check session on mount and when active address changes (includes game wallet toggle)
  useEffect(() => {
    setHasSession(minesApi.hasValidSession(activeAddress));
  }, [activeAddress]);

  const { writeContract, data: writeData, error: writeError, reset: resetWrite } = useWriteContract();
  const { isSuccess: isConfirmed, isError: isTxError, error: txReceiptError } = useWaitForTransactionReceipt({
    hash: writeData,
    enabled: !!writeData
  });

  // Get min/max bet
  const { data: minBet } = useReadContract({
    address: MINES_CONTRACT_ADDRESS,
    abi: MINES_ABI,
    functionName: 'minBet',
    query: { enabled: !!MINES_CONTRACT_ADDRESS }
  });

  const { data: maxBet } = useReadContract({
    address: MINES_CONTRACT_ADDRESS,
    abi: MINES_ABI,
    functionName: 'maxBet',
    query: { enabled: !!MINES_CONTRACT_ADDRESS }
  });

  // Get entropy fee - refetch every 2 seconds
  const { data: entropyFee } = useReadContract({
    address: MINES_CONTRACT_ADDRESS,
    abi: MINES_ABI,
    functionName: 'getEntropyFee',
    query: {
      enabled: !!MINES_CONTRACT_ADDRESS,
      refetchInterval: 2000
    }
  });

  // Start a new game
  const startGame = useCallback(async (gridSize, mineCount, betAmount) => {
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

    try {
      setTxState('starting');
      setError(null);
      setGameResult(null);
      setRevealedTiles(new Set());
      setCurrentMultiplier(1);
      setMinePositions([]);
      setFinalSeed(null);

      // First, ensure we have a session
      if (!minesApi.hasValidSession(activeAddress)) {
        if (!isUsingGameWallet) {
          toast.loading('Please sign to authenticate...', { id: 'session' });
        }
        const signFn = isUsingGameWallet
          ? async ({ message }) => await signWithGameWallet(message)
          : async ({ message }) => await signMessageAsync({ message });
        const sessionResult = await minesApi.createSession(signFn, activeAddress);
        if (!sessionResult.success) {
          toast.error('Session required to start game', { id: 'session' });
          setTxState('idle');
          return;
        }
        setHasSession(true);
        toast.success('Session created!', { id: 'session' });
      }

      // Get backendSaltHash from backend
      toast.loading('Preparing game...', { id: 'prepare' });
      const prepareResult = await minesApi.prepareGame();

      if (!prepareResult.success) {
        if (prepareResult.needsSession) {
          setHasSession(false);
          toast.error('Session expired. Please try again.', { id: 'prepare' });
          setTxState('idle');
          return;
        }

        // Check if "active game" error - fetch and load it instead of showing error
        const errMsg = (prepareResult.error || '').toLowerCase();
        if (errMsg.includes('active') && errMsg.includes('game')) {
          toast.loading('Found active game, loading...', { id: 'prepare' });
          const result = await minesApi.getActiveGame(activeAddress);
          if (result.success && result.game) {
            setCurrentGame(result.game);
            if (result.game.revealed_tiles) {
              setRevealedTiles(new Set(result.game.revealed_tiles));
            }
            if (result.game.current_multiplier) {
              setCurrentMultiplier(Number(result.game.current_multiplier) / PRECISION);
            }
            if (result.game.phase === 'waiting_vrf') {
              setTxState('waiting_vrf');
            } else if (result.game.phase === 'active') {
              setTxState('active');
            }
            if (result.game.grid_size && result.game.mine_count) {
              fetchMultipliers(result.game.grid_size, result.game.mine_count);
            }
            toast.success('Active game loaded!', { id: 'prepare' });
            return;
          }
        }

        toast.error(prepareResult.error || 'Failed to prepare game', { id: 'prepare' });
        setTxState('idle');
        return;
      }

      toast.dismiss('prepare');
      const { backendSaltHash } = prepareResult;

      const betAmountWei = parseEther(betAmount.toString());
      const fee = entropyFee || BigInt(0);
      const totalValue = betAmountWei + fee;

      // Play bet sound
      playSound('bet');

      // ===== GAME WALLET MODE =====
      if (isUsingGameWallet) {
        // Check if game wallet can afford the bet + fees + reserve
        const entropyFeeInMon = parseFloat(formatEther(entropyFee || BigInt(0)));
        const totalNeeded = parseFloat(betAmount) + entropyFeeInMon;
        if (!canAfford(totalNeeded)) {
          const shortage = getShortage(totalNeeded);
          toast.error(`Insufficient game wallet balance! Need ${(totalNeeded + GAS_RESERVE).toFixed(2)} MON (including ${GAS_RESERVE} MON reserve). Short by ${shortage.toFixed(2)} MON.`);
          return;
        }

        try {
          // Encode function call
          const data = encodeFunctionData({
            abi: MINES_ABI,
            functionName: 'startGame',
            args: [gridSize, mineCount, backendSaltHash]
          });

          // Send via game wallet (signless!)
          const { hash, receipt } = await gameWalletSendTx({
            to: MINES_CONTRACT_ADDRESS,
            value: totalValue,
            data
          });

          setTxHash(hash);
          setTxState('confirming');

          // Extract game ID from receipt
          if (receipt?.logs) {
            for (const log of receipt.logs) {
              try {
                const decoded = decodeEventLog({
                  abi: MINES_ABI,
                  data: log.data,
                  topics: log.topics
                });

                if (decoded.eventName === 'GameStarted') {
                  const gameId = decoded.args.gameId.toString();
                  setTxState('waiting_vrf');
                  toast.success('Game started! Waiting for VRF...');

                  // Refresh game wallet balance
                  refreshGameBalance?.();
                  refetchBalance?.();

                  // Fetch game from backend
                  const gameData = await minesApi.getGame(gameId);
                  if (gameData.success) {
                    setCurrentGame(gameData.game);
                  }

                  // Auto-create session if not exists
                  if (!minesApi.hasValidSession(activeAddress)) {
                    try {
                      if (!isUsingGameWallet) {
                        toast.loading('Please sign to authenticate...', { id: 'session' });
                      }
                      const signFn = isUsingGameWallet
                        ? async ({ message }) => await signWithGameWallet(message)
                        : async ({ message }) => await signMessageAsync({ message });
                      const result = await minesApi.createSession(signFn, activeAddress);
                      if (result.success) {
                        setHasSession(true);
                        toast.success('Session created!', { id: 'session' });
                      } else {
                        toast.error('Session failed - sign in manually', { id: 'session' });
                      }
                    } catch (err) {
                      toast.dismiss('session');
                    }
                  }
                  break;
                }
              } catch (e) {
                // Not our event
              }
            }
          }
        } catch (err) {
          if (err.message?.includes('rejected') || err.message?.includes('denied')) {
            setError('Transaction rejected');
            setTxState('idle');
            toast.error('Transaction rejected');
          } else {
            handleError(err, 'Start game failed');
          }
        }
        return;
      }

      // ===== MAIN WALLET MODE (existing flow) =====
      writeContract({
        address: MINES_CONTRACT_ADDRESS,
        abi: MINES_ABI,
        functionName: 'startGame',
        args: [gridSize, mineCount, backendSaltHash],
        value: totalValue
      });
    } catch (err) {
      handleError(err, 'Start game failed');
    }
  }, [address, writeContract, entropyFee, signMessageAsync, isUsingGameWallet, gameWalletSendTx, refreshGameBalance, refetchBalance, canAfford, getShortage, GAS_RESERVE]);

  // Keep ref in sync with current game ID
  useEffect(() => {
    currentGameIdRef.current = currentGame?.game_id || null;
  }, [currentGame?.game_id]);

  // Create session - sign message to authenticate (uses active wallet)
  const createSession = useCallback(async () => {
    if (!activeAddress) {
      toast.error('Please connect wallet');
      return false;
    }

    try {
      // Game wallet mode: signless, Main wallet: requires approval
      if (!isUsingGameWallet) {
        toast.loading('Please sign to authenticate...', { id: 'session' });
      }

      // Create sign function based on which wallet is active
      const signFn = isUsingGameWallet
        ? async ({ message }) => await signWithGameWallet(message)
        : async ({ message }) => await signMessageAsync({ message });

      const result = await minesApi.createSession(signFn, activeAddress);

      if (result.success) {
        setHasSession(true);
        toast.success('Session created! Valid for 1 hour.', { id: 'session' });
        return true;
      } else {
        toast.error(result.error || 'Failed to create session', { id: 'session' });
        return false;
      }
    } catch (err) {
      if (err.message?.includes('rejected') || err.message?.includes('denied')) {
        toast.error('Signature rejected', { id: 'session' });
      } else {
        toast.error('Failed to create session', { id: 'session' });
      }
      return false;
    }
  }, [activeAddress, isUsingGameWallet, signWithGameWallet, signMessageAsync]);

  // Reveal a tile (via backend/gasless) - fire and forget, backend handles parallel
  const revealTile = useCallback((tileIndex) => {
    // Don't reveal if no active game or game already ended
    if (!currentGame || !address || gameResult) return;

    // Only reveal if game is active (not waiting_vrf, completed, etc)
    if (txState !== 'active') return;

    if (revealedTiles.has(tileIndex)) return;

    // Capture game ID at call time to detect stale responses
    const gameIdAtCallTime = currentGame.game_id;

    // Fire and forget - don't await, backend handles parallel with NonceManager
    // WebSocket will update revealedTiles and multiplier when TX confirms
    minesApi.revealTile(gameIdAtCallTime, tileIndex)
      .then(result => {
        if (!result.success) {
          // Session expired - need to re-authenticate
          if (result.needsSession) {
            setHasSession(false);
            if (currentGameIdRef.current === gameIdAtCallTime) {
              toast.error('Session expired. Please sign in again.');
            }
            return;
          }

          // Only show error if this is still the same game (not stale response)
          if (currentGameIdRef.current === gameIdAtCallTime) {
            // Ignore nonce/priority/stale game errors - backend handles these
            const errLower = (result.error || '').toLowerCase();
            const isIgnorableError = errLower.includes('nonce') ||
                                     errLower.includes('priority') ||
                                     errLower.includes('coalesce') ||
                                     errLower.includes('replacement') ||
                                     errLower.includes('game not active');
            if (isIgnorableError) return;
            toast.error(`Reveal failed: ${result.error}`);
          }
        }
      })
      .catch(err => {
        // Only show error if this is still the same game
        if (currentGameIdRef.current === gameIdAtCallTime) {
          // Ignore nonce/priority/stale game errors - backend handles these
          const errLower = (err.message || '').toLowerCase();
          const isIgnorableError = errLower.includes('nonce') ||
                                   errLower.includes('priority') ||
                                   errLower.includes('coalesce') ||
                                   errLower.includes('replacement') ||
                                   errLower.includes('game not active');
          if (isIgnorableError) return;
          toast.error(`Reveal error: ${err.message}`);
        }
      });
  }, [currentGame, address, revealedTiles, gameResult, txState]);

  // Cash out
  const cashOut = useCallback(async () => {
    if (!currentGame || !address) return;

    if (revealedTiles.size === 0) {
      toast.error('Reveal at least one tile first');
      return;
    }

    try {
      setTxState('cashing_out');

      const result = await minesApi.cashOut(currentGame.game_id);

      if (!result.success) {
        // Session expired
        if (result.needsSession) {
          setHasSession(false);
          toast.error('Session expired. Please sign in again.');
          setTxState('active');
          return;
        }
        throw new Error(result.error || 'Cashout failed');
      }

      toast.success('Cashing out...');

    } catch (err) {
      handleError(err, 'Cashout failed');
      setTxState('active');
    }
  }, [currentGame, address, revealedTiles]);

  // Fetch multipliers when grid/mine changes
  const fetchMultipliers = useCallback(async (gridSize, mineCount) => {
    try {
      const result = await minesApi.getMultipliers(gridSize, mineCount);
      if (result.success) {
        setMultipliers(result.multipliers.map(m => Number(m) / PRECISION));
      }
    } catch (err) {
      console.error('Error fetching multipliers:', err);
    }
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
              abi: MINES_ABI,
              data: log.data,
              topics: log.topics
            });

            if (decoded.eventName === 'GameStarted') {
              const gameId = decoded.args.gameId.toString();
              setTxState('waiting_vrf');
              toast.success('Game started! Waiting for VRF...');

              // Refresh balance after bet is placed
              refetchBalance?.();

              // Fetch game from backend
              const gameData = await minesApi.getGame(gameId);
              if (gameData.success) {
                setCurrentGame(gameData.game);
              }

              // Auto-create session if not exists
              if (!minesApi.hasValidSession(activeAddress)) {
                try {
                  if (!isUsingGameWallet) {
                    toast.loading('Please sign to authenticate...', { id: 'session' });
                  }
                  const signFn = isUsingGameWallet
                    ? async ({ message }) => await signWithGameWallet(message)
                    : async ({ message }) => await signMessageAsync({ message });
                  const result = await minesApi.createSession(signFn, activeAddress);
                  if (result.success) {
                    setHasSession(true);
                    toast.success('Session created!', { id: 'session' });
                  } else {
                    toast.error('Session failed - sign in manually', { id: 'session' });
                  }
                } catch (err) {
                  toast.dismiss('session');
                  // User rejected - they can sign in manually later
                }
              }
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

  // WebSocket for real-time updates
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    if (!MINES_WS_URL) return;

    const connect = () => {
      try {
        const ws = new WebSocket(MINES_WS_URL);

        ws.onopen = () => {
          wsRef.current = ws;

          // Subscribe to current game
          if (currentGame?.game_id) {
            ws.send(JSON.stringify({ type: 'subscribe', gameId: currentGame.game_id }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // VRF Received - game is now active
            if (data.event === 'vrfReceived' && currentGame?.game_id === data.gameId) {
              setTxState('active');
              toast.success('Game ready! Start revealing tiles.');
            }

            // Tile revealed
            if (data.event === 'tileRevealed' && currentGame?.game_id === data.gameId) {
              setRevealedTiles(prev => new Set([...prev, data.tileIndex]));
              setCurrentMultiplier(Number(data.newMultiplier) / PRECISION);
              setTxState('active');
              
              // Play gem sound based on gem count (adjacent mines)
              // Backend should provide gemCount, default to 0 if not available
              const gemCount = data.gemCount !== undefined ? data.gemCount : 0;
              if (gemCount === 0) {
                playSound('gem0');
              } else if (gemCount === 1) {
                playSound('gem1');
              } else {
                playSound('gem2'); // 2 or more gems
              }
            }

            // Mine hit
            if (data.event === 'mineHit' && currentGame?.game_id === data.gameId) {
              setMinePositions([data.tileIndex]);
              setGameResult({
                won: false,
                payout: '0',
                mineHitTile: data.tileIndex
              });
              setTxState('idle');
              // Play mine hit sound and lose sound
              playSound('mine');
              playSound('lose');
              toast.error('Mine hit! Game over.');
              // Refresh balance after game ends
              refetchBalance?.();
            }

            // Cash out success
            if (data.event === 'cashOut' && currentGame?.game_id === data.gameId) {
              setGameResult({
                won: true,
                payout: formatEther(BigInt(data.payout)),
                multiplier: Number(data.multiplier) / PRECISION
              });
              setTxState('idle');
              // Play win sound
              playSound('win');
              toast.success(`Won ${formatEther(BigInt(data.payout))} MON!`);
              // Refresh balance after payout
              refetchBalance?.();
            }

            // Game completed - includes finalSeed for mine position verification
            if (data.event === 'gameCompleted' && currentGame?.game_id === data.gameId) {
              if (data.finalSeed) {
                setFinalSeed(data.finalSeed);
                // Fetch mine positions with finalSeed
                fetchMinePositionsWithSeed(data.finalSeed);
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
  }, [currentGame?.game_id]);

  // Subscribe to game when it changes
  useEffect(() => {
    if (currentGame?.game_id && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', gameId: currentGame.game_id }));
    }
  }, [currentGame?.game_id]);

  // Poll game state when waiting for VRF (game becomes active via WebSocket, but fallback to polling)
  useEffect(() => {
    let interval;
    if (currentGame?.game_id && txState === 'waiting_vrf') {
      interval = setInterval(async () => {
        const result = await minesApi.getGame(currentGame.game_id);
        if (result.success && result.game?.phase === 'active') {
          setTxState('active');
          clearInterval(interval);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [currentGame?.game_id, txState]);

  // Fetch mine positions with finalSeed
  const fetchMinePositionsWithSeed = useCallback(async (seed) => {
    if (!currentGame?.game_id || !seed) return;

    try {
      // Call contract to get mine positions
      const positions = await publicClient.readContract({
        address: MINES_CONTRACT_ADDRESS,
        abi: MINES_ABI,
        functionName: 'getMinePositions',
        args: [BigInt(currentGame.game_id), seed]
      });

      setMinePositions(positions.map(p => Number(p)));
    } catch (err) {
      console.error('Error fetching mine positions:', err);
    }
  }, [currentGame?.game_id, publicClient]);

  // Check for active game on mount - uses activeAddress to support game wallet
  useEffect(() => {
    const checkActiveGame = async () => {
      if (!activeAddress) {
        setIsInitializing(false);
        return;
      }

      try {
        const result = await minesApi.getActiveGame(activeAddress);
        if (result.success && result.game) {
          setCurrentGame(result.game);

          // Restore revealed tiles
          if (result.game.revealed_tiles) {
            setRevealedTiles(new Set(result.game.revealed_tiles));
          }

          // Set multiplier
          if (result.game.current_multiplier) {
            setCurrentMultiplier(Number(result.game.current_multiplier) / PRECISION);
          }


          // Set state based on phase
          if (result.game.phase === 'waiting_vrf') {
            setTxState('waiting_vrf');
          } else if (result.game.phase === 'active') {
            setTxState('active');
          }

          // Fetch correct multipliers for this game's settings
          if (result.game.grid_size && result.game.mine_count) {
            fetchMultipliers(result.game.grid_size, result.game.mine_count);
          }
        }
      } catch (err) {
        console.error('Error checking active game:', err);
      } finally {
        setIsInitializing(false);
      }
    };

    checkActiveGame();
  }, [activeAddress, fetchMultipliers]);

  // Reset state
  const resetState = useCallback(() => {
    setTxState('idle');
    setTxHash(null);
    setCurrentGame(null);
    setGameResult(null);
    setRevealedTiles(new Set());
    setCurrentMultiplier(1);
    setMinePositions([]);
    setFinalSeed(null);
    setError(null);
    resetWrite?.();
  }, [resetWrite]);

  // Calculate potential payout
  const getPotentialPayout = useCallback((betAmount, multiplier) => {
    return (parseFloat(betAmount) * multiplier).toFixed(4);
  }, []);

  return {
    // Actions
    startGame,
    revealTile,
    cashOut,
    resetState,
    fetchMultipliers,
    createSession,

    // State
    txState,
    txHash,
    currentGame,
    gameResult,
    revealedTiles,
    currentMultiplier,
    minePositions,
    multipliers,
    error,
    hasSession,
    isInitializing,

    // Contract data
    minBet: minBet ? formatEther(minBet) : '10',
    maxBet: maxBet ? formatEther(maxBet) : '1000',
    entropyFee: entropyFee ? formatEther(entropyFee) : '0',

    // Helpers
    getPotentialPayout,
    isGameActive: txState === 'active',
    isWaitingVRF: txState === 'waiting_vrf',
    canReveal: txState === 'active' && hasSession,
    finalSeed,
    isUsingGameWallet
  };
};
