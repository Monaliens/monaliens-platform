import { useState, useCallback, useEffect, useRef } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount, usePublicClient, useSignMessage } from 'wagmi';
import { parseEther, formatEther, encodeFunctionData } from 'viem';
import toast from 'react-hot-toast';
import {
  BLACKJACK_CONTRACT_ADDRESS,
  BLACKJACK_ABI,
  BLACKJACK_WS_URL,
  BLACKJACK_API_URL,
  calculateHandTotal
} from '../utils/constants';
import { getEntropyFeeLimitWei } from '../../../utils/entropyFeeSettings';
import { startGame, getActiveGame, getVRFSeed, getGameState } from '../utils/blackjackApi';
import { playSound } from '../utils/audioManager';
import { useGameWallet } from '../../../context';

export const useBlackjack = ({ refetchBalance } = {}) => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { signMessageAsync } = useSignMessage();

  // Game Wallet integration
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

  // Active address: use game wallet when in game mode, otherwise main wallet
  const activeAddress = isUsingGameWallet && gameWalletAddress ? gameWalletAddress : address;

  // Game state
  const [gameId, setGameId] = useState(null);
  const [gamePhase, setGamePhase] = useState('initializing'); // initializing, idle, betting, waiting_vrf, player_turn, dealer_turn, completed
  const [vrfSeed, setVrfSeed] = useState(null);

  // Ref to track current gameId for WebSocket handler (avoids stale closure)
  const gameIdRef = useRef(null);

  // Auto-start ref
  const autoStartRef = useRef(false);
  const prevActiveAddressRef = useRef(activeAddress);

  // Reset game state when active wallet changes (for game wallet toggle)
  useEffect(() => {
    if (prevActiveAddressRef.current !== activeAddress && activeAddress) {
      // Wallet changed - reset everything to allow re-fetch
      autoStartRef.current = false;
      setGameId(null);
      setGamePhase('initializing');
      setVrfSeed(null);
      setPlayerHands([{ cards: [], status: 'active' }]);
      setActiveHandIndex(0);
      setDealerCards({ upCard: null, holeCard: null, hitCards: [] });
      setSessionToken(null);
      setCurrentBet('0');
      setTotalBet('0');
      setTxState('idle');
      setGameResult(null);
      setError(null);
    }
    prevActiveAddressRef.current = activeAddress;
  }, [activeAddress]);

  // Cards
  const [playerHands, setPlayerHands] = useState([{ cards: [], status: 'active' }]);
  const [activeHandIndex, setActiveHandIndex] = useState(0);
  const [dealerCards, setDealerCards] = useState({ upCard: null, holeCard: null, hitCards: [] });

  // Session token for gasless actions
  const [sessionToken, setSessionToken] = useState(null);

  // Betting
  const [currentBet, setCurrentBet] = useState('0');
  const [totalBet, setTotalBet] = useState('0');

  // UI state
  const [txState, setTxState] = useState('idle');
  const [txHash, setTxHash] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [error, setError] = useState(null);
  const [isDealing, setIsDealing] = useState(false);
  const [dealingToHandIndex, setDealingToHandIndex] = useState(null);

  // Insurance
  const [insuranceOffered, setInsuranceOffered] = useState(false);
  const [showInsurancePrompt, setShowInsurancePrompt] = useState(false);

  // ============ Animation Queue System ============
  const animationQueueRef = useRef([]);
  const isAnimatingRef = useRef(false);

  const processAnimationQueue = useCallback(() => {
    if (isAnimatingRef.current || animationQueueRef.current.length === 0) {
      return;
    }

    isAnimatingRef.current = true;
    const item = animationQueueRef.current.shift();


    // Execute the animation action
    item.action();

    // Wait for delay, then process next
    setTimeout(() => {
      isAnimatingRef.current = false;
      processAnimationQueue();
    }, item.delay || 400);
  }, []);

  const queueAnimation = useCallback((name, action, delay = 400) => {
    animationQueueRef.current.push({ name, action, delay });
    processAnimationQueue();
  }, [processAnimationQueue]);

  const clearAnimationQueue = useCallback(() => {
    animationQueueRef.current = [];
    isAnimatingRef.current = false;
  }, []);

  // Contract writes
  const { writeContract, data: writeData, error: writeError, reset: resetWrite } = useWriteContract();
  useWaitForTransactionReceipt({
    hash: writeData,
    enabled: !!writeData
  });

  // Contract reads - disabled polling to prevent RPC rate limiting
  const { data: minBetData } = useReadContract({
    address: BLACKJACK_CONTRACT_ADDRESS,
    abi: BLACKJACK_ABI,
    functionName: 'minBet',
    query: {
      staleTime: 60 * 60 * 1000, // 1 hour - these values rarely change
      refetchInterval: false
    }
  });

  const { data: maxBetData } = useReadContract({
    address: BLACKJACK_CONTRACT_ADDRESS,
    abi: BLACKJACK_ABI,
    functionName: 'maxBet',
    query: {
      staleTime: 60 * 60 * 1000,
      refetchInterval: false
    }
  });

  const { data: entropyFeeData, isError: entropyFeeError } = useReadContract({
    address: BLACKJACK_CONTRACT_ADDRESS,
    abi: BLACKJACK_ABI,
    functionName: 'getEntropyFee',
    query: {
      staleTime: 30 * 1000, // 30 seconds - entropy fee can change
      refetchInterval: false
    }
  });

  // Debug log for entropy fee
  useEffect(() => {
  }, [entropyFeeData, entropyFeeError]);

  // Keep gameIdRef in sync with gameId state
  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);

  // WebSocket ref
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isConnectingRef = useRef(false);

  // ============ WebSocket Connection ============
  useEffect(() => {
    let isMounted = true;
    let localWs = null;

    const connect = () => {
      // Prevent multiple simultaneous connections
      if (isConnectingRef.current || (wsRef.current?.readyState === WebSocket.OPEN)) {
        return;
      }

      isConnectingRef.current = true;

      try {
        localWs = new WebSocket(BLACKJACK_WS_URL);

        localWs.onopen = () => {
          if (!isMounted) {
            localWs.close();
            return;
          }

          wsRef.current = localWs;
          isConnectingRef.current = false;

          // Subscribe to player updates using active address (game wallet or main wallet)
          if (activeAddress) {
            localWs.send(JSON.stringify({ type: 'subscribePlayer', player: activeAddress }));
          }
          // Re-subscribe to active game if WS reconnected mid-game
          if (gameIdRef.current) {
            localWs.send(JSON.stringify({ type: 'subscribe', gameId: gameIdRef.current.toString() }));
          }
        };

        localWs.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
          } catch (err) {
            console.error('[BJ-WS] Parse error:', err);
          }
        };

        localWs.onclose = () => {
          isConnectingRef.current = false;
          if (isMounted && wsRef.current === localWs) {
            wsRef.current = null;
            reconnectTimeoutRef.current = setTimeout(connect, 2000);
          }
        };

        localWs.onerror = () => {
          isConnectingRef.current = false;
        };
      } catch (err) {
        isConnectingRef.current = false;
        console.error('[BJ-WS] Connection error:', err);
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (localWs) {
        localWs.close();
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      isConnectingRef.current = false;
    };
  }, [activeAddress]);

  // Subscribe to game when gameId changes
  useEffect(() => {
    if (gameId && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', gameId: gameId.toString() }));
    }
  }, [gameId]);

  // ============ WebSocket Message Handler ============
  const handleWebSocketMessage = useCallback((data) => {

    // Use ref for current gameId to avoid stale closure issues
    const currentGameId = gameIdRef.current;

    switch (data.event) {
      case 'gameStarted':
        if (data.player?.toLowerCase() === activeAddress?.toLowerCase()) {
          setGameId(data.gameId);
          setGamePhase('betting');
        }
        break;

      case 'betPlaced':
        if (data.gameId?.toString() === currentGameId?.toString()) {
          setGamePhase('waiting_vrf');
          setTxState('waiting_vrf');
          toast.success('Bet placed! Waiting for cards...');
          // Refresh balance after bet is placed
          refetchBalance?.();
        }
        break;

      case 'vrfReceived':
        if (data.gameId?.toString() === currentGameId?.toString()) {
          // VRF received, fetch seed from API
          getVRFSeed(data.gameId, activeAddress).then(result => {
            if (result.success && result.vrfSeed) {
              setVrfSeed(result.vrfSeed);
            }
          }).catch(err => console.error('[BJ] VRF seed fetch error:', err));
        }
        break;

      case 'initialCardsDealt':
        if (data.gameId?.toString() === currentGameId?.toString()) {
          // Clear any existing animations
          clearAnimationQueue();
          setIsDealing(true);

          // Fetch VRF seed immediately (needed for double/split)
          getVRFSeed(data.gameId, activeAddress).then(result => {
            if (result.success && result.vrfSeed) {
              setVrfSeed(result.vrfSeed);
            }
          }).catch(err => console.error('[BJ] VRF seed fetch error:', err));

          // Queue cards in casino order: Player1 -> Dealer Up -> Player2 -> Dealer Hole
          queueAnimation('player-card-1', () => {
            playSound('deal');
            setPlayerHands([{ cards: [data.playerCard1], status: 'active' }]);
          }, 500);

          queueAnimation('dealer-up-card', () => {
            playSound('deal');
            setDealerCards({ upCard: data.dealerUpCard, holeCard: null, hitCards: [] });
          }, 500);

          queueAnimation('player-card-2', () => {
            playSound('deal');
            setPlayerHands([{
              cards: [data.playerCard1, data.playerCard2],
              status: data.playerHasBlackjack ? 'blackjack' : 'active'
            }]);
          }, 500);

          queueAnimation('dealer-hole-card', () => {
            playSound('deal');
            setDealerCards(prev => ({ ...prev, holeCard: 'facedown' }));
          }, 500);

          queueAnimation('deal-complete', () => {
            setIsDealing(false);
            setGamePhase('player_turn');
            setTxState('idle');

            if (data.insuranceOffered) {
              setInsuranceOffered(true);
              setShowInsurancePrompt(true);
            }

            if (data.playerHasBlackjack) {
              playSound('win');
              toast.success('BLACKJACK!');
            }
          }, 100);
        }
        break;

      case 'playerHit':
        if (data.gameId?.toString() === currentGameId?.toString()) {
          // Step 1: Add the card (always as 'active' first so animation shows)
          queueAnimation('player-hit', () => {
            playSound('cardPlace');
            setIsDealing(true);
            setDealingToHandIndex(data.handIndex);
            setPlayerHands(prev => {
              const updated = [...prev];
              updated[data.handIndex] = {
                ...updated[data.handIndex],
                cards: [...updated[data.handIndex].cards, data.newCard],
                status: 'active' // Keep active while card animates in
              };
              return updated;
            });
          }, 400);

          // Step 2: Show the card for a moment
          queueAnimation('player-hit-show', () => {
            setIsDealing(false);
            setDealingToHandIndex(null);
          }, 1000); // Give time to see the card before bust

          // Step 3: Update status (bust or stay active)
          queueAnimation('player-hit-complete', () => {
            if (data.busted) {
              playSound('lose');
              setPlayerHands(prev => {
                const updated = [...prev];
                updated[data.handIndex] = {
                  ...updated[data.handIndex],
                  status: 'busted'
                };
                return updated;
              });
              toast.error(`Busted! (${data.newTotal})`);
            }
            // Update active hand index if provided (for split hands - move to next hand on bust)
            if (data.activeHandIndex !== undefined) {
              setActiveHandIndex(data.activeHandIndex);
            }
            setTxState('idle');
          }, 300);
        }
        break;

      case 'playerStand':
        if (data.gameId?.toString() === currentGameId?.toString()) {
          queueAnimation('player-stand', () => {
            setPlayerHands(prev => {
              const updated = [...prev];
              updated[data.handIndex] = {
                ...updated[data.handIndex],
                status: 'standing'
              };
              return updated;
            });
            // Update active hand index if provided (for split hands)
            if (data.activeHandIndex !== undefined) {
              setActiveHandIndex(data.activeHandIndex);
            }
            setTxState('idle');
          }, 100);
        }
        break;

      case 'playerDoubleDown':
        if (data.gameId?.toString() === currentGameId?.toString()) {
          // Step 1: Add the card (keep as active first)
          queueAnimation('player-double', () => {
            playSound('cardPlace');
            setIsDealing(true);
            setDealingToHandIndex(data.handIndex);
            setPlayerHands(prev => {
              const updated = [...prev];
              updated[data.handIndex] = {
                ...updated[data.handIndex],
                cards: [...updated[data.handIndex].cards, data.newCard],
                status: 'active' // Keep active while card animates
              };
              return updated;
            });
          }, 400);

          // Step 2: Show the card for a moment
          queueAnimation('player-double-show', () => {
            setIsDealing(false);
            setDealingToHandIndex(null);
          }, 1000); // Give time to see the card

          // Step 3: Update status (bust or standing)
          queueAnimation('player-double-complete', () => {
            if (data.busted) {
              playSound('lose');
            }
            setPlayerHands(prev => {
              const updated = [...prev];
              updated[data.handIndex] = {
                ...updated[data.handIndex],
                status: data.busted ? 'busted' : 'standing'
              };
              return updated;
            });
            // Update active hand index if provided (for split hands - move to next hand)
            if (data.activeHandIndex !== undefined) {
              setActiveHandIndex(data.activeHandIndex);
            }
            setTxState('idle');
            if (data.busted) {
              toast.error(`Busted! (${data.newTotal})`);
            }
          }, 300);
        }
        break;

      case 'playerSplit':
        if (data.gameId?.toString() === currentGameId?.toString()) {
          // Step 1: Split the pair into two hands (each with 1 card)
          queueAnimation('player-split-separate', () => {
            playSound('cardSplit');
            setPlayerHands(prev => {
              const card1 = prev[0].cards[0];
              return [
                { cards: [card1], status: 'active' },
                { cards: [card1], status: 'active' }
              ];
            });
            setActiveHandIndex(0);
          }, 400);

          // Step 2: Deal second card to hand 0
          queueAnimation('player-split-deal-hand0', () => {
            playSound('deal');
            setIsDealing(true);
            setDealingToHandIndex(0);
            setPlayerHands(prev => {
              const updated = [...prev];
              updated[0] = { ...updated[0], cards: [...updated[0].cards, data.hand0Card2] };
              return updated;
            });
          }, 500);

          queueAnimation('player-split-deal-hand0-done', () => {
            setIsDealing(false);
            setDealingToHandIndex(null);
          }, 200);

          // Step 3: Deal second card to hand 1
          queueAnimation('player-split-deal-hand1', () => {
            playSound('deal');
            setIsDealing(true);
            setDealingToHandIndex(1);
            setPlayerHands(prev => {
              const updated = [...prev];
              updated[1] = { ...updated[1], cards: [...updated[1].cards, data.hand1Card2] };
              return updated;
            });
          }, 500);

          queueAnimation('player-split-deal-hand1-done', () => {
            setIsDealing(false);
            setDealingToHandIndex(null);
            setTxState('idle');
          }, 200);
        }
        break;

      case 'playerSurrender':
        if (data.gameId?.toString() === currentGameId?.toString()) {
          queueAnimation('player-surrender', () => {
            setPlayerHands(prev => {
              const updated = [...prev];
              updated[0] = { ...updated[0], status: 'surrendered' };
              return updated;
            });
            toast('Surrendered - half bet returned');
          }, 100);
        }
        break;

      case 'dealerTurnStarted':
        if (data.gameId?.toString() === currentGameId?.toString()) {
          queueAnimation('dealer-turn-start', () => {
            setGamePhase('dealer_turn');
          }, 300);

          // Reveal hole card with flip animation
          // Note: cardFlip sound is played here, not in holeCardRevealed to avoid duplicate
          if (data.holeCard) {
            queueAnimation('dealer-hole-reveal', () => {
              playSound('cardFlip');
              setDealerCards(prev => ({ ...prev, holeCard: data.holeCard }));
            }, 600);
          }
        }
        break;

      case 'dealerCardRevealed':
        if (data.gameId?.toString() === currentGameId?.toString()) {
          // Dealer draws a card - add to hitCards
          if (data.card && data.card > 0) {
            queueAnimation(`dealer-hit-${data.card}`, () => {
              playSound('cardPlace');
              setIsDealing(true);
              setDealerCards(prev => ({
                ...prev,
                hitCards: [...prev.hitCards, data.card]
              }));
            }, 500);

            queueAnimation(`dealer-hit-${data.card}-done`, () => {
              setIsDealing(false);
            }, 100);
          }
        }
        break;

      case 'insuranceTaken':
        if (data.gameId?.toString() === currentGameId?.toString()) {
          setInsuranceOffered(false);
          setShowInsurancePrompt(false);
          setTxState('idle');
          toast.success('Insurance taken');
        }
        break;

      case 'insuranceDeclined':
        if (data.gameId?.toString() === currentGameId?.toString()) {
          setInsuranceOffered(false);
          setShowInsurancePrompt(false);
          setTxState('idle');
        }
        break;

      case 'holeCardRevealed':
        if (data.gameId?.toString() === currentGameId?.toString()) {
          // Reveal dealer's hole card (only if not already revealed by dealerTurnStarted)
          // Sound is NOT played here to avoid duplicate with dealerTurnStarted
          queueAnimation('hole-card-reveal', () => {
            setDealerCards(prev => {
              // Only update if not already revealed
              if (prev.holeCard === 'facedown' || prev.holeCard === null) {
                playSound('cardFlip');
                return { ...prev, holeCard: data.holeCard };
              }
              return prev;
            });
          }, 500);

          // If dealer has blackjack, game ends immediately
          // Note: lose sound will be played by gameCompleted event
          if (data.dealerHasBlackjack) {
            queueAnimation('dealer-blackjack', () => {
              setGamePhase('completed');
              setTxState('idle');
              toast.error('Dealer Blackjack!');
            }, 800);
          }
        }
        break;

      case 'gameCompleted':
        if (data.gameId?.toString() === currentGameId?.toString()) {
          // Delay before queueing to let other events (playerHit, dealerCard) arrive first
          // Events can arrive out of order via WebSocket
          setTimeout(() => {
            queueAnimation('game-complete', () => {
              const won = parseFloat(data.totalPayoutEther) > parseFloat(formatEther(BigInt(totalBet || '0')));
              const push = data.totalPayoutEther === formatEther(BigInt(totalBet || '0'));

              // Play win/lose sound
              if (won) {
                playSound('win');
              } else if (!push) {
                playSound('lose');
              }

              setGameResult({
                gameId: data.gameId,
                totalBet: data.totalBetEther,
                totalPayout: data.totalPayoutEther,
                won,
                push,
                result: data.result
              });

              setGamePhase('completed');
              setTxState('idle');
              // Refresh balance after game completed
              refetchBalance?.();

              if (won) {
                toast(`Won ${data.totalPayoutEther} MON`);
              } else if (push) {
                toast('Draw');
              } else {
                toast('Lost');
              }
            }, 1500);
          }, 500); // Wait 500ms before adding to queue
        }
        break;
    }
  }, [activeAddress, totalBet, queueAnimation, clearAnimationQueue, refetchBalance]);

  // ============ Fetch VRF Seed ============
  const fetchVRFSeed = useCallback(async (gId) => {
    if (!activeAddress) return;

    try {
      const result = await getVRFSeed(gId, activeAddress);
      if (result.success && result.vrfSeed) {
        setVrfSeed(result.vrfSeed);
      }
    } catch (err) {
      console.error('Error fetching VRF seed:', err);
    }
  }, [activeAddress]);

  // ============ Auto-init: Check for active game or start new one ============
  useEffect(() => {
    if (!activeAddress) {
      setGamePhase('idle'); // No wallet, show connect message
      return;
    }

    if (autoStartRef.current) return;

    const initGame = async () => {
      autoStartRef.current = true;
      setGamePhase('initializing');

      try {
        const result = await getActiveGame(activeAddress);

        if (result.success && result.hasActiveGame && result.game) {
          const game = result.game;

          // Restore game state
          setGameId(game.gameId);
          setCurrentBet(game.totalBet?.ether || '0');
          setTotalBet(game.totalBet?.wei || '0');

          // Map backend phase to frontend phase
          const phaseMap = {
            'waiting_bet': 'betting',
            'waiting_vrf': 'waiting_vrf',
            'player_turn': 'player_turn',
            'dealer_turn': 'dealer_turn',
            'completed': 'completed'
          };
          setGamePhase(phaseMap[game.phase] || game.phase);

          // Restore cards
          if (game.playerHands && game.playerHands.length > 0) {
            setPlayerHands(game.playerHands.map(h => ({
              cards: h.cards || [],
              status: h.status || 'active'
            })));
          }

          if (game.dealerUpCard) {
            setDealerCards({
              upCard: game.dealerUpCard,
              holeCard: game.phase === 'dealer_turn' || game.phase === 'completed' ? (game.dealerHoleCard || 'facedown') : 'facedown',
              hitCards: game.dealerHitCards || []
            });
          }

          // Fetch VRF seed if needed
          if (game.vrfReceived) {
            fetchVRFSeed(game.gameId);
          }

          // If game completed, allow new game start (auto-restart will handle it)
          if (game.phase === 'completed') {
            autoStartRef.current = false;
          }

          return;
        }

        // No active game, start new one automatically
        const startResult = await startGame(activeAddress);

        if (startResult.success) {
          setGameId(startResult.gameId);
          setGamePhase('betting');
          autoStartRef.current = false;
        } else {
          console.error('[BJ] Failed to start game:', startResult.error);
          setGamePhase('idle'); // Show Start Game button as fallback
          autoStartRef.current = false;
        }

      } catch (err) {
        console.error('[BJ] Init game error:', err);
        setGamePhase('idle'); // Show Start Game button as fallback
        autoStartRef.current = false;
      }
    };

    // Small delay to ensure wallet is ready
    const timer = setTimeout(initGame, 300);
    return () => clearTimeout(timer);
  }, [activeAddress, fetchVRFSeed]);

  // ============ Start New Game ============
  const startNewGame = useCallback(async () => {
    if (!activeAddress) {
      toast.error('Please connect wallet');
      return;
    }

    try {
      setTxState('starting');
      setError(null);

      // Clear previous game state immediately for responsive UI
      clearAnimationQueue();
      setVrfSeed(null);
      setPlayerHands([{ cards: [], status: 'active' }]);
      setActiveHandIndex(0);
      setDealerCards({ upCard: null, holeCard: null, hitCards: [] });
      setCurrentBet('0');
      setTotalBet('0');
      setGameResult(null);
      setInsuranceOffered(false);
      setShowInsurancePrompt(false);
      setGamePhase('betting');
      autoStartRef.current = false;

      // Now start the game on backend (this takes ~0.5s)
      const result = await startGame(activeAddress);

      if (result.success) {
        setGameId(result.gameId);
        setTxState('idle');
      } else {
        throw new Error(result.error || 'Failed to start game');
      }
    } catch (err) {
      console.error('[BJ] startNewGame error:', err);
      setError(err.message);
      setGamePhase('idle');
      setTxState('idle');
      toast.error(err.message);
    }
  }, [activeAddress, clearAnimationQueue]);

  // ============ Place Bet ============
  const placeBet = useCallback(async (betAmount) => {
    if (!activeAddress || !gameId) {
      toast.error('No active game');
      return;
    }

    if (!entropyFeeData) {
      toast.error('Loading entropy fee, please wait...');
      return;
    }

    // Check if entropy fee exceeds user's custom limit
    const maxEntropyFee = getEntropyFeeLimitWei();
    if (entropyFeeData > maxEntropyFee) {
      toast.error('Fee exceeds your limit! Adjust in settings or try later.');
      return;
    }

    try {
      setTxState('betting');
      setError(null);

      const betAmountWei = parseEther(betAmount.toString());

      // Read FRESH entropy fee from contract right before tx
      // Pyth entropy fee is dynamic and can change between reads
      const freshEntropyFee = await publicClient.readContract({
        address: BLACKJACK_CONTRACT_ADDRESS,
        abi: BLACKJACK_ABI,
        functionName: 'getEntropyFee'
      });

      // Check fresh fee too
      if (freshEntropyFee > maxEntropyFee) {
        toast.error('Fee is too high! Try again later.');
        setTxState('idle');
        return;
      }

      const totalValue = betAmountWei + freshEntropyFee;

      setCurrentBet(betAmount);
      setTotalBet(betAmountWei.toString());

      // ===== GAME WALLET MODE =====
      if (isUsingGameWallet) {
        // Check if game wallet can afford the bet + fees + reserve
        const entropyFeeInMon = parseFloat(formatEther(freshEntropyFee));
        const totalNeeded = parseFloat(betAmount) + entropyFeeInMon;
        if (!canAfford(totalNeeded)) {
          const shortage = getShortage(totalNeeded);
          toast.error(`Insufficient game wallet balance! Need ${(totalNeeded + GAS_RESERVE).toFixed(2)} MON (including ${GAS_RESERVE} MON reserve). Short by ${shortage.toFixed(2)} MON.`);
          setTxState('idle');
          return;
        }

        try {
          // Encode function call
          const data = encodeFunctionData({
            abi: BLACKJACK_ABI,
            functionName: 'placeBet',
            args: [BigInt(gameId)]
          });

          // Send via game wallet (signless!)
          const { hash } = await gameWalletSendTx({
            to: BLACKJACK_CONTRACT_ADDRESS,
            value: totalValue,
            data
          });

          setTxHash(hash);
          setGamePhase('waiting_vrf');
          setTxState('waiting_vrf');
          toast.success('Bet placed! Waiting for cards...');

          // Refresh game wallet balance
          refreshGameBalance?.();
          refetchBalance?.();

        } catch (err) {
          if (err.message?.includes('rejected') || err.message?.includes('denied')) {
            setError('Transaction rejected');
            setTxState('idle');
            toast.error('Transaction rejected');
          } else {
            setError(err.message);
            setTxState('idle');
            toast.error('Failed to place bet: ' + err.message);
          }
        }
        return;
      }

      // ===== MAIN WALLET MODE (existing flow) =====
      writeContract({
        address: BLACKJACK_CONTRACT_ADDRESS,
        abi: BLACKJACK_ABI,
        functionName: 'placeBet',
        args: [BigInt(gameId)],
        value: totalValue
      });
    } catch (err) {
      setError(err.message);
      setTxState('idle');
      toast.error('Failed to place bet');
    }
  }, [activeAddress, gameId, entropyFeeData, writeContract, publicClient, isUsingGameWallet, gameWalletSendTx, refreshGameBalance, refetchBalance, canAfford, getShortage, GAS_RESERVE]);

  // ============ Session Token (Sign Once, Play ALL Games) ============
  // Session token - signed by whichever wallet is active (main or game)
  const getSessionToken = useCallback(async () => {
    if (!activeAddress) return null;

    try {
      // Create message for player session (not game-specific!)
      const timestamp = Math.floor(Date.now() / 1000);
      const message = JSON.stringify({
        type: 'blackjack-session',
        player: activeAddress.toLowerCase(),
        timestamp,
        chainId: 143
      });

      // Sign with active wallet (game wallet if in game mode, main wallet otherwise)
      let signature;
      if (isUsingGameWallet) {
        // Use game wallet to sign (signless - no popup!)
        signature = await signWithGameWallet(message);
      } else {
        // Use main wallet to sign (requires user approval)
        signature = await signMessageAsync({ message });
      }

      // Get session token from backend
      const response = await fetch(`${BLACKJACK_API_URL}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature, timestamp, player: activeAddress })
      });

      const result = await response.json();

      if (result.success) {
        setSessionToken(result.token);
        return result.token;
      } else {
        throw new Error(result.error || 'Failed to get session');
      }
    } catch (err) {
      console.error('[BJ] Session error:', err);

      // Signature timestamp was rejected by backend — sign again immediately with fresh timestamp
      if (err.message?.includes('expired') || err.message?.includes('Signature expired')) {
        toast.loading('Re-signing session...', { id: 'bj-session-retry' });
        try {
          const timestamp = Math.floor(Date.now() / 1000);
          const message = JSON.stringify({
            type: 'blackjack-session',
            player: activeAddress.toLowerCase(),
            timestamp,
            chainId: 143
          });
          const signature = isUsingGameWallet
            ? await signWithGameWallet(message)
            : await signMessageAsync({ message });

          const retryResponse = await fetch(`${BLACKJACK_API_URL}/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signature, timestamp, player: activeAddress })
          });
          const retryResult = await retryResponse.json();
          toast.dismiss('bj-session-retry');
          if (retryResult.success) {
            setSessionToken(retryResult.token);
            return retryResult.token;
          }
        } catch (retryErr) {
          toast.dismiss('bj-session-retry');
          if (retryErr.message?.includes('User rejected')) {
            toast.error('Please sign to authorize game actions');
          }
        }
        return null;
      }

      if (err.message?.includes('User rejected')) {
        toast.error('Please sign to authorize game actions');
      }
      return null;
    }
  }, [activeAddress, isUsingGameWallet, signWithGameWallet, signMessageAsync]);

  // ============ Player Actions (Gasless via Relayer) ============

  // Helper function for gasless actions (uses session token)
  const executeGaslessAction = useCallback(async (action) => {
    if (!gameId || !activeAddress) {
      toast.error('No active game');
      return false;
    }

    // Get session token if we don't have one
    let token = sessionToken;
    if (!token) {
      token = await getSessionToken();
      if (!token) {
        return false; // User cancelled or error
      }
    }

    try {
      // Send action with session token (no signature needed!)
      const response = await fetch(`${BLACKJACK_API_URL}/game/${gameId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': token
        },
        body: JSON.stringify({ action })
      });

      const result = await response.json();

      // Token expired - get new one and retry
      if (response.status === 401 && result.error?.includes('expired')) {
        setSessionToken(null);
        const newToken = await getSessionToken();
        if (!newToken) return false;

        // Retry with new token
        const retryResponse = await fetch(`${BLACKJACK_API_URL}/game/${gameId}/action`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': newToken
          },
          body: JSON.stringify({ action })
        });

        const retryResult = await retryResponse.json();
        if (!retryResult.success) {
          throw new Error(retryResult.error || 'Action failed');
        }
        return true;
      }

      if (!result.success) {
        throw new Error(result.error || 'Action failed');
      }

      return true;
    } catch (err) {
      console.error(`[BJ] ${action} error:`, err);
      toast.error(err.message || `${action} failed`);

      // Sync state on error - game might be in different phase on-chain
      try {
        const stateResult = await getGameState(gameId);
        if (stateResult.success && stateResult.data) {
          const onChainPhase = stateResult.data.phase;

          if (onChainPhase === 5) {
            setGamePhase('completed');
          } else if (onChainPhase === 4) {
            setGamePhase('dealer_turn');
          } else if (onChainPhase === 3) {
            if (stateResult.data.activeHandIndex !== undefined) {
              setActiveHandIndex(stateResult.data.activeHandIndex);
            }
            if (stateResult.data.playerHands?.length > 0) {
              setPlayerHands(stateResult.data.playerHands.map(h => ({
                cards: h.cards || [],
                status: h.status || 'active'
              })));
            }
          } else if (onChainPhase === 1) {
            setGamePhase('betting');
          }
        }
      } catch (syncErr) {
        console.error('[BJ] Error recovery sync failed:', syncErr);
      }

      return false;
    }
  }, [gameId, activeAddress, sessionToken, getSessionToken]);

  const hit = useCallback(async () => {
    if (!gameId) {
      toast.error('Game not ready');
      return;
    }

    setTxState('hitting');
    const success = await executeGaslessAction('hit');
    if (!success) {
      setTxState('idle');
    }
    // WebSocket will update state on success
  }, [gameId, executeGaslessAction]);

  const stand = useCallback(async () => {
    if (!gameId) {
      toast.error('No active game');
      return;
    }

    setTxState('standing');
    const success = await executeGaslessAction('stand');
    if (!success) {
      setTxState('idle');
    }
    // WebSocket will update state on success
  }, [gameId, executeGaslessAction]);

  const doubleDown = useCallback(async () => {
    if (!gameId) {
      toast.error('No active game');
      return;
    }

    try {
      setTxState('doubling');

      // Read hand.betAmount directly from contract for the ACTIVE hand
      const handData = await publicClient.readContract({
        address: BLACKJACK_CONTRACT_ADDRESS,
        abi: BLACKJACK_ABI,
        functionName: 'getHand',
        args: [BigInt(gameId), activeHandIndex]
      });

      const handBetAmount = handData[1]; // betAmount is second return value

      // ===== GAME WALLET MODE =====
      if (isUsingGameWallet) {
        try {
          const data = encodeFunctionData({
            abi: BLACKJACK_ABI,
            functionName: 'requestDoubleDown',
            args: [BigInt(gameId)]
          });

          await gameWalletSendTx({
            to: BLACKJACK_CONTRACT_ADDRESS,
            value: handBetAmount,
            data
          });

          refreshGameBalance?.();
          refetchBalance?.();
        } catch (err) {
          console.error('[BJ] DoubleDown error:', err);
          setTxState('idle');
          toast.error('Double down failed: ' + err.message);
        }
        return;
      }

      // ===== MAIN WALLET MODE =====
      // Request double down - player pays, relayer will execute with card
      writeContract({
        address: BLACKJACK_CONTRACT_ADDRESS,
        abi: BLACKJACK_ABI,
        functionName: 'requestDoubleDown',
        args: [BigInt(gameId)],
        value: handBetAmount
      });
    } catch (err) {
      console.error('[BJ] DoubleDown error:', err);
      setTxState('idle');
      toast.error('Double down failed');
    }
  }, [gameId, activeHandIndex, writeContract, publicClient, isUsingGameWallet, gameWalletSendTx, refreshGameBalance, refetchBalance]);

  const split = useCallback(async () => {
    if (!gameId) {
      toast.error('No active game');
      return;
    }

    try {
      setTxState('splitting');

      // Read hand.betAmount directly from contract to ensure exact match
      const handData = await publicClient.readContract({
        address: BLACKJACK_CONTRACT_ADDRESS,
        abi: BLACKJACK_ABI,
        functionName: 'getHand',
        args: [BigInt(gameId), 0]
      });

      const handBetAmount = handData[1]; // betAmount is second return value

      // ===== GAME WALLET MODE =====
      if (isUsingGameWallet) {
        try {
          const data = encodeFunctionData({
            abi: BLACKJACK_ABI,
            functionName: 'requestSplit',
            args: [BigInt(gameId)]
          });

          await gameWalletSendTx({
            to: BLACKJACK_CONTRACT_ADDRESS,
            value: handBetAmount,
            data
          });

          refreshGameBalance?.();
          refetchBalance?.();
        } catch (err) {
          console.error('[BJ] Split error:', err);
          setTxState('idle');
          toast.error('Split failed: ' + err.message);
        }
        return;
      }

      // ===== MAIN WALLET MODE =====
      // Request split - player pays, relayer will execute with cards
      writeContract({
        address: BLACKJACK_CONTRACT_ADDRESS,
        abi: BLACKJACK_ABI,
        functionName: 'requestSplit',
        args: [BigInt(gameId)],
        value: handBetAmount
      });
    } catch (err) {
      console.error('[BJ] Split error:', err);
      setTxState('idle');
      toast.error('Split failed');
    }
  }, [gameId, writeContract, publicClient, isUsingGameWallet, gameWalletSendTx, refreshGameBalance, refetchBalance]);

  const surrender = useCallback(async () => {
    if (!gameId) {
      toast.error('No active game');
      return;
    }

    setTxState('surrendering');
    const success = await executeGaslessAction('surrender');
    if (!success) {
      setTxState('idle');
    }
    // WebSocket will update state on success
  }, [gameId, executeGaslessAction]);

  const takeInsurance = useCallback(async () => {
    if (!gameId) return;

    try {
      setTxState('insurance');
      const insuranceAmount = parseEther((parseFloat(currentBet) / 2).toString());

      // ===== GAME WALLET MODE =====
      if (isUsingGameWallet) {
        try {
          const data = encodeFunctionData({
            abi: BLACKJACK_ABI,
            functionName: 'takeInsurance',
            args: [BigInt(gameId)]
          });

          await gameWalletSendTx({
            to: BLACKJACK_CONTRACT_ADDRESS,
            value: insuranceAmount,
            data
          });

          setShowInsurancePrompt(false);
          refreshGameBalance?.();
          refetchBalance?.();
        } catch (err) {
          console.error('[BJ] Insurance error:', err);
          setTxState('idle');
          toast.error('Insurance failed: ' + err.message);
        }
        return;
      }

      // ===== MAIN WALLET MODE =====
      writeContract({
        address: BLACKJACK_CONTRACT_ADDRESS,
        abi: BLACKJACK_ABI,
        functionName: 'takeInsurance',
        args: [BigInt(gameId)],
        value: insuranceAmount
      });
      setShowInsurancePrompt(false);
    } catch (err) {
      setTxState('idle');
      toast.error('Insurance failed');
    }
  }, [gameId, currentBet, writeContract, isUsingGameWallet, gameWalletSendTx, refreshGameBalance, refetchBalance]);

  const declineInsurance = useCallback(async () => {
    if (!gameId) return;

    setShowInsurancePrompt(false);
    setTxState('insurance');

    const success = await executeGaslessAction('declineInsurance');
    if (success) {
      setInsuranceOffered(false);
    }
    setTxState('idle');
  }, [gameId, executeGaslessAction]);

  // ============ Reset State ============
  const resetGame = useCallback(() => {
    clearAnimationQueue();
    setGameId(null);
    setGamePhase('idle');
    setVrfSeed(null);
    setPlayerHands([{ cards: [], status: 'active' }]);
    setActiveHandIndex(0);
    setDealerCards({ upCard: null, holeCard: null, hitCards: [] });
    setCurrentBet('0');
    setTotalBet('0');
    setTxState('idle');
    setTxHash(null);
    setGameResult(null);
    setError(null);
    setInsuranceOffered(false);
    setShowInsurancePrompt(false);
    // NOTE: Don't clear sessionToken - it's per-player, valid for 1 hour across all games
    autoStartRef.current = false; // Allow auto-start for new game
    resetWrite?.();
  }, [resetWrite, clearAnimationQueue]);

  // ============ Auto-restart after game completion ============
  useEffect(() => {
    if (gamePhase !== 'completed' || !activeAddress) return;

    // Wait 3 seconds for result to be visible, then start new game
    const timer = setTimeout(async () => {

      try {
        const result = await startGame(activeAddress);

        if (result.success) {
          // Only reset AFTER we have a new game
          clearAnimationQueue();
          setVrfSeed(null);
          setPlayerHands([{ cards: [], status: 'active' }]);
          setActiveHandIndex(0);
          setDealerCards({ upCard: null, holeCard: null, hitCards: [] });
          setCurrentBet('0');
          setTotalBet('0');
          setTxState('idle');
          setTxHash(null);
          setGameResult(null);
          setError(null);
          setInsuranceOffered(false);
          setShowInsurancePrompt(false);

          // Set new game
          setGameId(result.gameId);
          setGamePhase('betting');
          autoStartRef.current = false;
        } else {
          console.error('[BJ] Auto-restart failed:', result.error);
          // Keep completed state, user can click Play Again
        }
      } catch (err) {
        console.error('[BJ] Auto-restart error:', err);
        // Keep completed state, user can click Play Again
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [gamePhase, activeAddress, clearAnimationQueue]);

  // ============ Process Transaction ============
  useEffect(() => {
    if (writeData) {
      setTxHash(writeData);
    }
  }, [writeData]);

  useEffect(() => {
    if (writeError) {
      setTxState('idle');
      toast.error(writeError.shortMessage || 'Transaction failed');
    }
  }, [writeError]);


  // ============ Computed Values ============
  const canHit = gamePhase === 'player_turn' && playerHands[activeHandIndex]?.status === 'active' && txState === 'idle';
  const canStand = gamePhase === 'player_turn' && playerHands[activeHandIndex]?.status === 'active' && txState === 'idle';
  const canDoubleDown = gamePhase === 'player_turn' && playerHands[activeHandIndex]?.cards?.length === 2 && txState === 'idle';
  const canSplit = gamePhase === 'player_turn' &&
    playerHands.length === 1 &&
    playerHands[0]?.cards?.length === 2 &&
    playerHands[0]?.cards[0] === playerHands[0]?.cards[1] &&
    txState === 'idle';
  const canSurrender = gamePhase === 'player_turn' && playerHands[0]?.cards?.length === 2 && !playerHands[0]?.fromSplit && txState === 'idle';

  const playerTotal = calculateHandTotal(playerHands[activeHandIndex]?.cards || []);
  const dealerTotal = calculateHandTotal([
    dealerCards.upCard,
    ...(dealerCards.holeCard && dealerCards.holeCard !== 'facedown' ? [dealerCards.holeCard] : []),
    ...dealerCards.hitCards
  ].filter(Boolean));

  return {
    // State
    gameId,
    gamePhase,
    playerHands,
    activeHandIndex,
    dealerCards,
    currentBet,
    totalBet,
    txState,
    txHash,
    gameResult,
    error,
    isDealing,
    dealingToHandIndex,
    vrfSeed,
    insuranceOffered,
    showInsurancePrompt,

    // Computed
    playerTotal,
    dealerTotal,
    canHit,
    canStand,
    canDoubleDown,
    canSplit,
    canSurrender,

    // Contract data
    minBet: minBetData ? formatEther(minBetData) : '25',
    maxBet: maxBetData ? formatEther(maxBetData) : '2500',
    entropyFee: entropyFeeData ? formatEther(entropyFeeData) : '0',

    // Game Wallet
    isUsingGameWallet,

    // Actions
    startNewGame,
    placeBet,
    hit,
    stand,
    doubleDown,
    split,
    surrender,
    takeInsurance,
    declineInsurance,
    resetGame
  };
};

export default useBlackjack;
