import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { formatEther } from 'viem';
import monadIcon from '../../../assets/images/monad.png';
import { KENO_API_URL, KENO_WS_URL } from '../utils/constants';
import { getLeaderboard } from '../utils/kenoApi';
import { useGameWallet } from '../../../context';
import HistoryAddressSearch from '../../common/HistoryAddressSearch';
import { useHistoryFetchLoading } from '../../../hooks/useHistoryFetchLoading';
import { useCompactHistoryTabs, historyTabLabel } from '../../../hooks/useIsMobile';
import { useWatchContractEvent } from 'wagmi';
import { KENO_CONTRACT_ADDRESS, KENO_ABI } from '../utils/constants';

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

const DESKTOP_GRID = 'minmax(88px, 1fr) 68px 64px 76px minmax(56px, 0.85fr) minmax(72px, 0.85fr) 56px';
const MOBILE_GRID = 'minmax(0, 1fr) 58px minmax(0, 0.85fr) minmax(0, 0.75fr) 52px';

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
  color: var(--text-primary);
  align-items: center;
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

const PicksBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0.25rem 0.5rem;
  background: var(--table-header-bg);
  color: var(--accent-primary);
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.75rem;
  white-space: nowrap;

  @media (max-width: 768px) {
    padding: 0.18rem 0.35rem;
    font-size: 0.64rem;
  }
`;

const ResultBadge = styled.span`
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.75rem;
  background: ${props => props.$won ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
  color: ${props => props.$won ? 'var(--accent-green)' : 'var(--accent-red)'};
  white-space: nowrap;

  @media (max-width: 768px) {
    padding: 0.18rem 0.3rem;
    font-size: 0.64rem;
  }
`;

const RiskBadge = styled.span`
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.65rem;
  background: ${props => props.$color}15;
  color: ${props => props.$color};
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.3px;

  @media (max-width: 768px) {
    padding: 0.12rem 0.28rem;
    font-size: 0.58rem;
  }
`;

const TxLink = styled.a`
  color: var(--accent-primary);
  text-decoration: none;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    text-decoration: underline;
  }

  @media (max-width: 768px) {
    font-size: 0.68rem;
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

const InfoTooltip = styled.div`
  position: fixed;
  background: var(--bg-card);
  border: 2px solid var(--border-light);
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 8px 25px var(--shadow-color);
  min-width: 320px;
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
    color: var(--accent-primary);
    opacity: 0.8;
    text-decoration: underline;
  }

  &::after {
    content: '↗';
    font-size: 0.7rem;
  }
`;

// MiniGrid Component for Keno game visualization (8x5 = 40 numbers)
const MiniGridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 3px;
  width: 100%;
  max-width: 260px;
  margin: 0.75rem auto;
  padding: 8px;
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
  font-size: 9px;
  font-weight: 600;
  color: var(--text-light);
  background: ${props => {
    if (props.$isHit) return 'linear-gradient(135deg, #10b981 0%, #059669 100%)'; // Green - hit (selected & drawn)
    if (props.$isSelected) return 'linear-gradient(135deg, #6930c3 0%, #8e44ad 100%)'; // Purple - selected but not drawn
    if (props.$isDrawn) return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'; // Orange - drawn but not selected
    return 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'; // Gray - not involved
  }};
  box-shadow: ${props => {
    if (props.$isHit) return '0 0 4px rgba(16, 185, 129, 0.5)';
    if (props.$isSelected) return '0 0 4px rgba(105, 48, 195, 0.4)';
    if (props.$isDrawn) return '0 0 4px rgba(245, 158, 11, 0.4)';
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

const MonadIconImg = styled.img`
  width: 14px;
  height: 14px;
  border-radius: 50%;
`;

const MiniGrid = ({ game }) => {
  const selectedNumbers = new Set(game.selected_numbers || []);
  const drawnNumbers = new Set(game.drawn_numbers || []);

  const tiles = [];
  for (let i = 1; i <= 40; i++) {
    const isSelected = selectedNumbers.has(i);
    const isDrawn = drawnNumbers.has(i);
    const isHit = isSelected && isDrawn;

    tiles.push(
      <MiniTile
        key={i}
        $isHit={isHit}
        $isSelected={isSelected && !isHit}
        $isDrawn={isDrawn && !isHit}
        title={`${i}${isHit ? ' (Hit!)' : isSelected ? ' (Selected)' : isDrawn ? ' (Drawn)' : ''}`}
      >
        {i}
      </MiniTile>
    );
  }

  return (
    <div>
      <MiniGridContainer>
        {tiles}
      </MiniGridContainer>
      <MiniGridLegend>
        <LegendItem><LegendDot $color="#10b981" /> Hit</LegendItem>
        <LegendItem><LegendDot $color="#6930c3" /> Selected</LegendItem>
        <LegendItem><LegendDot $color="#f59e0b" /> Drawn</LegendItem>
      </MiniGridLegend>
    </div>
  );
};

// Leaderboard Styles
const LeaderboardContainer = styled.div`
  overflow-x: auto;
`;

const LeaderboardHeader = styled.div`
  display: grid;
  grid-template-columns: 40px 1fr 80px;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
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
  padding: 0.75rem 1rem;
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
  background: var(--table-header-bg);
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

const MONVISION_TX_URL = 'https://monvision.io/tx/';
const MONVISION_ADDRESS_URL = 'https://monvision.io/address/';

const RISK_LABELS = ['Classic', 'Low', 'Medium', 'High'];
const RISK_COLORS = {
  0: '#6930c3', // Classic - purple
  1: '#10b981', // Low - green
  2: '#f59e0b', // Medium - orange
  3: '#ef4444'  // High - red
};

const getRiskLabel = (riskLevel) => {
  return RISK_LABELS[riskLevel] || 'Classic';
};

const getRiskColor = (riskLevel) => {
  return RISK_COLORS[riskLevel] || RISK_COLORS[0];
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
  return `${address.slice(0, 4)}...${address.slice(-3)}`;
};

const truncateHash = (hash) => {
  if (!hash) return '';
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
};

const ITEMS_PER_PAGE = 20;

const KenoHistory = ({ userAddress, isConnected, refreshTrigger }) => {
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
        const ws = new WebSocket(KENO_WS_URL);

        ws.onopen = () => {
          wsRef.current = ws;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === 'gameResult') {
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

  // Fetch games - from both main wallet and game wallet
  const fetchGames = useCallback(async ({ silent = false } = {}) => {
    if (shouldBlockUI({ silent })) {
      setLoading(true);
    }
    try {
      if (activeTab === 'search') {
        if (!searchedAddress) {
          setGames([]);
          setHasMore(false);
          return;
        }

        const endpoint = `${KENO_API_URL}/history?player=${searchedAddress}&page=${currentPage}&limit=${ITEMS_PER_PAGE}`;
        const response = await fetch(endpoint);
        if (response.ok) {
          const data = await response.json();
          setGames(data.games || []);
          setHasMore((data.games || []).length === ITEMS_PER_PAGE);
        } else {
          setGames([]);
          setHasMore(false);
        }
        return;
      }

      // If "all" tab or no user address, fetch global history
      if (activeTab !== 'my' || !userAddress) {
        const endpoint = `${KENO_API_URL}/history?page=${currentPage}&limit=${ITEMS_PER_PAGE}`;
        const response = await fetch(endpoint);
        if (response.ok) {
          const data = await response.json();
          setGames(data.games || []);
          setHasMore((data.games || []).length === ITEMS_PER_PAGE);
        }
        return;
      }

      // "My Games" tab - fetch from main wallet only
      const endpoint = `${KENO_API_URL}/history?player=${userAddress}&page=${currentPage}&limit=${ITEMS_PER_PAGE}`;
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setGames(data.games || []);
        setHasMore((data.games || []).length === ITEMS_PER_PAGE);
      }

      // "My Games" tab - fetch from both main wallet and game wallet
      let allGames = [];

      // Fetch main wallet games
      const mainEndpoint = `${KENO_API_URL}/history?player=${userAddress}&page=${currentPage}&limit=${ITEMS_PER_PAGE}`;
      const mainResponse = await fetch(mainEndpoint);
      if (mainResponse.ok) {
        const mainData = await mainResponse.json();
        if (mainData.games) {
          allGames = mainData.games.map(game => ({ ...game, walletType: 'main' }));
        }
      }

      // Fetch game wallet games if exists
      if (hasGameWallet && gameWalletAddress) {
        const gameEndpoint = `${KENO_API_URL}/history?player=${gameWalletAddress}&page=${currentPage}&limit=${ITEMS_PER_PAGE}`;
        const gameResponse = await fetch(gameEndpoint);
        if (gameResponse.ok) {
          const gameData = await gameResponse.json();
          if (gameData.games) {
            const gameGames = gameData.games.map(game => ({ ...game, walletType: 'game' }));
            allGames = [...allGames, ...gameGames];
          }
        }
      }

      // Sort by timestamp (newest first)
      allGames.sort((a, b) => {
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
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

      setGames(uniqueGames.slice(0, ITEMS_PER_PAGE));
      setHasMore(uniqueGames.length >= ITEMS_PER_PAGE);
    } catch (err) {
      // Silent
    } finally {
      setLoading(false);
      markLoaded();
    }
  }, [
    activeTab,
    userAddress,
    currentPage,
    hasGameWallet,
    gameWalletAddress,
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

  // Listen to GameResult events and update leaderboard in real-time
  useWatchContractEvent({
    address: KENO_CONTRACT_ADDRESS,
    abi: KENO_ABI,
    eventName: 'GameResult',
    enabled: activeTab === 'leaderboard',
    onLogs: (logs) => {
      logs.forEach((log) => {
        try {
          const player = log.args.player;
          const betAmount = log.args.betAmount;
          const won = log.args.won;
          const payout = log.args.payout;

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
      top: rect.top - 320,
      left: rect.left - 325
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

  // Get multiplier for game (stored in game object from backend)
  const getGameMultiplier = (game) => {
    return game.multiplier || 0;
  };

  return (
    <Container>
      <Header>
        <Title>Game History</Title>
        <TabContainer>
          <Tab
            $active={activeTab === 'my'}
            $compact={compactTabs}
            data-active={activeTab === 'my' ? 'true' : 'false'}
            onClick={() => handleTabChange('my')}
          >
            {historyTabLabel(compactTabs, 'my')}
          </Tab>
          <Tab
            $active={activeTab === 'all'}
            $compact={compactTabs}
            data-active={activeTab === 'all' ? 'true' : 'false'}
            onClick={() => handleTabChange('all')}
          >
            {historyTabLabel(compactTabs, 'all')}
          </Tab>
          {!isSearchOpen && (
            <Tab
              $active={activeTab === 'leaderboard'}
              $compact={activeTab === 'leaderboard'}
              data-active={activeTab === 'leaderboard' ? 'true' : 'false'}
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
              data-active={leaderboardPeriod === 'daily' ? 'true' : 'false'}
              onClick={() => setLeaderboardPeriod('daily')}
            >
              Daily
            </FilterButton>
            <FilterButton
              $active={leaderboardPeriod === 'weekly'}
              data-active={leaderboardPeriod === 'weekly' ? 'true' : 'false'}
              onClick={() => setLeaderboardPeriod('weekly')}
            >
              Weekly
            </FilterButton>
            <div style={{ width: '1px', height: '24px', background: 'var(--border-light)', margin: '0 0.25rem' }} />
            <FilterButton
              $active={leaderboardSortBy === 'points'}
              data-active={leaderboardSortBy === 'points' ? 'true' : 'false'}
              onClick={() => setLeaderboardSortBy('points')}
            >
              Points
            </FilterButton>
            <FilterButton
              $active={leaderboardSortBy === 'pnl'}
              data-active={leaderboardSortBy === 'pnl' ? 'true' : 'false'}
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
            <div>Player</div>
            <div>Picks</div>
            <div className="hide-mobile">Risk</div>
            <div>Result</div>
            <div>Bet</div>
            <div className="hide-mobile">Payout</div>
            <div></div>
          </TableHeader>

          {loading ? (
            <>
              {[...Array(5)].map((_, i) => (
                <SkeletonRow key={i}>
                <SkeletonCell $width="72px" />
                <SkeletonCell $width="52px" />
                <SkeletonCell $width="48px" className="hide-mobile" />
                <SkeletonCell $width="56px" />
                <SkeletonCell $width="52px" />
                <SkeletonCell $width="52px" className="hide-mobile" />
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
                  <TxLink
                    href={`${MONVISION_ADDRESS_URL}${game.player}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={game.player}
                  >
                    {formatAddress(game.player)}
                  </TxLink>
                </Cell>
                <Cell>
                  <PicksBadge title={`${(game.selected_numbers || []).length} numbers selected`}>
                    {(game.selected_numbers || []).length} picks
                  </PicksBadge>
                </Cell>
                <Cell className="hide-mobile">
                  <RiskBadge $color={getRiskColor(game.risk_level)}>
                    {getRiskLabel(game.risk_level)}
                  </RiskBadge>
                </Cell>
                <Cell>
                  <ResultBadge $won={game.won}>
                    {game.hits} hits
                  </ResultBadge>
                </Cell>
                <Cell className="align-end">
                  <MonadIconImg src={monadIcon} alt="MON" style={{ width: 14, height: 14, flexShrink: 0 }} />
                  {formatAmount(game.bet_amount)}
                </Cell>
                <Cell className="hide-mobile align-end">
                  {game.won ? (
                    <span style={{ color: 'var(--accent-green)', fontWeight: '600' }}>
                      +{formatAmount(game.payout)}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--accent-red)', fontWeight: '600' }}>
                      0
                    </span>
                  )}
                </Cell>
                <Cell>
                  <ActionButtons className="info-tooltip-wrapper">
                    <VerifyButton onClick={() => navigate(`/keno/verify/${game.game_id}`)} title="Verify">
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
          <MiniGrid game={selectedGame} />

          <InfoRow>
            <InfoLabel>Player</InfoLabel>
            <TooltipTxLink
              href={`${MONVISION_ADDRESS_URL}${selectedGame.player}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {formatAddress(selectedGame.player)}
            </TooltipTxLink>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Bet Amount</InfoLabel>
            <InfoValue>{formatAmount(selectedGame.bet_amount)} MON</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Picks</InfoLabel>
            <InfoValue>{(selectedGame.selected_numbers || []).length}</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Risk Level</InfoLabel>
            <InfoValue style={{ color: getRiskColor(selectedGame.risk_level) }}>
              {getRiskLabel(selectedGame.risk_level)}
            </InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Hits</InfoLabel>
            <InfoValue style={{ color: selectedGame.won ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {selectedGame.hits} / {(selectedGame.selected_numbers || []).length}
            </InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Multiplier</InfoLabel>
            <InfoValue>{getGameMultiplier(selectedGame)}x</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Payout</InfoLabel>
            <InfoValue style={{ color: selectedGame.won ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {selectedGame.won ? `+${formatAmount(selectedGame.payout)}` : `-${formatAmount(selectedGame.bet_amount)}`} MON
            </InfoValue>
          </InfoRow>
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
          {selectedGame.timestamp && (
            <InfoRow>
              <InfoLabel>Date</InfoLabel>
              <InfoValue>
                {new Date(selectedGame.timestamp * 1000).toLocaleString()}
              </InfoValue>
            </InfoRow>
          )}
        </InfoTooltip>
      )}
    </Container>
  );
};

export default KenoHistory;
