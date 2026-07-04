import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { getUserGames, getRecentGames } from '../utils/blackjackApi';
import { getCardDisplay, BLACKJACK_WS_URL, calculateHandTotal } from '../utils/constants';
import { useGameWallet } from '../../../context';
import HistoryAddressSearch from '../../common/HistoryAddressSearch';
import { useHistoryFetchLoading } from '../../../hooks/useHistoryFetchLoading';
import { useCompactHistoryTabs, historyTabLabel } from '../../../hooks/useIsMobile';

const MONVISION_TX_URL = 'https://monadvision.com/tx/';
const MONVISION_ADDRESS_URL = 'https://monadvision.com/address/';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
  background: var(--bg-card);
  border: 2px solid var(--border-color);
  border-radius: 20px;
  padding: 1.5rem;
  margin-top: 2rem;
  box-shadow: 0 8px 25px var(--shadow-color);
  animation: ${fadeIn} 0.6s ease-out;
  transition: background-color 0.3s ease, border-color 0.3s ease;

  @media (max-width: 768px) {
    padding: 1rem;
    border-radius: 16px;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const Title = styled.h2`
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
`;

const TabContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    width: 100%;
    display: flex;
    justify-content: flex-start;
    flex-wrap: nowrap;
    gap: 0.45rem;

    > :last-child {
      margin-left: auto;
    }
  }

  @media (max-width: 420px) {
    gap: 0.35rem;
  }
`;

const Tab = styled.button.attrs({ type: 'button' })`
  padding: 0.5rem 1rem;
  border: 2px solid var(--border-light);
  border-radius: 8px;
  background: transparent;
  color: var(--accent-primary);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
  box-shadow: none;

  ${props => props.$active && `
    border-color: var(--accent-primary);
    background: linear-gradient(135deg, var(--accent-primary) 0%, #8e44ad 100%);
    color: white;
  `}

  &:hover {
    border-color: var(--accent-primary);
  }

  &:hover:not([data-active='true']) {
    background: rgba(124, 58, 237, 0.08);
  }

  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: 2px solid var(--accent-primary);
    outline-offset: 2px;
  }

  @media (max-width: 768px) {
    min-width: ${props => props.$searchOpen ? '72px' : '118px'};
    padding: 0.5rem ${props => props.$searchOpen ? '0.55rem' : '0.7rem'};
    font-size: 0.8rem;
    white-space: nowrap;
  }

  @media (max-width: 420px) {
    min-width: ${props => props.$searchOpen ? '58px' : '98px'};
    font-size: 0.72rem;
    padding: 0.45rem ${props => props.$searchOpen ? '0.55rem' : '0.6rem'};
  }
`;

const DESKTOP_GRID = 'minmax(88px, 1fr) minmax(148px, 1.55fr) minmax(56px, 0.85fr) minmax(72px, 0.85fr) minmax(72px, 0.85fr) 56px';
const MOBILE_GRID = 'minmax(0, 0.95fr) minmax(0, 1.55fr) minmax(0, 0.8fr) minmax(0, 0.9fr) 52px';

const Table = styled.div`
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
`;

const TableHeader = styled.div`
  display: grid;
  grid-template-columns: ${DESKTOP_GRID};
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--table-header-bg);
  border-radius: 8px;
  margin-bottom: 0.5rem;
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;

  @media (max-width: 768px) {
    display: none;
  }
`;

const TableRow = styled.div`
  display: grid;
  grid-template-columns: ${DESKTOP_GRID};
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid var(--divider-color);
  font-size: 0.9rem;
  align-items: center;
  transition: background 0.2s ease;
  color: var(--text-primary);

  &:hover {
    background: var(--table-row-hover);
  }

  &:last-child {
    border-bottom: none;
  }

  @media (max-width: 768px) {
    grid-template-columns: ${MOBILE_GRID};
    font-size: 0.8rem;
    gap: 0.4rem;
    padding: 0.65rem 0.5rem;
  }
`;

const Cell = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;

  @media (max-width: 768px) {
    &.hide-mobile {
      display: none;
    }

    &.align-end {
      justify-content: flex-end;
      text-align: right;
    }
  }
`;

const CardDisplay = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 32px;
  background: var(--bg-glass);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-weight: 700;
  font-size: 0.72rem;
  color: var(--text-primary);

  @media (max-width: 768px) {
    width: 22px;
    height: 30px;
    font-size: 0.68rem;
  }
`;

const CardsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  min-width: 0;
`;

const HandRow = styled.div`
  display: grid;
  grid-template-columns: 14px repeat(5, 24px) 26px;
  gap: 3px;
  align-items: center;
  width: fit-content;
  max-width: 100%;

  @media (max-width: 768px) {
    grid-template-columns: 12px repeat(5, 20px) 22px;
    gap: 2px;
  }
`;

const MoreCardsBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 32px;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--table-header-bg);
  border: 1px dashed var(--border-color);
  font-size: 0.62rem;
  font-weight: 700;
  color: var(--text-secondary);

  @media (max-width: 768px) {
    min-width: 22px;
    height: 30px;
    font-size: 0.58rem;
  }
`;

const HandLabel = styled.span`
  font-size: 0.65rem;
  font-weight: 600;
  color: ${props => props.$isDealer ? 'var(--accent-red)' : 'var(--accent-green)'};
  min-width: 14px;
  text-transform: uppercase;
`;

const ResultBadge = styled.span`
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.75rem;
  background: ${props => {
    if (props.$result === 'win' || props.$result === 'blackjack') return 'rgba(16, 185, 129, 0.1)';
    if (props.$result === 'lose') return 'rgba(239, 68, 68, 0.1)';
    return 'rgba(107, 114, 128, 0.1)';
  }};
  color: ${props => {
    if (props.$result === 'win' || props.$result === 'blackjack') return 'var(--accent-green)';
    if (props.$result === 'lose') return 'var(--accent-red)';
    return 'var(--text-secondary)';
  }};
`;

const TxLink = styled.a`
  color: var(--accent-primary);
  text-decoration: none;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: monospace;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }

  &::after {
    content: '↗';
    font-size: 0.7rem;
    flex-shrink: 0;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
`;

const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
`;

const SkeletonRow = styled.div`
  display: grid;
  grid-template-columns: ${DESKTOP_GRID};
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid var(--divider-color);

  @media (max-width: 768px) {
    grid-template-columns: ${MOBILE_GRID};
    gap: 0.4rem;
    padding: 0.65rem 0.5rem;
  }
`;

const SkeletonCell = styled.div`
  height: ${props => props.$height || '20px'};
  width: ${props => props.$width || '100%'};
  background: linear-gradient(90deg, var(--table-header-bg) 25%, var(--border-light) 50%, var(--table-header-bg) 75%);
  background-size: 200px 100%;
  animation: ${shimmer} 1.5s infinite;
  border-radius: 4px;
`;

const PaginationContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-light);
`;

const PaginationButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 2px solid ${props => props.disabled ? 'rgba(107, 114, 128, 0.3)' : 'var(--border-light)'};
  border-radius: 8px;
  background: ${props => props.disabled ? 'transparent' : 'var(--bg-card)'};
  color: ${props => props.disabled ? 'var(--text-tertiary)' : 'var(--accent-primary)'};
  font-size: 1.1rem;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--border-light);
    border-color: var(--accent-primary);
    transform: scale(1.05);
  }
`;

const PageInfo = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
`;

const InfoButton = styled.button`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--table-header-bg);
  border: 1.5px solid var(--border-light);
  color: var(--accent-primary);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background: var(--border-light);
    border-color: var(--accent-primary);
    transform: scale(1.1);
  }
`;

const VerifyButton = styled.button`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--table-header-bg);
  border: 1.5px solid var(--border-light);
  color: var(--accent-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background: var(--border-light);
    border-color: var(--accent-primary);
    transform: scale(1.1);
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 100%;
`;

const InfoTooltip = styled.div`
  position: fixed;
  background: var(--bg-card);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 1.25rem 1.25rem;
  box-shadow: 0 8px 25px var(--shadow-color);
  min-width: 280px;
  z-index: 99999;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0;
  gap: 1rem;
  border-bottom: 1px solid var(--border-light);

  &:last-child {
    border-bottom: none;
  }
`;

const InfoLabel = styled.span`
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const InfoValue = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  font-family: ${props => props.$mono ? 'monospace' : 'inherit'};
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: ${props => props.$copyable ? 'pointer' : 'default'};

  ${props => props.$copyable && `
    &:hover {
      color: var(--accent-primary);
    }
  `}
`;

const TooltipTxLink = styled.a`
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent-primary);
  text-decoration: none;
  font-family: monospace;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;

  &:hover {
    color: #8e44ad;
    text-decoration: underline;
  }

  &::after {
    content: '↗';
    font-size: 0.7rem;
  }
`;

const ITEMS_PER_PAGE = 20;
const MAX_VISIBLE_CARDS = 5;

const BlackjackHistory = ({ userAddress, isConnected, refreshTrigger = 0 }) => {
  const navigate = useNavigate();
  const { address: gameWalletAddress, hasGameWallet } = useGameWallet();
  const [activeTab, setActiveTab] = useState(isConnected ? 'my' : 'all');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openTooltip, setOpenTooltip] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [selectedGame, setSelectedGame] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchedAddress, setSearchedAddress] = useState('');
  const [searchNonce, setSearchNonce] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const compactTabs = useCompactHistoryTabs({ isSearchOpen, activeTab });
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const wasConnectedRef = useRef(isConnected);
  const { shouldBlockUI, markLoaded } = useHistoryFetchLoading();

  // Keep tab state in sync with wallet connection
  useEffect(() => {
    if (!isConnected) {
      if (activeTab === 'my') setActiveTab('all');
      wasConnectedRef.current = false;
      return;
    }
    if (!wasConnectedRef.current) {
      setActiveTab('my');
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected, activeTab]);

  // Reset page when tab changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setHasMore(true);
  };

  const handleAddressSearch = (address) => {
    setSearchedAddress(address);
    setActiveTab('search');
    setCurrentPage(1);
    setHasMore(true);
    setSearchNonce(n => n + 1);
  };

  const handleClearSearch = () => {
    setSearchedAddress('');
    setActiveTab('all');
    setCurrentPage(1);
    setHasMore(true);
  };

  // Handle new game result from WebSocket
  const handleGameCompleted = useCallback((data) => {
    // Determine wallet type based on player address
    const isGameWallet = gameWalletAddress && data.player?.toLowerCase() === gameWalletAddress?.toLowerCase();

    const newGame = {
      gameId: data.gameId,
      player: data.player,
      phase: 'completed',
      result: data.result,
      totalBet: { ether: data.totalBetEther },
      totalPayout: { ether: data.totalPayoutEther },
      resultTxHash: data.txHash,
      walletType: isGameWallet ? 'game' : 'main',
      createdAt: new Date().toISOString()
    };

    setGames(prevGames => {
      const existingIndex = prevGames.findIndex(g => g.gameId === data.gameId);
      if (existingIndex >= 0) {
        const updated = [...prevGames];
        updated[existingIndex] = { ...updated[existingIndex], ...newGame };
        return updated;
      }
      return [newGame, ...prevGames].slice(0, 20);
    });
  }, [userAddress, gameWalletAddress]);


  // WebSocket connection for real-time updates
  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket(BLACKJACK_WS_URL);

        ws.onopen = () => {
          wsRef.current = ws;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === 'gameCompleted') {
              handleGameCompleted(data);
            }
          } catch (err) {}
        };

        ws.onclose = () => {
          reconnectTimeoutRef.current = setTimeout(connect, 2000);
        };

        ws.onerror = () => {};

      } catch (err) {}
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [handleGameCompleted]);

  const fetchGames = useCallback(async ({ silent = false } = {}) => {
    if (shouldBlockUI({ silent })) {
      setLoading(true);
    }
    try {
        const offset = (currentPage - 1) * ITEMS_PER_PAGE;

        if (activeTab === 'search') {
          if (!searchedAddress) {
            setGames([]);
            setHasMore(false);
            return;
          }

          const data = await getUserGames(searchedAddress, ITEMS_PER_PAGE, offset);
          if (data.success) {
            const completedGames = (data.data || []).filter(g => g.phase === 'completed');
            setGames(completedGames);
            setHasMore(completedGames.length === ITEMS_PER_PAGE);
          } else {
            setGames([]);
            setHasMore(false);
          }
        } else if (activeTab === 'my' && userAddress) {
          // Fetch from main wallet
          let allGames = [];
          const mainData = await getUserGames(userAddress, ITEMS_PER_PAGE, offset);
          if (mainData.success && mainData.data) {
            const mainGames = mainData.data
              .filter(g => g.phase === 'completed')
              .map(g => ({ ...g, walletType: 'main' }));
            allGames = [...mainGames];
          }

          // Fetch from game wallet if exists
          if (hasGameWallet && gameWalletAddress) {
            const gameData = await getUserGames(gameWalletAddress, ITEMS_PER_PAGE, offset);
            if (gameData.success && gameData.data) {
              const gameGames = gameData.data
                .filter(g => g.phase === 'completed')
                .map(g => ({ ...g, walletType: 'game' }));
              allGames = [...allGames, ...gameGames];
            }
          }

          // Sort by createdAt (newest first)
          allGames.sort((a, b) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            return timeB - timeA;
          });

          // Remove duplicates by gameId
          const seen = new Set();
          const uniqueGames = allGames.filter(game => {
            const key = game.gameId?.toString();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          setGames(uniqueGames.slice(0, ITEMS_PER_PAGE));
          setHasMore(uniqueGames.length >= ITEMS_PER_PAGE);
        } else {
          // All games - just fetch recent
          const data = await getRecentGames(ITEMS_PER_PAGE, offset);
          if (data.success) {
            const completedGames = (data.data || []).filter(g => g.phase === 'completed');
            setGames(completedGames);
            setHasMore(completedGames.length === ITEMS_PER_PAGE);
          }
        }
    } catch (err) {
      console.error('Error fetching games:', err);
    } finally {
      setLoading(false);
      markLoaded();
    }
  }, [
    activeTab,
    userAddress,
    hasGameWallet,
    gameWalletAddress,
    currentPage,
    searchedAddress,
    searchNonce,
    shouldBlockUI,
    markLoaded,
  ]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  useEffect(() => {
    if (refreshTrigger <= 0) return;
    fetchGames({ silent: true });
  }, [refreshTrigger, fetchGames]);

  // Close tooltip when clicking outside or scrolling
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openTooltip && !event.target.closest('.info-tooltip-wrapper') && !event.target.closest('.info-tooltip')) {
        setOpenTooltip(null);
        setSelectedGame(null);
      }
    };

    const handleScroll = () => {
      if (openTooltip) {
        setOpenTooltip(null);
        setSelectedGame(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [openTooltip]);

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const renderCardsInRow = (cards, keyPrefix) => {
    const visibleCards = cards.slice(0, MAX_VISIBLE_CARDS);
    const extraCount = cards.length - MAX_VISIBLE_CARDS;

    return (
      <>
        {visibleCards.map((card, index) => (
          <CardDisplay key={`${keyPrefix}${index}`}>{getCardDisplay(card)}</CardDisplay>
        ))}
        {extraCount > 0 && <MoreCardsBadge>+{extraCount}</MoreCardsBadge>}
      </>
    );
  };

  const truncateHash = (hash) => {
    if (!hash) return '';
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  const copyToClipboard = (e, text) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
  };

  const handleInfoClick = (gameId, game, e) => {
    e.stopPropagation();

    if (openTooltip === gameId) {
      setOpenTooltip(null);
      setSelectedGame(null);
      return;
    }

    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();

    setTooltipPos({
      top: rect.top - 150,
      left: rect.left - 285
    });
    setSelectedGame(game);
    setOpenTooltip(gameId);
  };

  const renderPlayerCards = (game) => {
    const playerHands = game.playerHands || [];
    const hasSplit = playerHands.length > 1;

    // Build dealer's full hand for completed games
    const dealerCards = [];
    if (game.dealerUpCard) dealerCards.push(game.dealerUpCard);
    if (game.dealerHoleCard) dealerCards.push(game.dealerHoleCard);
    if (game.dealerHitCards?.length > 0) {
      // Filter out invalid cards (0 or null)
      dealerCards.push(...game.dealerHitCards.filter(c => c && c > 0));
    }

    if (playerHands.length === 0 && dealerCards.length === 0) return '-';

    return (
      <CardsContainer>
        {/* Dealer Hand */}
        <HandRow>
          <HandLabel $isDealer>D</HandLabel>
          {renderCardsInRow(dealerCards, 'd')}
        </HandRow>
        {/* Player Hand(s) */}
        {playerHands.map((hand, handIdx) => (
          <HandRow key={`hand${handIdx}`}>
            <HandLabel>{hasSplit ? `P${handIdx + 1}` : 'P'}</HandLabel>
            {renderCardsInRow(hand.cards || [], `p${handIdx}`)}
          </HandRow>
        ))}
      </CardsContainer>
    );
  };

  const getHandResult = (handCards, dealerCards, handStatus) => {
    if (handStatus === 'surrendered') return 'SURR';
    if (handStatus === 'busted') return 'LOSE';

    const playerTotal = calculateHandTotal(handCards || []).total;
    const dealerTotal = calculateHandTotal(dealerCards || []).total;

    // Check for blackjack (only on first 2 cards)
    if (handCards?.length === 2 && playerTotal === 21) return 'BJ';

    if (dealerTotal > 21) return 'WIN';
    if (playerTotal > dealerTotal) return 'WIN';
    if (playerTotal === dealerTotal) return 'DRAW';
    return 'LOSE';
  };

  const getResultLabel = (game) => {
    const playerHands = game.playerHands || [];
    const hasSplit = playerHands.length > 1;

    // Build dealer cards
    const dealerCards = [];
    if (game.dealerUpCard) dealerCards.push(game.dealerUpCard);
    if (game.dealerHoleCard) dealerCards.push(game.dealerHoleCard);
    if (game.dealerHitCards?.length > 0) {
      dealerCards.push(...game.dealerHitCards.filter(c => c && c > 0));
    }

    if (!hasSplit) {
      // Single hand - use simple result
      const result = game.result;
      if (result === 'blackjack') return 'BJ!';
      if (result === 'win') return 'WIN';
      if (result === 'lose') return 'LOSE';
      if (result === 'push') return 'DRAW';
      if (result === 'surrender') return 'SURR';
      return result?.toUpperCase() || '-';
    }

    // Split hands - calculate each hand's result
    const results = playerHands.map(hand =>
      getHandResult(hand.cards, dealerCards, hand.status)
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {results.map((r, i) => (
          <span key={i} style={{
            display: 'inline-block',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '9px',
            fontWeight: '600',
            backgroundColor: r === 'WIN' || r === 'BJ' ? 'rgba(16, 185, 129, 0.15)' : r === 'LOSE' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(107, 114, 128, 0.15)',
            color: r === 'WIN' || r === 'BJ' ? 'var(--accent-green)' : r === 'LOSE' ? 'var(--accent-red)' : 'var(--text-secondary)'
          }}>
            P{i + 1}: {r}
          </span>
        ))}
      </div>
    );
  };

  const formatAmount = (num) => {
    const fixed = parseFloat(num.toFixed(2));
    return fixed % 1 === 0 ? fixed.toFixed(0) : fixed.toString();
  };

  const getPayout = (game) => {
    const bet = parseFloat(game.totalBet?.ether || '0');
    const payout = parseFloat(game.totalPayout?.ether || '0');

    if (payout > bet) {
      return <span style={{ color: 'var(--accent-green)', fontWeight: '600' }}>{formatAmount(payout)}</span>;
    } else if (payout < bet) {
      return <span style={{ color: 'var(--accent-red)', fontWeight: '600' }}>{formatAmount(payout)}</span>;
    }
    return <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>{formatAmount(payout)}</span>;
  };

  return (
    <Container>
      <Header>
        <Title>Game History</Title>
        <TabContainer>
          <Tab
            $active={activeTab === 'my'}
            $searchOpen={compactTabs}
            data-active={activeTab === 'my' ? 'true' : 'false'}
            onClick={() => handleTabChange('my')}
          >
            {historyTabLabel(compactTabs, 'my')}
          </Tab>
          <Tab
            $active={activeTab === 'all'}
            $searchOpen={compactTabs}
            data-active={activeTab === 'all' ? 'true' : 'false'}
            onClick={() => handleTabChange('all')}
          >
            {historyTabLabel(compactTabs, 'all')}
          </Tab>
          <HistoryAddressSearch
            active={activeTab === 'search'}
            searchedAddress={searchedAddress}
            onSearch={handleAddressSearch}
            onClear={handleClearSearch}
            formatAddress={formatAddress}
            onOpenChange={setIsSearchOpen}
            compact
          />
        </TabContainer>
      </Header>

      <Table>
        <TableHeader>
          <div>Player</div>
          <div>Cards</div>
          <div>Bet</div>
          <div className="hide-mobile">Result</div>
          <div>Payout</div>
          <div></div>
        </TableHeader>

        {loading ? (
          <>
            {[...Array(5)].map((_, i) => (
              <SkeletonRow key={i}>
                <SkeletonCell $width="80px" />
                <SkeletonCell $width="120px" $height="32px" />
                <SkeletonCell $width="60px" />
                <SkeletonCell $width="50px" className="hide-mobile" />
                <SkeletonCell $width="60px" />
                <SkeletonCell $width="24px" $height="24px" style={{ borderRadius: '50%' }} />
              </SkeletonRow>
            ))}
          </>
        ) : games.length === 0 ? (
          <EmptyState>
            {activeTab === 'search'
              ? (searchedAddress ? 'No games found for this address' : 'Enter an address to search blackjack games')
              : activeTab === 'my' ? 'No games played yet' : 'No games recorded yet'}
          </EmptyState>
        ) : (
          games.map((game) => (
            <TableRow key={game.gameId}>
              <Cell>
                {game.player ? (
                  <TxLink
                    href={`${MONVISION_ADDRESS_URL}${game.player}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={game.player}
                  >
                    {formatAddress(game.player)}
                  </TxLink>
                ) : formatAddress(game.player)}
              </Cell>
              <Cell>
                {renderPlayerCards(game)}
              </Cell>
              <Cell className="align-end">
                {formatAmount(parseFloat(game.totalBet?.ether || '0'))}
              </Cell>
              <Cell className="hide-mobile">
                {(game.playerHands?.length || 0) > 1 ? (
                  getResultLabel(game)
                ) : (
                  <ResultBadge $result={game.result}>
                    {getResultLabel(game)}
                  </ResultBadge>
                )}
              </Cell>
              <Cell className="align-end">
                {getPayout(game)}
              </Cell>
              <Cell>
                <ActionButtons className="info-tooltip-wrapper">
                  <VerifyButton onClick={() => navigate(`/blackjack/verify/${game.gameId}`)} title="Verify">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      <path d="M9 12l2 2 4-4"/>
                    </svg>
                  </VerifyButton>
                  <InfoButton onClick={(e) => handleInfoClick(game.gameId, game, e)}>i</InfoButton>
                </ActionButtons>
              </Cell>
            </TableRow>
          ))
        )}
      </Table>

      {/* Pagination */}
      {!loading && games.length > 0 && (
        <PaginationContainer>
          <PaginationButton
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            ←
          </PaginationButton>
          <PageInfo>Page {currentPage}</PageInfo>
          <PaginationButton
            disabled={!hasMore}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            →
          </PaginationButton>
        </PaginationContainer>
      )}

      {/* Global Tooltip */}
      {openTooltip && selectedGame && (
        <InfoTooltip className="info-tooltip" style={{ top: tooltipPos.top, left: tooltipPos.left }}>
          <InfoRow>
            <InfoLabel>Game ID</InfoLabel>
            <TooltipTxLink
              href={`/blackjack/verify/${selectedGame.gameId}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(`/blackjack/verify/${selectedGame.gameId}`);
              }}
              style={{ cursor: 'pointer' }}
            >
              #{selectedGame.gameId}
            </TooltipTxLink>
          </InfoRow>
          {selectedGame.sequenceNumber && (
            <InfoRow>
              <InfoLabel>Sequence</InfoLabel>
              <TooltipTxLink
                href={`https://entropy-explorer.pyth.network/?search=${selectedGame.sequenceNumber}&chain=monad`}
                target="_blank"
                rel="noopener noreferrer"
              >
                #{selectedGame.sequenceNumber}
              </TooltipTxLink>
            </InfoRow>
          )}
          {selectedGame.vrfSeed && (
            <InfoRow>
              <InfoLabel>Random</InfoLabel>
              <InfoValue
                $mono
                $copyable
                title="Click to copy"
                onClick={(e) => copyToClipboard(e, selectedGame.vrfSeed)}
              >
                {truncateHash(selectedGame.vrfSeed)}
              </InfoValue>
            </InfoRow>
          )}
          {selectedGame.betTxHash && (
            <InfoRow>
              <InfoLabel>Bet Tx</InfoLabel>
              <TooltipTxLink href={`${MONVISION_TX_URL}${selectedGame.betTxHash}`} target="_blank" rel="noopener noreferrer">
                {truncateHash(selectedGame.betTxHash)}
              </TooltipTxLink>
            </InfoRow>
          )}
          {selectedGame.resultTxHash && (
            <InfoRow>
              <InfoLabel>Result Tx</InfoLabel>
              <TooltipTxLink href={`${MONVISION_TX_URL}${selectedGame.resultTxHash}`} target="_blank" rel="noopener noreferrer">
                {truncateHash(selectedGame.resultTxHash)}
              </TooltipTxLink>
            </InfoRow>
          )}
          {selectedGame.createdAt && (
            <InfoRow>
              <InfoLabel>Date</InfoLabel>
              <InfoValue>
                {new Date(selectedGame.createdAt).toLocaleString()}
              </InfoValue>
            </InfoRow>
          )}
        </InfoTooltip>
      )}
    </Container>
  );
};

export default BlackjackHistory;
