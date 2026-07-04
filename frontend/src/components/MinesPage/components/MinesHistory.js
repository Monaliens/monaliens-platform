import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { formatEther } from 'viem';
import monadIcon from '../../../assets/images/monad.png';
import { getPlayerGames, getRecentGames, getLeaderboard } from '../utils/minesApi';
import { MINES_WS_URL, MINES_CONTRACT_ADDRESS, MINES_ABI } from '../utils/constants';
import { useWatchContractEvent } from 'wagmi';
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
    justify-content: flex-start;
    flex-wrap: nowrap;
    gap: 0.4rem;

    > :last-child {
      margin-left: auto;
    }
  }

  @media (max-width: 420px) {
    gap: 0.3rem;
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
    min-width: ${props => props.$compact ? '52px' : '96px'};
    padding: 0.5rem ${props => props.$compact ? '0.5rem' : '0.65rem'};
    font-size: 0.78rem;
    white-space: nowrap;
  }

  @media (max-width: 420px) {
    min-width: ${props => props.$compact ? '44px' : '82px'};
    font-size: 0.72rem;
    padding: 0.45rem ${props => props.$compact ? '0.45rem' : '0.55rem'};
  }
`;

const DESKTOP_GRID = '72px minmax(88px, 1fr) minmax(64px, 0.85fr) minmax(88px, 1fr) minmax(72px, 0.85fr) 56px';
const MOBILE_GRID = '58px minmax(0, 1fr) minmax(0, 0.75fr) minmax(0, 1fr) 52px';

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

const GridBadge = styled.span`
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: 0.2rem 0.45rem;
  background: var(--table-header-bg);
  border: 1px solid var(--border-light);
  color: var(--accent-primary);
  border-radius: 6px;
  font-weight: 700;
  font-size: 0.72rem;
  line-height: 1.15;
  white-space: nowrap;

  @media (max-width: 768px) {
    font-size: 0.66rem;
    padding: 0.18rem 0.35rem;
  }
`;

const GridMineCount = styled.span`
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--text-secondary);

  @media (max-width: 768px) {
    font-size: 0.58rem;
  }
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

const LoadingState = styled.div`
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
    transform: scale(1.05);
  }
`;

const PageInfo = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  width: 100%;
  flex-shrink: 0;
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
    background: var(--border-color);
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
    background: var(--border-color);
    border-color: var(--accent-primary);
    transform: scale(1.1);
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

const InfoTooltip = styled.div`
  position: fixed;
  background: var(--bg-card);
  border: 2px solid var(--border-light);
  border-radius: 12px;
  padding: 1.25rem;
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

// MiniGrid Component for game visualization
const MiniGridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 2px;
  width: 100%;
  max-width: 120px;
  margin: 0.75rem auto;
  padding: 6px;
  background: var(--table-header-bg);
  border-radius: 8px;
  border: 1px solid var(--border-light);
`;

const MiniTile = styled.div`
  aspect-ratio: 1;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--text-light);
  background: ${props => {
    if (props.$isHitMine) return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'; // Red - hit mine
    if (props.$isMine) return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'; // Orange/Yellow - other mines
    if (props.$isRevealed) return 'linear-gradient(135deg, #10b981 0%, #059669 100%)'; // Green - safe revealed
    return 'linear-gradient(135deg, #374151 0%, #1f2937 100%)'; // Gray - hidden
  }};
  box-shadow: ${props => {
    if (props.$isHitMine) return '0 0 4px rgba(239, 68, 68, 0.5)';
    if (props.$isMine) return '0 0 4px rgba(245, 158, 11, 0.4)';
    if (props.$isRevealed) return '0 0 4px rgba(16, 185, 129, 0.4)';
    return 'inset 0 1px 2px rgba(0, 0, 0, 0.2)';
  }};
`;

const MiniGridLegend = styled.div`
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 8px;
  flex-wrap: wrap;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.65rem;
  color: var(--text-secondary);
`;

const LegendDot = styled.div`
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: ${props => props.$color};
`;

// Leaderboard Styles
const LeaderboardContainer = styled.div`
  overflow-x: auto;
`;

const LeaderboardHeader = styled.div`
  display: grid;
  grid-template-columns: 40px 1fr 80px;
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
`;

const LeaderboardRow = styled.div`
  display: grid;
  grid-template-columns: 40px 1fr 80px;
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-light);
  font-size: 0.9rem;
  align-items: center;
  transition: background 0.2s ease;

  &:hover {
    background: var(--table-header-bg);
  }

  &:last-child {
    border-bottom: none;
  }
`;

const RankCell = styled.span`
  font-size: 0.85rem;
  font-weight: 700;
  color: ${props => {
    if (props.$rank === 1) return 'var(--accent-primary)';
    if (props.$rank === 2) return '#8e44ad';
    if (props.$rank === 3) return '#a855f7';
    return 'var(--text-primary)';
  }};
`;

const PlayerCell = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
`;

const Avatar = styled.img`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--border-light);
`;

const DefaultAvatar = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  flex-shrink: 0;
  background: linear-gradient(135deg, #6930c3 0%, #8e44ad 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-light);
  font-size: 0.6rem;
  font-weight: 700;
`;

const PlayerLink = styled.a`
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.2s ease;

  &:hover {
    color: var(--accent-primary);
  }
`;

const StatCell = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  text-align: right;
`;

const PnlContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
`;

const PnlCell = styled.span`
  font-size: 0.85rem;
  font-weight: 700;
  text-align: right;
  color: ${props => props.$positive ? 'var(--accent-green)' : 'var(--accent-red)'};
`;

const MonadIconImg = styled.img`
  width: 14px;
  height: 14px;
  border-radius: 50%;
`;

const FilterRow = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

const FilterButton = styled.button.attrs({ type: 'button' })`
  padding: 0.4rem 0.75rem;
  border: 2px solid var(--border-light);
  border-radius: 6px;
  background: transparent;
  color: var(--accent-primary);
  font-weight: 600;
  font-size: 0.75rem;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;

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
`;

const MiniGrid = ({ game }) => {
  const gridSize = game.grid_size || 25;
  const gridDim = Math.sqrt(gridSize);
  const minePositions = game.mine_positions || [];
  const revealedTiles = game.revealed_tiles || [];
  const hitMine = game.mine_hit_tile;

  const tiles = [];
  for (let i = 0; i < gridSize; i++) {
    const isMine = minePositions.includes(i);
    const isRevealed = revealedTiles.includes(i);
    const isHitMine = hitMine === i;

    tiles.push(
      <MiniTile
        key={i}
        $isMine={isMine}
        $isRevealed={isRevealed && !isHitMine}
        $isHitMine={isHitMine}
        title={`Tile ${i}${isMine ? ' (Mine)' : ''}${isRevealed ? ' (Revealed)' : ''}`}
      />
    );
  }

  return (
    <div>
      <MiniGridContainer style={{ gridTemplateColumns: `repeat(${gridDim}, 1fr)` }}>
        {tiles}
      </MiniGridContainer>
      <MiniGridLegend>
        <LegendItem><LegendDot $color="#10b981" /> Safe</LegendItem>
        <LegendItem><LegendDot $color="#f59e0b" /> Mine</LegendItem>
        <LegendItem><LegendDot $color="#ef4444" /> Hit</LegendItem>
      </MiniGridLegend>
    </div>
  );
};

const MONVISION_TX_URL = 'https://monvision.io/tx/';
const MONVISION_ADDRESS_URL = 'https://monvision.io/address/';

const getGridLabel = (size) => {
  const dim = Math.round(Math.sqrt(size));
  return `${dim}×${dim}`;
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

const formatAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const truncateHash = (hash) => {
  if (!hash) return '';
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
};

const ITEMS_PER_PAGE = 20;

const MinesHistory = ({ userAddress, isConnected, refreshTrigger }) => {
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
  const compactTabs = useCompactHistoryTabs({
    isSearchOpen,
    activeTab,
    includeLeaderboard: true,
  });
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const fetchGamesRef = useRef(null);
  const wasConnectedRef = useRef(isConnected);
  const { shouldBlockUI, markLoaded } = useHistoryFetchLoading();

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('weekly');
  const [leaderboardSortBy, setLeaderboardSortBy] = useState('points');
  const pendingGames = useRef({});

  // Switch to 'all' tab when wallet disconnects; default to 'my' when wallet connects
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

  // WebSocket connection for real-time updates
  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket(MINES_WS_URL);

        ws.onopen = () => {
          wsRef.current = ws;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // Backend sends 'gameResult' event when game completes (win or lose)
            if (data.event === 'gameResult') {
              // Refresh the games list
              fetchGamesRef.current?.();
            }
          } catch (err) {
            // Silent
          }
        };

        ws.onclose = () => {
          reconnectTimeoutRef.current = setTimeout(connect, 2000);
        };

        ws.onerror = () => {
          // Silent
        };
      } catch (err) {
        // Silent
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

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
          if (result.success) {
            setGames(result.games || []);
            setHasMore((result.games || []).length === ITEMS_PER_PAGE);
          } else {
            setGames([]);
            setHasMore(false);
          }
        } else if (activeTab === 'my' && userAddress) {
          // Fetch from main wallet
          let allGames = [];
          const mainResult = await getPlayerGames(userAddress, ITEMS_PER_PAGE, offset);
          if (mainResult.success && mainResult.games) {
            allGames = mainResult.games.map(game => ({ ...game, walletType: 'main' }));
          }

          // Also fetch from game wallet if exists
          if (hasGameWallet && gameWalletAddress) {
            const gameResult = await getPlayerGames(gameWalletAddress, ITEMS_PER_PAGE, offset);
            if (gameResult.success && gameResult.games) {
              const gameGames = gameResult.games.map(game => ({ ...game, walletType: 'game' }));
              allGames = [...allGames, ...gameGames];
            }
          }

          // Sort by timestamp (newest first)
          allGames.sort((a, b) => {
            const timeA = new Date(a.updated_at || a.updatedAt || a.created_at || a.createdAt).getTime();
            const timeB = new Date(b.updated_at || b.updatedAt || b.created_at || b.createdAt).getTime();
            return timeB - timeA;
          });

          // Remove duplicates by game_id
          const seen = new Set();
          const uniqueGames = allGames.filter(game => {
            const key = game.game_id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          // Paginate the merged result
          const paginatedGames = uniqueGames.slice(0, ITEMS_PER_PAGE);
          setGames(paginatedGames);
          setHasMore(uniqueGames.length > ITEMS_PER_PAGE);
        } else {
          // All games tab - no changes needed
          const result = await getRecentGames(ITEMS_PER_PAGE, offset);
          if (result.success) {
            setGames(result.games || []);
            setHasMore((result.games || []).length === ITEMS_PER_PAGE);
          }
        }
    } catch (err) {
      // Silent
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
    fetchGamesRef.current = () => fetchGames({ silent: true });
  }, [fetchGames]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  useEffect(() => {
    if (refreshTrigger <= 0) return;
    fetchGames({ silent: true });
  }, [refreshTrigger, fetchGames]);

  // Merge duplicate Discord users - keep first wallet, sum stats
  const mergeByDiscord = (players) => {
    const discordMap = new Map();
    const result = [];

    players.forEach(player => {
      const discordId = player.discord?.discordId;

      if (discordId && discordMap.has(discordId)) {
        const existing = discordMap.get(discordId);
        existing.stats.points = (parseFloat(existing.stats?.points || 0) + parseFloat(player.stats?.points || 0)).toString();
        existing.stats.pnl = (parseFloat(existing.stats?.pnl || 0) + parseFloat(player.stats?.pnl || 0)).toString();
      } else if (discordId) {
        const entry = { ...player, stats: { ...player.stats } };
        discordMap.set(discordId, entry);
        result.push(entry);
      } else {
        result.push(player);
      }
    });

    if (leaderboardSortBy === 'points') {
      result.sort((a, b) => parseFloat(b.stats?.points || 0) - parseFloat(a.stats?.points || 0));
    } else {
      result.sort((a, b) => parseFloat(b.stats?.pnl || 0) - parseFloat(a.stats?.pnl || 0));
    }

    return result.map((p, i) => ({ ...p, rank: i + 1 }));
  };

  // Fetch leaderboard
  useEffect(() => {
    if (activeTab !== 'leaderboard') return;

    const fetchLeaderboardData = async () => {
      setLeaderboardLoading(true);
      try {
        const data = await getLeaderboard(leaderboardPeriod, leaderboardSortBy, 20);
        if (data && data.success) {
          const merged = mergeByDiscord(data.leaderboard || []);
          setLeaderboard(merged);
        }
      } catch (error) {
        // Keep existing data on error
      }
      setLeaderboardLoading(false);
    };

    fetchLeaderboardData();
  }, [activeTab, leaderboardPeriod, leaderboardSortBy]);

  // Listen to GameStarted events - save bet amount for leaderboard
  useWatchContractEvent({
    address: MINES_CONTRACT_ADDRESS,
    abi: MINES_ABI,
    eventName: 'GameStarted',
    enabled: activeTab === 'leaderboard',
    onLogs: (logs) => {
      logs.forEach((log) => {
        try {
          const gameId = log.args.gameId?.toString();
          if (gameId) {
            pendingGames.current[gameId] = {
              player: log.args.player,
              betAmount: log.args.betAmount
            };
          }
        } catch (err) {}
      });
    }
  });

  // Listen to GameCompleted events and update leaderboard
  useWatchContractEvent({
    address: MINES_CONTRACT_ADDRESS,
    abi: MINES_ABI,
    eventName: 'GameCompleted',
    enabled: activeTab === 'leaderboard',
    onLogs: (logs) => {
      logs.forEach((log) => {
        try {
          const gameId = log.args.gameId?.toString();
          const player = log.args.player;
          const won = log.args.won;
          const payout = log.args.payout;

          const pendingGame = pendingGames.current[gameId];
          const betAmount = pendingGame?.betAmount;

          if (!betAmount || !player) return;

          const betMon = parseFloat(formatEther(betAmount));
          const payoutMon = payout ? parseFloat(formatEther(payout)) : 0;
          const points = betMon;
          const pnlChange = won ? (payoutMon - betMon) : -betMon;

          setLeaderboard(prev => {
            const updated = [...prev];
            const playerLower = player.toLowerCase();
            const existingIndex = updated.findIndex(p => p.player?.toLowerCase() === playerLower);

            if (existingIndex >= 0) {
              const existing = updated[existingIndex];
              updated[existingIndex] = {
                ...existing,
                stats: {
                  ...existing.stats,
                  points: (parseFloat(existing.stats?.points || 0) + points).toString(),
                  pnl: (parseFloat(existing.stats?.pnl || 0) + pnlChange).toString()
                }
              };
            } else {
              updated.push({
                player: player,
                rank: updated.length + 1,
                stats: {
                  points: points.toString(),
                  pnl: pnlChange.toString()
                }
              });
            }

            if (leaderboardSortBy === 'points') {
              updated.sort((a, b) => parseFloat(b.stats?.points || 0) - parseFloat(a.stats?.points || 0));
            } else {
              updated.sort((a, b) => parseFloat(b.stats?.pnl || 0) - parseFloat(a.stats?.pnl || 0));
            }

            return updated.slice(0, 20).map((p, i) => ({ ...p, rank: i + 1 }));
          });

          delete pendingGames.current[gameId];
        } catch (err) {}
      });
    }
  });

  // Close tooltip
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
      top: rect.top - 200,
      left: rect.left - 285
    });
    setSelectedGame(game);
    setOpenTooltip(gameId);
  };

  // Leaderboard helpers
  const formatPoints = (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(0);
  };

  const formatPnl = (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    const prefix = num >= 0 ? '+' : '';
    if (Math.abs(num) >= 1000) {
      return prefix + (num / 1000).toFixed(1) + 'K';
    }
    return prefix + num.toFixed(0);
  };

  const getPlayerDisplay = (player) => {
    if (player.discord?.username) {
      return player.discord.globalName || player.discord.username;
    }
    return formatAddress(player.player);
  };

  const getExplorerUrl = (address) => {
    return `https://monadexplorer.com/address/${address}`;
  };

  return (
    <Container>
      <Header>
        <Title>Game History</Title>
        <TabContainer>
          <Tab
            $active={activeTab === 'my'}
            $compact={compactTabs}
            data-active={activeTab === 'my'}
            onClick={() => handleTabChange('my')}
          >
            {historyTabLabel(compactTabs, 'my')}
          </Tab>
          <Tab
            $active={activeTab === 'all'}
            $compact={compactTabs}
            data-active={activeTab === 'all'}
            onClick={() => handleTabChange('all')}
          >
            {historyTabLabel(compactTabs, 'all')}
          </Tab>
          {!isSearchOpen && (
            <Tab
              $active={activeTab === 'leaderboard'}
              $compact={activeTab === 'leaderboard'}
              data-active={activeTab === 'leaderboard'}
              onClick={() => handleTabChange('leaderboard')}
            >
              {activeTab === 'leaderboard' ? 'Board' : 'Leaderboard'}
            </Tab>
          )}
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

      {activeTab === 'leaderboard' ? (
        <LeaderboardContainer>
          <FilterRow>
            <FilterButton
              $active={leaderboardPeriod === 'daily'}
              data-active={leaderboardPeriod === 'daily'}
              onClick={() => setLeaderboardPeriod('daily')}
            >
              Daily
            </FilterButton>
            <FilterButton
              $active={leaderboardPeriod === 'weekly'}
              data-active={leaderboardPeriod === 'weekly'}
              onClick={() => setLeaderboardPeriod('weekly')}
            >
              Weekly
            </FilterButton>
            <div style={{ width: '1px', height: '24px', background: 'var(--border-light)', margin: '0 0.25rem' }} />
            <FilterButton
              $active={leaderboardSortBy === 'points'}
              data-active={leaderboardSortBy === 'points'}
              onClick={() => setLeaderboardSortBy('points')}
            >
              Points
            </FilterButton>
            <FilterButton
              $active={leaderboardSortBy === 'pnl'}
              data-active={leaderboardSortBy === 'pnl'}
              onClick={() => setLeaderboardSortBy('pnl')}
            >
              PnL
            </FilterButton>
          </FilterRow>

          <LeaderboardHeader>
            <div>#</div>
            <div>Player</div>
            <div style={{ textAlign: 'right' }}>{leaderboardSortBy === 'points' ? 'Pts' : 'PnL'}</div>
          </LeaderboardHeader>

          {leaderboardLoading ? (
            <LoadingState>Loading...</LoadingState>
          ) : leaderboard.length === 0 ? (
            <EmptyState>No data available</EmptyState>
          ) : (
            leaderboard.map((player) => (
              <LeaderboardRow key={player.player}>
                <RankCell $rank={player.rank}>{player.rank}</RankCell>
                <PlayerCell>
                  {player.discord?.avatarUrl ? (
                    <Avatar src={player.discord.avatarUrl} alt="" />
                  ) : (
                    <DefaultAvatar>
                      {player.player.slice(2, 4).toUpperCase()}
                    </DefaultAvatar>
                  )}
                  <PlayerLink
                    href={getExplorerUrl(player.player)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={player.player}
                  >
                    {getPlayerDisplay(player)}
                  </PlayerLink>
                </PlayerCell>
                {leaderboardSortBy === 'points' ? (
                  <StatCell>{formatPoints(player.stats?.points)}</StatCell>
                ) : (
                  <PnlContainer>
                    <PnlCell $positive={parseFloat(player.stats?.pnl) >= 0}>
                      {formatPnl(player.stats?.pnl)}
                    </PnlCell>
                    <MonadIconImg src={monadIcon} alt="MON" />
                  </PnlContainer>
                )}
              </LeaderboardRow>
            ))
          )}
        </LeaderboardContainer>
      ) : (
        <Table>
          <TableHeader>
            <div>Grid</div>
            <div>Player</div>
            <div>Bet</div>
            <div>Result</div>
            <div className="hide-mobile">Payout</div>
            <div></div>
          </TableHeader>

          {loading ? (
            <>
              {[...Array(5)].map((_, i) => (
                <SkeletonRow key={i}>
                  <SkeletonCell $width="50px" />
                  <SkeletonCell $width="80px" />
                  <SkeletonCell $width="60px" />
                  <SkeletonCell $width="60px" />
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
              <TableRow key={game.game_id}>
                <Cell>
                  <GridBadge title={`${getGridLabel(game.grid_size)} · ${game.mine_count} mines`}>
                    <span>{getGridLabel(game.grid_size)}</span>
                    <GridMineCount>{game.mine_count} mines</GridMineCount>
                  </GridBadge>
                </Cell>
                <Cell>
                  <TxLink
                    href={`${MONVISION_ADDRESS_URL}${game.player}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={game.player}
                  >
                    {formatAddress(game.player)}
                  </TxLink>
                </Cell>
                <Cell className="align-end">{formatAmount(game.bet_amount)}</Cell>
                <Cell>
                  <ResultBadge $won={game.won}>
                    {game.won ? `${game.revealed_count} tiles` : 'Mine hit'}
                  </ResultBadge>
                </Cell>
                <Cell className="hide-mobile align-end">
                  {game.won ? (
                    <span style={{ color: 'var(--accent-green)', fontWeight: '600' }}>
                      +{formatAmount(game.payout)}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--accent-red)', fontWeight: '600' }}>
                      -{formatAmount(game.bet_amount)}
                    </span>
                  )}
                </Cell>
                <Cell>
                  <ActionButtons className="info-tooltip-wrapper">
                    <VerifyButton onClick={() => navigate(`/mines/verify/${game.game_id}`)} title="Verify">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        <path d="M9 12l2 2 4-4"/>
                      </svg>
                    </VerifyButton>
                    <InfoButton onClick={(e) => handleInfoClick(game.game_id, game, e)}>i</InfoButton>
                  </ActionButtons>
                </Cell>
              </TableRow>
            ))
          )}

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
        </Table>
      )}

      {/* Global Tooltip */}
      {openTooltip && selectedGame && (
        <InfoTooltip className="info-tooltip" style={{ top: tooltipPos.top, left: tooltipPos.left }}>
          {/* MiniGrid visualization */}
          {selectedGame.mine_positions && selectedGame.mine_positions.length > 0 && (
            <MiniGrid game={selectedGame} />
          )}
          <InfoRow>
            <InfoLabel>Game ID</InfoLabel>
            <TooltipTxLink
              href={`/mines/verify/${selectedGame.game_id}`}
              onClick={(e) => {
                e.preventDefault();
                setOpenTooltip(null);
                setSelectedGame(null);
                navigate(`/mines/verify/${selectedGame.game_id}`);
              }}
            >
              #{selectedGame.game_id}
            </TooltipTxLink>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Grid Size</InfoLabel>
            <InfoValue>{getGridLabel(selectedGame.grid_size)}</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Mines</InfoLabel>
            <InfoValue>{selectedGame.mine_count}</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Tiles Revealed</InfoLabel>
            <InfoValue>{selectedGame.revealed_count}</InfoValue>
          </InfoRow>
          {selectedGame.won && (
            <InfoRow>
              <InfoLabel>Multiplier</InfoLabel>
              <InfoValue>{(selectedGame.current_multiplier || selectedGame.multiplier) ? `${((selectedGame.current_multiplier || selectedGame.multiplier) / 10000).toFixed(2)}x` : '-'}</InfoValue>
            </InfoRow>
          )}
          {selectedGame.sequence_number && (
            <InfoRow>
              <InfoLabel>Sequence</InfoLabel>
              <TooltipTxLink
                href={`https://entropy-explorer.pyth.network/?search=${selectedGame.sequence_number}&chain=monad`}
                target="_blank"
                rel="noopener noreferrer"
              >
                #{selectedGame.sequence_number}
              </TooltipTxLink>
            </InfoRow>
          )}
          {selectedGame.vrf_seed && (
            <InfoRow>
              <InfoLabel>Seed</InfoLabel>
              <InfoValue style={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>
                {selectedGame.vrf_seed.slice(0, 10)}...{selectedGame.vrf_seed.slice(-8)}
              </InfoValue>
            </InfoRow>
          )}
          {selectedGame.start_tx_hash && (
            <InfoRow>
              <InfoLabel>Start Tx</InfoLabel>
              <TooltipTxLink href={`${MONVISION_TX_URL}${selectedGame.start_tx_hash}`} target="_blank" rel="noopener noreferrer">
                {truncateHash(selectedGame.start_tx_hash)}
              </TooltipTxLink>
            </InfoRow>
          )}
          {selectedGame.result_tx_hash && (
            <InfoRow>
              <InfoLabel>Result Tx</InfoLabel>
              <TooltipTxLink href={`${MONVISION_TX_URL}${selectedGame.result_tx_hash}`} target="_blank" rel="noopener noreferrer">
                {truncateHash(selectedGame.result_tx_hash)}
              </TooltipTxLink>
            </InfoRow>
          )}
          {(selectedGame.updated_at || selectedGame.updatedAt) && (
            <InfoRow>
              <InfoLabel>Date</InfoLabel>
              <InfoValue>
                {new Date(selectedGame.updated_at || selectedGame.updatedAt).toLocaleString()}
              </InfoValue>
            </InfoRow>
          )}
        </InfoTooltip>
      )}
    </Container>
  );
};

export default MinesHistory;
