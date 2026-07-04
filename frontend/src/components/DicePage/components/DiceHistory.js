import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { getRecentGames, getPlayerGames } from '../utils/diceApi';
import { DICE_WS_URL } from '../utils/constants';
import { useGameWallet } from '../../../context';
import HistoryAddressSearch from '../../common/HistoryAddressSearch';
import { useHistoryFetchLoading } from '../../../hooks/useHistoryFetchLoading';
import { useCompactHistoryTabs, historyTabLabel } from '../../../hooks/useIsMobile';

const MONVISION_BASE_URL = 'https://monvision.io/tx/';
const MONVISION_ADDRESS_URL = 'https://monvision.io/address/';

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

const PredictionBadge = styled.span`
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.75rem;
  background: ${props => props.$isOver ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
  color: ${props => props.$isOver ? '#10b981' : '#ef4444'};
`;

const ResultBadge = styled.span`
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.75rem;
  background: ${props => props.$won ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
  color: ${props => props.$won ? '#10b981' : '#ef4444'};
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
  border-bottom: 1px solid var(--divider-color);

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
  border-top: 1px solid var(--divider-color);
`;

const PaginationButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 2px solid ${props => props.disabled ? 'var(--disabled-text)' : 'var(--border-color)'};
  border-radius: 8px;
  background: ${props => props.disabled ? 'transparent' : 'var(--bg-glass)'};
  color: ${props => props.disabled ? 'var(--disabled-text)' : 'var(--accent-primary)'};
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

// Info Button and Tooltip styles
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
  border: 2px solid var(--border-color);
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
  border-bottom: 1px solid var(--divider-color);

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
    filter: brightness(1.2);
    text-decoration: underline;
  }

  &::after {
    content: '↗';
    font-size: 0.7rem;
  }
`;

const ITEMS_PER_PAGE = 20;

const DiceHistory = ({ userAddress, isConnected, refreshTrigger = 0 }) => {
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
    // Determine wallet type
    const isMainWallet = userAddress && data.player?.toLowerCase() === userAddress?.toLowerCase();
    const isGameWalletPlayer = gameWalletAddress && data.player?.toLowerCase() === gameWalletAddress?.toLowerCase();

    const newGame = {
      gameId: data.gameId,
      player: data.player,
      betAmount: data.betAmount,
      threshold: data.threshold,
      isOver: data.isOver,
      result: data.result,
      won: data.won,
      payout: data.payout,
      state: 'completed',
      betTxHash: data.betTxHash,
      resultTxHash: data.txHash,
      sequenceNumber: data.entropy?.sequenceNumber,
      randomNumber: data.entropy?.randomNumber,
      walletType: isGameWalletPlayer ? 'game' : isMainWallet ? 'main' : undefined,
      updatedAt: new Date().toISOString()
    };

    setGames(prevGames => {
      // If we're on "my" tab, only add if it's from user's wallet (main or game)
      if (activeTab === 'my' && !isMainWallet && !isGameWalletPlayer) {
        return prevGames;
      }

      if (activeTab === 'search' && data.player?.toLowerCase() !== searchedAddress?.toLowerCase()) {
        return prevGames;
      }

      const existingIndex = prevGames.findIndex(g => g.gameId === data.gameId);
      if (existingIndex >= 0) {
        const updated = [...prevGames];
        updated[existingIndex] = { ...updated[existingIndex], ...newGame };
        return updated;
      }
      return [newGame, ...prevGames].slice(0, 20);
    });
  }, [userAddress, gameWalletAddress, activeTab, searchedAddress]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket(DICE_WS_URL);

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

          const data = await getPlayerGames(searchedAddress, ITEMS_PER_PAGE, offset);
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
          const mainData = await getPlayerGames(userAddress, ITEMS_PER_PAGE, offset);
          if (mainData.success && mainData.data) {
            allGames = mainData.data.map(game => ({
              ...game,
              walletType: 'main'
            }));
          }

          // Game wallet games (if exists)
          if (hasGameWallet && gameWalletAddress) {
            const gameData = await getPlayerGames(gameWalletAddress, ITEMS_PER_PAGE, offset);
            if (gameData.success && gameData.data) {
              const gameGames = gameData.data.map(game => ({
                ...game,
                walletType: 'game'
              }));
              allGames = [...allGames, ...gameGames];
            }
          }

          // Sort by timestamp (newest first)
          allGames.sort((a, b) => {
            const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
            const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
            return timeB - timeA;
          });

          // Remove duplicates by gameId
          const seen = new Set();
          const uniqueGames = allGames.filter(game => {
            const key = game.gameId?.toString() || game.betTxHash;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          setGames(uniqueGames.slice(0, ITEMS_PER_PAGE));
          setHasMore(uniqueGames.length >= ITEMS_PER_PAGE);
        } else {
          // All games (global)
          const data = await getRecentGames(ITEMS_PER_PAGE, offset);
          if (data.success) {
            setGames(data.data || []);
            setHasMore((data.data || []).length === ITEMS_PER_PAGE);
          }
        }
    } catch (err) {
      // Silent fail
    } finally {
      setLoading(false);
      markLoaded();
    }
  }, [
    activeTab,
    userAddress,
    gameWalletAddress,
    hasGameWallet,
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
          <div>Bet</div>
          <div>Prediction</div>
          <div>Roll</div>
          <div className="hide-mobile">Result</div>
          <div className="hide-mobile">Payout</div>
          <div></div>
        </TableHeader>

        {loading ? (
          <>
            {[...Array(5)].map((_, i) => (
              <SkeletonRow key={i}>
                <SkeletonCell $width="80px" />
                <SkeletonCell $width="60px" />
                <SkeletonCell $width="50px" />
                <SkeletonCell $width="30px" />
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
              <Cell>{parseFloat(game.betAmount || '0').toFixed(4)}</Cell>
              <Cell>
                <PredictionBadge $isOver={game.isOver}>
                  {game.isOver ? `>${game.threshold}` : `<${game.threshold}`}
                </PredictionBadge>
              </Cell>
              <Cell style={{ fontWeight: 700, color: '#6930c3' }}>
                {game.result}
              </Cell>
              <Cell className="hide-mobile">
                <ResultBadge $won={game.won}>
                  {game.won ? 'WON' : 'LOST'}
                </ResultBadge>
              </Cell>
              <Cell className="hide-mobile">
                {game.won ? (
                  <span style={{ color: '#10b981', fontWeight: '600' }}>
                    +{parseFloat(game.payout || '0').toFixed(4)}
                  </span>
                ) : (
                  <span style={{ color: '#ef4444', fontWeight: '600' }}>
                    -{parseFloat(game.betAmount || '0').toFixed(4)}
                  </span>
                )}
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
            <InfoLabel>Threshold</InfoLabel>
            <InfoValue>{selectedGame.threshold}</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Prediction</InfoLabel>
            <InfoValue>{selectedGame.isOver ? 'Over' : 'Under'}</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Roll Result</InfoLabel>
            <InfoValue style={{ color: selectedGame.won ? '#10b981' : '#ef4444' }}>{selectedGame.result}</InfoValue>
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
          {selectedGame.randomNumber && (
            <InfoRow>
              <InfoLabel>Random Number</InfoLabel>
              <InfoValue
                $mono
                $copyable
                title="Click to copy"
                onClick={(e) => copyToClipboard(e, selectedGame.randomNumber)}
              >
                {truncateHash(selectedGame.randomNumber)}
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

export default DiceHistory;
