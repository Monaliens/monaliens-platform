import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { getUserGames, getRecentGames } from '../utils/hiloApi';
import { CARD_NAMES, MONVISION_BASE_URL, MONVISION_ADDRESS_URL } from '../utils/constants';
import { useGameWallet } from '../../../context';
import HistoryAddressSearch from '../../common/HistoryAddressSearch';
import { useHistoryFetchLoading } from '../../../hooks/useHistoryFetchLoading';
import { useCompactHistoryTabs, historyTabLabel } from '../../../hooks/useIsMobile';

const WS_URL = process.env.REACT_APP_HILO_WS_URL || 'wss://your-api-url/ws/hilo';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
  background: var(--bg-glass);
  border: 2px solid var(--border-light);
  border-radius: 20px;
  padding: 1.5rem;
  margin-top: 2rem;
  box-shadow: 0 8px 25px var(--shadow-color);
  animation: ${fadeIn} 0.6s ease-out;

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

const Tab = styled.button`
  padding: 0.5rem 1rem;
  border: 2px solid ${props => props.$active ? 'var(--accent-primary)' : 'var(--border-light)'};
  border-radius: 8px;
  background: ${props => props.$active ? 'linear-gradient(135deg, var(--accent-primary) 0%, #8e44ad 100%)' : 'transparent'};
  color: ${props => props.$active ? 'white' : 'var(--accent-primary)'};
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    border-color: var(--accent-primary);
  }

  @media (max-width: 768px) {
    width: auto;
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

const Table = styled.div`
  overflow-x: auto;
`;

const TableHeader = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 40px;
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
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 40px;
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-light);
  font-size: 0.9rem;
  align-items: center;
  color: var(--text-primary);
  transition: background 0.2s ease;

  &:hover {
    background: var(--table-header-bg);
  }

  &:last-child {
    border-bottom: none;
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr 1fr 1fr 1fr 40px;
    font-size: 0.8rem;
  }
`;

const Cell = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;

  @media (max-width: 768px) {
    &.hide-mobile {
      display: none;
    }
  }
`;

const CardDisplay = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 36px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--text-primary);
`;

const PredictBadge = styled.span`
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.75rem;
  background: ${props => props.$high ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
  color: ${props => props.$high ? 'var(--accent-green)' : 'var(--accent-red)'};
`;

const ResultBadge = styled.span`
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.75rem;
  background: ${props => props.$won ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
  color: ${props => props.$won ? 'var(--accent-green)' : 'var(--accent-red)'};
`;

const TxLink = styled.a`
  color: var(--accent-primary);
  text-decoration: none;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 4px;

  &:hover {
    text-decoration: underline;
  }

  &::after {
    content: '↗';
    font-size: 0.7rem;
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
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 40px;
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-light);

  @media (max-width: 768px) {
    grid-template-columns: 1fr 1fr 1fr 1fr 40px;
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
  border: 2px solid ${props => props.disabled ? 'var(--border-color)' : 'var(--border-light)'};
  border-radius: 8px;
  background: ${props => props.disabled ? 'transparent' : 'var(--bg-card)'};
  color: ${props => props.disabled ? 'var(--text-tertiary)' : 'var(--accent-primary)'};
  font-size: 1.1rem;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--table-header-bg);
    border-color: var(--accent-primary);
    transform: scale(1.05);
  }
`;

const PageInfo = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
`;

// Info Button and Tooltip styles (from FlipHistory)
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

const InfoTooltip = styled.div`
  position: fixed;
  background: var(--bg-card);
  border: 2px solid var(--border-light);
  border-radius: 12px;
  padding: 1.25rem 1.25rem;
  box-shadow: 0 8px 25px var(--shadow-color);
  min-width: 300px;
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

const HiLoHistory = ({ userAddress, isConnected, refreshTrigger = 0 }) => {
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
  const { shouldBlockUI, markLoaded } = useHistoryFetchLoading();

  // Switch to 'all' tab when wallet disconnects
  useEffect(() => {
    if (!isConnected && activeTab === 'my') {
      setActiveTab('all');
    }
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
  const handleGameResult = useCallback((data) => {
    // Determine wallet type based on player address
    const isMainWallet = userAddress && data.player?.toLowerCase() === userAddress?.toLowerCase();
    const isGameWallet = gameWalletAddress && data.player?.toLowerCase() === gameWalletAddress?.toLowerCase();
    const walletType = isGameWallet ? 'game' : (isMainWallet ? 'main' : null);

    const newGame = {
      gameId: data.gameId,
      player: data.player,
      firstCard: data.firstCard,
      secondCard: data.secondCard,
      predictHigh: data.predictHigh,
      won: data.winner,
      state: 'completed',
      amount: {
        wei: data.amount || '0',
        ether: data.amountEther || '0'
      },
      payout: {
        wei: data.payout,
        ether: data.payoutEther
      },
      resultTxHash: data.txHash,
      // Pyth Entropy data
      entropy: data.entropy || null,
      walletType
    };

    setGames(prevGames => {
      if (activeTab === 'my' && !isMainWallet && !isGameWallet) {
        return prevGames;
      }

      if (activeTab === 'search' && data.player?.toLowerCase() !== searchedAddress?.toLowerCase()) {
        return prevGames;
      }

      // Check if game already exists (update it) or add new
      const existingIndex = prevGames.findIndex(g => g.gameId === data.gameId);
      if (existingIndex >= 0) {
        const updated = [...prevGames];
        updated[existingIndex] = { ...updated[existingIndex], ...newGame };
        return updated;
      }
      // Add to top of list
      return [newGame, ...prevGames].slice(0, 20);
    });
  }, [userAddress, gameWalletAddress, activeTab, searchedAddress]);

  // WebSocket connection for real-time updates
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
            if (data.event === 'gameResult') {
              handleGameResult(data);
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
  }, [handleGameResult]);

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
            setGames(data.data || []);
            setHasMore((data.data || []).length === ITEMS_PER_PAGE);
          } else {
            setGames([]);
            setHasMore(false);
          }
        } else if (activeTab === 'my' && userAddress) {
          // Fetch from both main wallet and game wallet
          let allGames = [];

          // Main wallet games
          const mainData = await getUserGames(userAddress, ITEMS_PER_PAGE, offset);
          if (mainData.success && mainData.data) {
            allGames = mainData.data.map(game => ({ ...game, walletType: 'main' }));
          }

          // Game wallet games (if exists)
          if (hasGameWallet && gameWalletAddress) {
            const gameData = await getUserGames(gameWalletAddress, ITEMS_PER_PAGE, offset);
            if (gameData.success && gameData.data) {
              const gameGames = gameData.data.map(game => ({ ...game, walletType: 'game' }));
              allGames = [...allGames, ...gameGames];
            }
          }

          // Sort by timestamp (newest first)
          allGames.sort((a, b) => {
            const timeA = new Date(a.updatedAt || a.createdAt).getTime();
            const timeB = new Date(b.updatedAt || b.createdAt).getTime();
            return timeB - timeA;
          });

          // Remove duplicates by gameId
          const seen = new Set();
          const uniqueGames = allGames.filter(game => {
            const key = game.gameId;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          setGames(uniqueGames.slice(0, ITEMS_PER_PAGE));
          setHasMore(uniqueGames.length === ITEMS_PER_PAGE);
        } else {
          // Recent games (all players)
          const data = await getRecentGames(ITEMS_PER_PAGE, offset);
          if (data.success) {
            setGames(data.data || []);
            setHasMore((data.data || []).length === ITEMS_PER_PAGE);
          }
        }
    } catch (err) {
      // Silent fail for fetch errors
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

  const getCardDisplay = (value) => {
    return CARD_NAMES[value] || value;
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

    // Tooltip butonun solunda ve yukarida
    setTooltipPos({
      top: rect.top - 180,
      left: rect.left - 305
    });
    setSelectedGame(game);
    setOpenTooltip(gameId);
  };

  return (
    <Container>
      <Header>
        <Title>Game History</Title>
        <TabContainer>
          <Tab $active={activeTab === 'my'} $searchOpen={compactTabs} onClick={() => handleTabChange('my')}>
            {historyTabLabel(compactTabs, 'my')}
          </Tab>
          <Tab $active={activeTab === 'all'} $searchOpen={compactTabs} onClick={() => handleTabChange('all')}>
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
          <div>Predict</div>
          <div>Bet</div>
          <div className="hide-mobile">Result</div>
          <div className="hide-mobile">Payout</div>
          <div></div>
        </TableHeader>

        {loading ? (
          <>
            {[...Array(5)].map((_, i) => (
              <SkeletonRow key={i}>
                <SkeletonCell $width="80px" />
                <SkeletonCell $width="70px" />
                <SkeletonCell $width="50px" />
                <SkeletonCell $width="50px" />
                <SkeletonCell $width="50px" className="hide-mobile" />
                <SkeletonCell $width="60px" className="hide-mobile" />
                <SkeletonCell $width="24px" $height="24px" style={{ borderRadius: '50%' }} />
              </SkeletonRow>
            ))}
          </>
        ) : games.length === 0 ? (
          <EmptyState>
            {activeTab === 'search'
              ? (searchedAddress ? 'No games found for this address' : 'Enter an address to search games')
              : activeTab === 'my' ? 'No games played yet' : 'No games recorded yet'}
          </EmptyState>
        ) : (
          games.map((game) => (
            <TableRow key={game.gameId}>
              <Cell>
                <TxLink href={`${MONVISION_ADDRESS_URL}${game.player}`} target="_blank" rel="noopener noreferrer">
                  {formatAddress(game.player)}
                </TxLink>
              </Cell>
              <Cell>
                <CardDisplay>{getCardDisplay(game.firstCard)}</CardDisplay>
                <span style={{ margin: '0 0.25rem' }}>→</span>
                <CardDisplay style={{ opacity: game.state === 'completed' ? 1 : 0.5 }}>
                  {game.state === 'completed' ? getCardDisplay(game.secondCard) : '?'}
                </CardDisplay>
              </Cell>
              <Cell>
                <PredictBadge $high={game.predictHigh}>
                  {game.predictHigh ? 'HIGH' : 'LOW'}
                </PredictBadge>
              </Cell>
              <Cell>{parseFloat(game.amount?.ether || '0').toFixed(4)}</Cell>
              <Cell className="hide-mobile">
                {game.state === 'completed' ? (
                  <ResultBadge $won={game.won}>
                    {game.won ? 'WON' : 'LOST'}
                  </ResultBadge>
                ) : (
                  <span style={{ color: 'var(--accent-orange)' }}>Pending</span>
                )}
              </Cell>
              <Cell className="hide-mobile">
                {game.state === 'completed' && game.won ? (
                  <span style={{ color: 'var(--accent-green)', fontWeight: '600' }}>
                    +{parseFloat(game.payout?.ether || '0').toFixed(4)}
                  </span>
                ) : game.state === 'completed' ? (
                  <span style={{ color: 'var(--accent-red)', fontWeight: '600' }}>
                    -{parseFloat(game.amount?.ether || '0').toFixed(4)}
                  </span>
                ) : '-'}
              </Cell>
              <Cell>
                <div className="info-tooltip-wrapper">
                  <InfoButton onClick={(e) => handleInfoClick(game.gameId, game, e)}>i</InfoButton>
                </div>
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
            <InfoLabel>First Card</InfoLabel>
            <InfoValue>{getCardDisplay(selectedGame.firstCard)}</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Second Card</InfoLabel>
            <InfoValue>{getCardDisplay(selectedGame.secondCard)}</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Prediction</InfoLabel>
            <InfoValue>{selectedGame.predictHigh ? 'HIGH' : 'LOW'}</InfoValue>
          </InfoRow>
          {selectedGame.entropy?.sequenceNumber && (
            <InfoRow>
              <InfoLabel>Sequence</InfoLabel>
              <TooltipTxLink
                href={`https://entropy-explorer.pyth.network/?search=${selectedGame.entropy.sequenceNumber}&chain=monad`}
                target="_blank"
                rel="noopener noreferrer"
              >
                #{selectedGame.entropy.sequenceNumber}
              </TooltipTxLink>
            </InfoRow>
          )}
          {selectedGame.entropy?.randomNumber && (
            <InfoRow>
              <InfoLabel>Random Number</InfoLabel>
              <InfoValue
                $mono
                $copyable
                title="Click to copy"
                onClick={(e) => copyToClipboard(e, selectedGame.entropy.randomNumber)}
              >
                {truncateHash(selectedGame.entropy.randomNumber)}
              </InfoValue>
            </InfoRow>
          )}
          {selectedGame.betTxHash && (
            <InfoRow>
              <InfoLabel>Bet Tx</InfoLabel>
              <TooltipTxLink href={`${MONVISION_BASE_URL}${selectedGame.betTxHash}`} target="_blank" rel="noopener noreferrer">
                {truncateHash(selectedGame.betTxHash)}
              </TooltipTxLink>
            </InfoRow>
          )}
          {selectedGame.resultTxHash && (
            <InfoRow>
              <InfoLabel>Result Tx</InfoLabel>
              <TooltipTxLink href={`${MONVISION_BASE_URL}${selectedGame.resultTxHash}`} target="_blank" rel="noopener noreferrer">
                {truncateHash(selectedGame.resultTxHash)}
              </TooltipTxLink>
            </InfoRow>
          )}
          {selectedGame.updatedAt && (
            <InfoRow>
              <InfoLabel>Date</InfoLabel>
              <InfoValue>
                {new Date(selectedGame.updatedAt).toLocaleString()}
              </InfoValue>
            </InfoRow>
          )}
        </InfoTooltip>
      )}
    </Container>
  );
};

export default HiLoHistory;
