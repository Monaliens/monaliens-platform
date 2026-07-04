import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { getRecentGames, getPlayerGames } from '../utils/limboApi';
import { LIMBO_WS_URL } from '../utils/constants';
import { useGameWallet } from '../../../context';
import HistoryAddressSearch from '../../common/HistoryAddressSearch';
import { useHistoryFetchLoading } from '../../../hooks/useHistoryFetchLoading';

const MONVISION_BASE_URL = 'https://monvision.io/tx/';
const MONVISION_ADDRESS_URL = 'https://monvision.io/address/';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
  background: var(--bg-card);
  border: 2px solid var(--border-light);
  border-radius: 20px;
  padding: 1.5rem;
  margin-top: 2rem;
  box-shadow: 0 8px 25px var(--shadow-color);
  animation: ${fadeIn} 0.6s ease-out;
  max-width: 900px;
  margin-left: auto;
  margin-right: auto;

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
  flex-wrap: wrap;
  gap: 1rem;
`;

const Title = styled.h3`
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
`;

const Tabs = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const Tab = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.3s ease;
  background: ${props => props.$active ? 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary-light, #8e44ad) 100%)' : 'transparent'};
  border: 2px solid ${props => props.$active ? 'var(--accent-primary)' : 'var(--border-color)'};
  color: ${props => props.$active ? 'var(--text-light)' : 'var(--accent-primary)'};

  &:hover {
    background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary-light, #8e44ad) 100%);
    border-color: var(--accent-primary);
    color: var(--text-light);
  }
`;

const Table = styled.div`
  overflow-x: auto;
`;

const TableHeader = styled.div`
  display: grid;
  grid-template-columns: 1.2fr 0.8fr 0.8fr 0.8fr 1fr 40px;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--table-header-bg);
  border-radius: 8px;
  margin-bottom: 0.5rem;
  font-weight: 600;
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;

  @media (max-width: 768px) {
    grid-template-columns: 1fr 0.8fr 0.8fr 0.8fr 40px;
    font-size: 0.7rem;
  }
`;

const TableRow = styled.div`
  display: grid;
  grid-template-columns: 1.2fr 0.8fr 0.8fr 0.8fr 1fr 40px;
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-light);
  font-size: 0.85rem;
  align-items: center;
  transition: background 0.2s ease;
  color: var(--text-primary);

  &:hover {
    background: var(--table-header-bg);
  }

  &:last-child {
    border-bottom: none;
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr 0.8fr 0.8fr 0.8fr 40px;
    font-size: 0.8rem;
  }
`;

const Cell = styled.div`
  display: flex;
  align-items: center;
  justify-content: ${props => props.$center ? 'center' : 'flex-start'};

  @media (max-width: 768px) {
    &.hide-mobile {
      display: none;
    }
  }
`;

const Badge = styled.span`
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.75rem;
  background: ${props => props.$won ? 'var(--accent-green-bg, rgba(16, 185, 129, 0.1))' : 'var(--accent-red-bg, rgba(239, 68, 68, 0.1))'};
  color: ${props => props.$won ? 'var(--accent-green)' : 'var(--accent-red)'};
`;

const Multiplier = styled.span`
  font-weight: 700;
  color: var(--accent-primary);
`;

const AddressLink = styled.a`
  font-family: monospace;
  font-size: 0.8rem;
  color: var(--accent-primary);
  text-decoration: none;
  transition: color 0.2s;

  &:hover {
    color: var(--accent-primary-light, #8e44ad);
    text-decoration: underline;
  }

  &::after {
    content: '↗';
    font-size: 0.65rem;
    margin-left: 2px;
  }
`;

const PayoutText = styled.span`
  font-weight: 600;
  color: ${props => props.$won ? 'var(--accent-green)' : 'var(--accent-red)'};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
`;

const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
`;

const SkeletonRow = styled.div`
  display: grid;
  grid-template-columns: 1.2fr 0.8fr 0.8fr 0.8fr 1fr 40px;
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-light);

  @media (max-width: 768px) {
    grid-template-columns: 1fr 0.8fr 0.8fr 0.8fr 40px;
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
  border: 2px solid ${props => props.disabled ? 'var(--border-light)' : 'var(--border-color)'};
  border-radius: 8px;
  background: ${props => props.disabled ? 'transparent' : 'var(--bg-glass)'};
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

// Info Button and Tooltip styles
const InfoButton = styled.button`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--border-light);
  border: 1.5px solid var(--border-color);
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
    background: var(--border-color);
    border-color: var(--accent-primary);
    transform: scale(1.1);
  }
`;

const InfoTooltip = styled.div`
  position: fixed;
  background: var(--bg-card);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 1rem;
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
  max-width: 150px;
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

const TooltipLink = styled.a`
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
    color: var(--accent-primary-light, #8e44ad);
    text-decoration: underline;
  }

  &::after {
    content: '↗';
    font-size: 0.7rem;
  }
`;

const ITEMS_PER_PAGE = 20;

const LimboHistory = ({ userAddress, isConnected, refreshTrigger }) => {
  const { address: gameWalletAddress, hasGameWallet } = useGameWallet();
  const [activeTab, setActiveTab] = useState('all');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openTooltip, setOpenTooltip] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [selectedGame, setSelectedGame] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchedAddress, setSearchedAddress] = useState('');
  const [searchNonce, setSearchNonce] = useState(0);
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
    // If on "My Games" tab, only add if it's the user's game (main wallet or game wallet)
    const isMainWallet = userAddress && data.player?.toLowerCase() === userAddress?.toLowerCase();
    const isGameWallet = gameWalletAddress && data.player?.toLowerCase() === gameWalletAddress?.toLowerCase();

    if (activeTab === 'my' && !isMainWallet && !isGameWallet) {
      return;
    }

    if (activeTab === 'search' && data.player?.toLowerCase() !== searchedAddress?.toLowerCase()) {
      return;
    }

    const newGame = {
      gameId: data.gameId,
      player: data.player,
      betAmount: data.betAmount, // Already formatted as ether string from backend
      targetMultiplier: data.targetMultiplier,
      resultMultiplier: data.resultMultiplier,
      won: data.won,
      payout: data.payout, // Already formatted as ether string from backend
      state: 'completed',
      sequenceNumber: data.sequenceNumber,
      randomNumber: data.randomNumber,
      betTxHash: data.betTxHash,
      resultTxHash: data.resultTxHash || data.txHash,
      updatedAt: data.timestamp || new Date().toISOString(),
      walletType: isGameWallet ? 'game' : 'main'
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
  }, [activeTab, userAddress, gameWalletAddress, searchedAddress]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket(LIMBO_WS_URL);

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

          const response = await getPlayerGames(searchedAddress, ITEMS_PER_PAGE, offset);
          if (response.success) {
            setGames(response.data || []);
            setHasMore((response.data || []).length === ITEMS_PER_PAGE);
          } else {
            setGames([]);
            setHasMore(false);
          }
        } else if (activeTab === 'my' && isConnected && userAddress) {
          // Fetch from both main wallet and game wallet
          let allGames = [];

          // Main wallet games
          const mainResponse = await getPlayerGames(userAddress, ITEMS_PER_PAGE, offset);
          if (mainResponse.success && mainResponse.data) {
            const mainGames = mainResponse.data.map(game => ({
              ...game,
              walletType: 'main'
            }));
            allGames = [...mainGames];
          }

          // Game wallet games (if exists)
          if (hasGameWallet && gameWalletAddress) {
            const gameResponse = await getPlayerGames(gameWalletAddress, ITEMS_PER_PAGE, offset);
            if (gameResponse.success && gameResponse.data) {
              const gameGames = gameResponse.data.map(game => ({
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
            const key = game.gameId?.toString();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          setGames(uniqueGames.slice(0, ITEMS_PER_PAGE));
          setHasMore(uniqueGames.length >= ITEMS_PER_PAGE);
        } else {
          // All games tab - fetch recent games
          const response = await getRecentGames(ITEMS_PER_PAGE, offset);
          if (response.success) {
            setGames(response.data || []);
            setHasMore((response.data || []).length === ITEMS_PER_PAGE);
          } else {
            setGames([]);
          }
        }
    } catch (err) {
      setGames([]);
    } finally {
      setLoading(false);
      markLoaded();
    }
  }, [
    activeTab,
    userAddress,
    isConnected,
    currentPage,
    hasGameWallet,
    gameWalletAddress,
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

  // Close tooltip when clicking outside
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
      top: rect.top - 220,
      left: rect.left - 290
    });
    setSelectedGame(game);
    setOpenTooltip(gameId);
  };

  return (
    <Container>
      <Header>
        <Title>Game History</Title>
        <Tabs>
          {isConnected && (
            <Tab $active={activeTab === 'my'} onClick={() => handleTabChange('my')}>
              My Games
            </Tab>
          )}
          <Tab $active={activeTab === 'all'} onClick={() => handleTabChange('all')}>
            All Games
          </Tab>
          <HistoryAddressSearch
            active={activeTab === 'search'}
            searchedAddress={searchedAddress}
            onSearch={handleAddressSearch}
            onClear={handleClearSearch}
            formatAddress={formatAddress}
          />
        </Tabs>
      </Header>

      <Table>
        <TableHeader>
          <div>Player</div>
          <div style={{ textAlign: 'center' }}>Bet</div>
          <div style={{ textAlign: 'center' }}>Target</div>
          <div style={{ textAlign: 'center' }}>Result</div>
          <div style={{ textAlign: 'center' }} className="hide-mobile">Payout</div>
          <div></div>
        </TableHeader>

        {loading ? (
          <>
            {[...Array(5)].map((_, i) => (
              <SkeletonRow key={i}>
                <SkeletonCell $width="80px" />
                <SkeletonCell $width="60px" />
                <SkeletonCell $width="50px" />
                <SkeletonCell $width="50px" />
                <SkeletonCell $width="60px" className="hide-mobile" />
                <SkeletonCell $width="24px" $height="24px" style={{ borderRadius: '50%' }} />
              </SkeletonRow>
            ))}
          </>
        ) : games.length === 0 ? (
          <EmptyState>
            {activeTab === 'search'
              ? (searchedAddress ? 'No games found for this address' : 'Enter an address to search games')
              : 'No games found'}
          </EmptyState>
        ) : (
          games.filter(game =>
            game.state === 'completed' &&
            game.betAmount &&
            !isNaN(parseFloat(game.betAmount)) &&
            game.resultMultiplier
          ).map((game, index) => (
            <TableRow key={game.gameId || index}>
              <Cell>
                <AddressLink
                  href={`${MONVISION_ADDRESS_URL}${game.player}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {formatAddress(game.player)}
                </AddressLink>
              </Cell>
              <Cell $center>{parseFloat(game.betAmount).toFixed(2)} MON</Cell>
              <Cell $center>
                <Multiplier>{game.targetMultiplier}x</Multiplier>
              </Cell>
              <Cell $center>
                <Badge $won={game.won}>
                  {game.resultMultiplier}x
                </Badge>
              </Cell>
              <Cell $center className="hide-mobile">
                <PayoutText $won={game.won}>
                  {game.won ? `+${parseFloat(game.payout).toFixed(4)}` : `-${parseFloat(game.betAmount).toFixed(4)}`}
                </PayoutText>
              </Cell>
              <Cell $center>
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
            <InfoLabel>Player</InfoLabel>
            <TooltipLink
              href={`${MONVISION_ADDRESS_URL}${selectedGame.player}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {formatAddress(selectedGame.player)}
            </TooltipLink>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Bet Amount</InfoLabel>
            <InfoValue>{parseFloat(selectedGame.betAmount).toFixed(4)} MON</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Target</InfoLabel>
            <InfoValue>{selectedGame.targetMultiplier}x</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Result</InfoLabel>
            <InfoValue style={{ color: selectedGame.won ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {selectedGame.resultMultiplier}x ({selectedGame.won ? 'WON' : 'LOST'})
            </InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Payout</InfoLabel>
            <InfoValue style={{ color: selectedGame.won ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {selectedGame.won ? `+${parseFloat(selectedGame.payout).toFixed(4)} MON` : '0 MON'}
            </InfoValue>
          </InfoRow>
          {selectedGame.sequenceNumber && (
            <InfoRow>
              <InfoLabel>Sequence</InfoLabel>
              <TooltipLink
                href={`https://entropy-explorer.pyth.network/?search=${selectedGame.sequenceNumber}&chain=monad`}
                target="_blank"
                rel="noopener noreferrer"
              >
                #{selectedGame.sequenceNumber}
              </TooltipLink>
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
              <TooltipLink href={`${MONVISION_BASE_URL}${selectedGame.betTxHash}`} target="_blank" rel="noopener noreferrer">
                {truncateHash(selectedGame.betTxHash)}
              </TooltipLink>
            </InfoRow>
          )}
          {selectedGame.resultTxHash && (
            <InfoRow>
              <InfoLabel>Result Tx</InfoLabel>
              <TooltipLink href={`${MONVISION_BASE_URL}${selectedGame.resultTxHash}`} target="_blank" rel="noopener noreferrer">
                {truncateHash(selectedGame.resultTxHash)}
              </TooltipLink>
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

export default LimboHistory;
