import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { formatEther } from 'viem';
import { useAccount } from 'wagmi';
import monadIcon from '../../../assets/images/monad.png';
import { getPlayerGames, getRecentGames } from '../utils/plinkoApi';
import { RISK_LEVEL_NAMES } from '../utils/constants';
import { useGameWallet } from '../../../context';
import HistoryAddressSearch from '../../common/HistoryAddressSearch';
import { useHistoryFetchLoading } from '../../../hooks/useHistoryFetchLoading';
import { useCompactHistoryTabs, historyTabLabel } from '../../../hooks/useIsMobile';

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
  gap: 0.5rem;
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
  border: 2px solid var(--border-color);
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

const DESKTOP_GRID = '64px minmax(88px, 1fr) minmax(56px, 0.85fr) minmax(64px, 0.8fr) minmax(72px, 0.85fr)';
const MOBILE_GRID = '58px minmax(0, 1fr) minmax(0, 0.75fr) minmax(0, 0.85fr)';

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
  color: var(--text-primary);
  transition: background 0.2s ease;

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

const RiskBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0.25rem 0.5rem;
  background: ${props => {
    if (props.$risk === 'HIGH') return 'rgba(239, 68, 68, 0.15)';
    if (props.$risk === 'MEDIUM') return 'rgba(245, 158, 11, 0.15)';
    return 'rgba(16, 185, 129, 0.15)';
  }};
  color: ${props => {
    if (props.$risk === 'HIGH') return '#ef4444';
    if (props.$risk === 'MEDIUM') return '#f59e0b';
    return '#10b981';
  }};
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.75rem;
`;

const MultiplierBadge = styled.span`
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 700;
  font-size: 0.8rem;
  background: ${props => {
    const m = props.$mult;
    if (m >= 10) return 'rgba(139, 92, 246, 0.15)';
    if (m >= 2) return 'rgba(16, 185, 129, 0.15)';
    if (m >= 1) return 'rgba(59, 130, 246, 0.15)';
    return 'rgba(107, 114, 128, 0.15)';
  }};
  color: ${props => {
    const m = props.$mult;
    if (m >= 10) return '#8b5cf6';
    if (m >= 2) return '#10b981';
    if (m >= 1) return '#3b82f6';
    return '#6b7280';
  }};
`;

const TxLink = styled.a`
  color: var(--accent-primary);
  text-decoration: none;
  font-size: 0.8rem;
  font-family: monospace;
  display: flex;
  align-items: center;
  gap: 4px;
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

const PayoutCell = styled.span`
  font-weight: 600;
  color: ${props => props.$won ? 'var(--accent-green)' : 'var(--accent-red)'};
  display: flex;
  align-items: center;
  gap: 4px;

  img {
    width: 14px;
    height: 14px;
    border-radius: 50%;
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
  }
`;

const PageInfo = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
`;

const formatAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatAmount = (amount) => {
  if (!amount) return '0';
  try {
    const value = parseFloat(typeof amount === 'string' && amount.length > 15
      ? formatEther(BigInt(amount))
      : amount);
    return value.toFixed(4);
  } catch {
    return '0';
  }
};

const ITEMS_PER_PAGE = 20;

const PlinkoHistory = ({ recentResults = [] }) => {
  const { address, isConnected } = useAccount();
  const { address: gameWalletAddress, hasGameWallet } = useGameWallet();
  const [activeTab, setActiveTab] = useState(isConnected ? 'my' : 'all');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchedAddress, setSearchedAddress] = useState('');
  const [searchNonce, setSearchNonce] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const compactTabs = useCompactHistoryTabs({ isSearchOpen, activeTab });
  const wasConnectedRef = useRef(isConnected);
  const { shouldBlockUI, markLoaded } = useHistoryFetchLoading();

  // Switch to 'all' when disconnected; default to 'my' when wallet connects
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

          const result = await getPlayerGames(searchedAddress, ITEMS_PER_PAGE, offset);
          if (result.success && result.data) {
            setGames(result.data);
            setHasMore(result.data.length === ITEMS_PER_PAGE);
          } else {
            setGames([]);
            setHasMore(false);
          }
        } else if (activeTab === 'my' && address) {
          let allGames = [];

          // Fetch from main wallet
          const mainResult = await getPlayerGames(address, ITEMS_PER_PAGE, offset);
          if (mainResult.success && mainResult.data) {
            allGames = mainResult.data;
          }

          // Also fetch from game wallet if exists
          if (hasGameWallet && gameWalletAddress) {
            const gameResult = await getPlayerGames(gameWalletAddress, ITEMS_PER_PAGE, offset);
            if (gameResult.success && gameResult.data) {
              allGames = [...allGames, ...gameResult.data];
            }
          }

          // Sort by timestamp (newest first)
          allGames.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.createdAt).getTime();
            const timeB = new Date(b.timestamp || b.createdAt).getTime();
            return timeB - timeA;
          });

          // Remove duplicates
          const seen = new Set();
          const uniqueGames = allGames.filter(game => {
            const key = game.gameId?.toString();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          setGames(uniqueGames.slice(0, ITEMS_PER_PAGE));
          setHasMore(uniqueGames.length > ITEMS_PER_PAGE);
        } else {
          // All games
          const result = await getRecentGames(ITEMS_PER_PAGE, offset);
          if (result.success && result.data) {
            setGames(result.data);
            setHasMore(result.data.length === ITEMS_PER_PAGE);
          }
        }
    } catch (err) {
      console.error('Failed to fetch games:', err);
    } finally {
      setLoading(false);
      markLoaded();
    }
  }, [
    activeTab,
    address,
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

  // Use recentResults for "all" tab if available and on first page
  const displayGames = activeTab === 'all' && currentPage === 1 && recentResults.length > 0
    ? recentResults.slice(0, ITEMS_PER_PAGE)
    : games;

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
          <div>Risk</div>
          <div>Player</div>
          <div>Bet</div>
          <div>Multi</div>
          <div className="hide-mobile">Payout</div>
        </TableHeader>

        {loading ? (
          <>
            {[...Array(5)].map((_, i) => (
              <SkeletonRow key={i}>
                <SkeletonCell $width="50px" />
                <SkeletonCell $width="80px" />
                <SkeletonCell $width="60px" />
                <SkeletonCell $width="50px" />
                <SkeletonCell $width="60px" className="hide-mobile" />
              </SkeletonRow>
            ))}
          </>
        ) : displayGames.length === 0 ? (
          <EmptyState>
            {activeTab === 'search'
              ? (searchedAddress ? 'No games found for this address' : 'Enter an address to search games')
              : activeTab === 'my' ? 'No games played yet' : 'No games recorded yet'}
          </EmptyState>
        ) : (
          displayGames.map((game, i) => {
            const mult = parseFloat(game.multiplier) || 0;
            const won = mult >= 1;
            const riskName = game.riskLevelName || RISK_LEVEL_NAMES[game.riskLevel] || 'LOW';
            const bet = formatAmount(game.betAmount);
            const payout = formatAmount(game.payout);

            return (
              <TableRow key={game.gameId || i}>
                <Cell>
                  <RiskBadge $risk={riskName}>
                    {riskName}
                  </RiskBadge>
                </Cell>
                <Cell>
                  <TxLink
                    href={`https://monadexplorer.com/address/${game.player}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={game.player}
                  >
                    {formatAddress(game.player)}
                  </TxLink>
                </Cell>
                <Cell className="align-end">{bet}</Cell>
                <Cell className="align-end">
                  <MultiplierBadge $mult={mult}>
                    {mult.toFixed(2)}x
                  </MultiplierBadge>
                </Cell>
                <Cell className="hide-mobile align-end">
                  <PayoutCell $won={won}>
                    {won ? '+' : ''}{payout}
                    <img src={monadIcon} alt="MON" />
                  </PayoutCell>
                </Cell>
              </TableRow>
            );
          })
        )}

        {/* Pagination */}
        {!loading && displayGames.length > 0 && (
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
      </Table>
    </Container>
  );
};

export default PlinkoHistory;
