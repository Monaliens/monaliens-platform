import React, { memo, useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import styled, { keyframes, css } from 'styled-components';
import axios from 'axios';
import { io } from 'socket.io-client';
import monadIcon from '../../../assets/images/monad.png';

const API_BASE_URL = process.env.API_URL || 'https://your-api-url';

const GAMES = ['flip', 'dice', 'limbo', 'hilo', 'keno', 'plinko', 'mines', 'blackjack'];
const GAME_LABELS = {
  flip: 'Flip',
  dice: 'Dice',
  limbo: 'Limbo',
  hilo: 'HiLo',
  keno: 'Keno',
  plinko: 'Plinko',
  mines: 'Mines',
  blackjack: 'BJ'
};

// MEMORY OPTIMIZATION: Simple LRU cache implementation
const createLRUCache = (maxSize = 50) => {
  const cache = new Map();
  
  return {
    get: (key) => {
      if (!cache.has(key)) return undefined;
      // Move to end (most recently used)
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      return value;
    },
    set: (key, value) => {
      if (cache.has(key)) cache.delete(key);
      else if (cache.size >= maxSize) {
        // Delete oldest (first) entry
        cache.delete(cache.keys().next().value);
      }
      cache.set(key, value);
    },
    has: (key) => cache.has(key),
    delete: (key) => cache.delete(key),
    clear: () => cache.clear(),
    size: () => cache.size
  };
};

// MEMORY OPTIMIZATION: Caches with size limits
const dataCache = {
  pnl: {},
  volume: {}
};

// MEMORY OPTIMIZATION: LRU cache for holder info (max 100 entries)
const holderCache = createLRUCache(100);

// Previous ranks cache for animations (cleared periodically)
const prevRanksCache = {
  pnl: {},
  volume: {}
};

// MEMORY OPTIMIZATION: Clear old rank data periodically
let rankCacheCleanupInterval = null;
const startRankCacheCleanup = () => {
  if (rankCacheCleanupInterval) return;
  rankCacheCleanupInterval = setInterval(() => {
    // Clear rank caches every 5 minutes to prevent unbounded growth
    Object.keys(prevRanksCache.pnl).forEach(key => {
      if (Object.keys(prevRanksCache.pnl[key] || {}).length > 100) {
        prevRanksCache.pnl[key] = {};
      }
    });
    Object.keys(prevRanksCache.volume).forEach(key => {
      if (Object.keys(prevRanksCache.volume[key] || {}).length > 100) {
        prevRanksCache.volume[key] = {};
      }
    });
  }, 300000); // 5 minutes
};

// Single shared socket instance
let socket = null;
let socketSubscribers = new Set();

const getSocket = () => {
  if (!socket) {
    socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      socket.emit('subscribe:tournament', { game: 'total' });
    });

    socket.on('subscribed:tournament', () => {
      // Subscription successful
    });
  }
  return socket;
};

const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
`;

// Rank up animation (green glow)
const rankUpGlow = keyframes`
  0% {
    background: rgba(22, 163, 74, 0.3);
    box-shadow: 0 0 8px rgba(22, 163, 74, 0.4);
  }
  50% {
    background: rgba(22, 163, 74, 0.15);
    box-shadow: 0 0 12px rgba(22, 163, 74, 0.3);
  }
  100% {
    background: transparent;
    box-shadow: none;
  }
`;

// Rank down animation (red glow)
const rankDownGlow = keyframes`
  0% {
    background: rgba(220, 38, 38, 0.3);
    box-shadow: 0 0 8px rgba(220, 38, 38, 0.4);
  }
  50% {
    background: rgba(220, 38, 38, 0.15);
    box-shadow: 0 0 12px rgba(220, 38, 38, 0.3);
  }
  100% {
    background: transparent;
    box-shadow: none;
  }
`;

// New entry animation (green slide in)
const newEntrySlide = keyframes`
  0% {
    opacity: 0;
    transform: translateX(-20px);
    background: rgba(22, 163, 74, 0.4);
  }
  30% {
    opacity: 1;
    transform: translateX(0);
    background: rgba(22, 163, 74, 0.3);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
    background: transparent;
  }
`;

const Panel = styled.div`
  background: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 4px 15px var(--shadow-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
`;

const PanelTitle = styled.h3`
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
`;

const ToggleContainer = styled.div`
  display: inline-flex;
  padding: 2px;
  background: var(--bg-glass);
  border-radius: 6px;
  gap: 2px;
`;

const ToggleButton = styled.button`
  padding: 4px 10px;
  background: ${props => props.$active
    ? 'linear-gradient(135deg, var(--accent-primary) 0%, #8e44ad 100%)'
    : 'transparent'
  };
  color: ${props => props.$active ? 'var(--text-light)' : 'var(--text-secondary)'};
  border: none;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: ${props => props.$active ? 'white' : 'var(--accent-primary)'};
  }
`;

// Regular panel header (for individual games)
const ListHeader = styled.div`
  display: grid;
  grid-template-columns: 32px 1fr 70px;
  padding: 10px 14px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
`;

// All Games header with game columns
const AllGamesHeader = styled.div`
  display: grid;
  grid-template-columns: 32px 140px repeat(8, 1fr) 70px;
  padding: 10px 14px;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  gap: 4px;

  @media (max-width: 768px) {
    grid-template-columns: 32px 1fr 70px;
  }
`;

const GameHeaderCell = styled.span`
  text-align: center;
  font-size: 9px;

  @media (max-width: 768px) {
    display: none;
  }
`;

const ListContainer = styled.div`
  flex: 1;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(105, 48, 195, 0.2);
    border-radius: 2px;
  }
`;

// Animation mixin
const getRowAnimation = (changeType) => {
  if (changeType === 'up') {
    return css`animation: ${rankUpGlow} 2s ease-out forwards;`;
  }
  if (changeType === 'down') {
    return css`animation: ${rankDownGlow} 2s ease-out forwards;`;
  }
  if (changeType === 'new') {
    return css`animation: ${newEntrySlide} 1.5s ease-out forwards;`;
  }
  return '';
};

// PERFORMANCE FIX: Use attrs for frequently changing values to avoid class generation
// Regular list item (for individual games)
const ListItem = styled.div.attrs(props => ({
  style: {
    transform: `translateY(${props.$offset || 0}px)`,
    transition: props.$isAnimating
      ? 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s ease'
      : 'background 0.15s ease'
  }
}))`
  display: grid;
  grid-template-columns: 32px 1fr 70px;
  padding: 8px 14px;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  ${props => getRowAnimation(props.$changeType)}

  &:hover {
    background: var(--bg-glass);
  }

  &:last-child {
    border-bottom: none;
  }
`;

// PERFORMANCE FIX: Use attrs for frequently changing values to avoid class generation
// All Games list item with game columns
const AllGamesItem = styled.div.attrs(props => ({
  style: {
    transform: `translateY(${props.$offset || 0}px)`,
    transition: props.$isAnimating
      ? 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s ease'
      : 'background 0.15s ease'
  }
}))`
  display: grid;
  grid-template-columns: 32px 140px repeat(8, 1fr) 70px;
  padding: 8px 14px;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  gap: 4px;
  ${props => getRowAnimation(props.$changeType)}

  &:hover {
    background: var(--bg-glass);
  }

  &:last-child {
    border-bottom: none;
  }

  @media (max-width: 768px) {
    grid-template-columns: 32px 1fr 70px;
    cursor: pointer;
  }
`;

const Rank = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
`;

const PlayerInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const Avatar = styled.img`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
`;

const DefaultAvatar = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6930c3 0%, #8e44ad 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-light);
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
`;

const PlayerName = styled.a`
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.15s ease;

  &:hover {
    color: var(--accent-primary);
  }
`;

const PnlContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
`;

const PnlValue = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${props => {
    if (props.$isHolder) return 'var(--accent-primary)';
    const val = parseFloat(props.$value);
    if (val > 0) return 'var(--accent-green)';
    if (val < 0) return 'var(--accent-red)';
    return 'var(--text-tertiary)';
  }};
`;

const MultiplierBadge = styled.span`
  font-size: 9px;
  font-weight: 700;
  color: var(--text-light);
  background: linear-gradient(135deg, #6930c3 0%, #8b5cf6 100%);
  padding: 2px 4px;
  border-radius: 4px;
  margin-left: 4px;
`;

const CollectionLogo = styled.img`
  width: 16px;
  height: 16px;
  border-radius: 4px;
  margin-left: 4px;
  object-fit: cover;
`;

const MonadIcon = styled.img`
  width: 14px;
  height: 14px;
  border-radius: 50%;
`;

// Game breakdown cell
const GameCell = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 11px;
  font-weight: 600;
  color: ${props => {
    if (props.$value === undefined || props.$value === null || props.$value === 0) return 'var(--text-tertiary)';
    const val = parseFloat(props.$value);
    if (props.$isPnl) {
      if (val > 0) return 'var(--accent-green)';
      if (val < 0) return 'var(--accent-red)';
    }
    return 'var(--text-primary)';
  }};

  @media (max-width: 768px) {
    display: none;
  }
`;

const GameMonIcon = styled.img`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  opacity: 0.9;
`;

const SkeletonRow = styled.div`
  display: grid;
  grid-template-columns: 32px 1fr 70px;
  padding: 8px 14px;
  align-items: center;
  gap: 10px;
`;

const AllGamesSkeletonRow = styled.div`
  display: grid;
  grid-template-columns: 32px 140px repeat(8, 1fr) 70px;
  padding: 8px 14px;
  align-items: center;
  gap: 4px;
`;

const SkeletonBox = styled.div`
  background: linear-gradient(90deg, rgba(105,48,195,0.06) 0%, rgba(105,48,195,0.12) 50%, rgba(105,48,195,0.06) 100%);
  background-size: 200px 100%;
  animation: ${shimmer} 1.5s infinite linear;
  border-radius: 4px;
  height: ${props => props.$height || '12px'};
  width: ${props => props.$width || '100%'};
`;

const SkeletonAvatar = styled(SkeletonBox)`
  width: 20px;
  height: 20px;
  border-radius: 50%;
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: var(--text-secondary);
  font-size: 12px;
`;

// Mobile breakdown tooltip
const TooltipOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 999;
`;

const TooltipPanel = styled.div`
  position: fixed;
  background: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 8px 30px var(--shadow-color);
  padding: 16px;
  z-index: 1000;
  min-width: 220px;
  max-width: 280px;

  @media (max-width: 768px) {
    left: 50% !important;
    right: auto !important;
    transform: translateX(-50%);
    width: calc(100vw - 32px);
    max-width: 320px;
  }
`;

const TooltipHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 12px;
`;

const TooltipPlayerName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
`;

const TooltipTitle = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
`;

const TooltipGameList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const TooltipGameRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--border-color);

  &:last-child {
    border-bottom: none;
  }
`;

const TooltipGameName = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
`;

const TooltipGameValue = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: ${props => {
    if (props.$value === undefined || props.$value === null || parseFloat(props.$value) === 0) return 'var(--text-tertiary)';
    const val = parseFloat(props.$value);
    if (props.$isPnl) {
      if (val > 0) return 'var(--accent-green)';
      if (val < 0) return 'var(--accent-red)';
    }
    return 'var(--text-primary)';
  }};
`;

const TooltipMonIcon = styled.img`
  width: 12px;
  height: 12px;
  border-radius: 50%;
`;

const LeaderboardPanel = memo(({ game, title }) => {
  const [sortBy, setSortBy] = useState('pnl');
  const [pnlData, setPnlData] = useState(() => dataCache.pnl[game] || []);
  const [volumeData, setVolumeData] = useState(() => dataCache.volume[game] || []);
  const [initialLoading, setInitialLoading] = useState(!dataCache.pnl[game] && !dataCache.volume[game]);
  const [rankChanges, setRankChanges] = useState({});
  const [positionOffsets, setPositionOffsets] = useState({});
  const [isToggleAnimating, setIsToggleAnimating] = useState(false);
  const [tooltipPlayer, setTooltipPlayer] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const mountedRef = useRef(true);
  const isFirstFetch = useRef(true);
  const sortByRef = useRef(sortBy);
  const fetchAllDataRef = useRef(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  // Keep refs in sync
  useEffect(() => {
    sortByRef.current = sortBy;
  }, [sortBy]);

  const isAllGames = game === 'total';
  const leaderboard = sortBy === 'pnl' ? pnlData : volumeData;
  const prevLeaderboardRef = useRef([]);

  // FLIP animation for any leaderboard change (toggle or data update)
  useLayoutEffect(() => {
    const prevData = prevLeaderboardRef.current;
    const newData = leaderboard;

    if (prevData.length === 0 || newData.length === 0) {
      prevLeaderboardRef.current = [...newData];
      return;
    }

    // Create position maps
    const oldPositions = {};
    prevData.forEach((player, index) => {
      oldPositions[player.player] = index;
    });

    const newPositions = {};
    newData.forEach((player, index) => {
      newPositions[player.player] = index;
    });

    // Calculate offsets (FLIP: First, Last, Invert, Play)
    const ROW_HEIGHT = 44; // Approximate row height in pixels
    const offsets = {};

    newData.forEach((player) => {
      const oldIndex = oldPositions[player.player];
      const newIndex = newPositions[player.player];

      if (oldIndex !== undefined && oldIndex !== newIndex) {
        // Start from old position (inverted offset)
        offsets[player.player] = (oldIndex - newIndex) * ROW_HEIGHT;
      }
    });

    // Update ref for next comparison
    prevLeaderboardRef.current = [...newData];

    if (Object.keys(offsets).length > 0) {
      // Step 1: Set initial offsets WITHOUT animation (instant jump to old positions)
      setIsToggleAnimating(false);
      setPositionOffsets(offsets);

      // Step 2: Wait for browser to paint the offset positions
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Step 3: Enable animation and clear offsets (animate to final positions)
          setIsToggleAnimating(true);
          setPositionOffsets({});

          // Step 4: Disable animation flag after transition completes
          setTimeout(() => {
            setIsToggleAnimating(false);
          }, 900);
        });
      });
    }
  }, [leaderboard]);

  const shortenAddress = useCallback((address) => {
    if (!address) return '';
    // Handle Discord ID format (discord:123456)
    if (address.startsWith('discord:')) {
      return `Discord#${address.slice(-4)}`;
    }
    return `${address.slice(0, 4)}...${address.slice(-3)}`;
  }, []);

  const formatPnl = useCallback((value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    const prefix = num > 0 ? '+' : '';
    if (Math.abs(num) >= 1000) return prefix + (num / 1000).toFixed(1) + 'K';
    return prefix + num.toFixed(num >= 100 ? 0 : 2);
  }, []);

  const formatScore = useCallback((value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    if (Math.abs(num) >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toFixed(num >= 100 ? 0 : 2);
  }, []);

  const formatGameValue = useCallback((value, isPnl) => {
    const num = parseFloat(value);
    if (isNaN(num) || num === 0) return '-';
    if (isPnl) {
      const prefix = num > 0 ? '+' : '';
      if (Math.abs(num) >= 1000) return prefix + (num / 1000).toFixed(1) + 'K';
      return prefix + num.toFixed(Math.abs(num) >= 100 ? 0 : 1);
    }
    if (Math.abs(num) >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toFixed(num >= 100 ? 0 : 1);
  }, []);

  const getPlayerDisplay = useCallback((player) => {
    let name;
    if (player.discord?.globalName) {
      name = player.discord.globalName;
    } else if (player.discord?.username) {
      name = player.discord.username;
    } else {
      // Fallback to first wallet if available (for discord: prefix without discord info)
      return shortenAddress(player.wallets?.[0] || player.player);
    }
    // Truncate to 10 characters if too long
    return name.length > 10 ? name.slice(0, 10) + '...' : name;
  }, [shortenAddress]);

  // Get initials for default avatar - always use wallet
  const getAvatarInitials = useCallback((player) => {
    const wallet = player.wallets?.[0];
    if (wallet) return wallet.slice(2, 4).toUpperCase();
    if (player.player?.startsWith('0x')) return player.player.slice(2, 4).toUpperCase();
    return '??';
  }, []);

  const getGameStat = useCallback((player, gameId, isPnl) => {
    const gameStats = player.stats?.breakdown?.[gameId];
    if (!gameStats) return null;
    return isPnl ? gameStats.pnl : gameStats.volume;
  }, []);

  const handleRowClick = useCallback((e, player) => {
    if (!isMobile || !isAllGames) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Position tooltip below or above the row depending on space
    let top = rect.bottom + 8;
    if (top + 300 > viewportHeight) {
      top = rect.top - 8 - 300;
      if (top < 0) top = 16;
    }

    setTooltipPosition({ top, left: rect.left });
    setTooltipPlayer(player);
  }, [isMobile, isAllGames]);

  const closeTooltip = useCallback(() => {
    setTooltipPlayer(null);
  }, []);

  // Calculate rank changes between old and new data
  const calculateRankChanges = useCallback((newData, cacheKey) => {
    const prevRanks = prevRanksCache[cacheKey][game] || {};
    const changes = {};

    // Skip on first fetch
    if (Object.keys(prevRanks).length === 0) {
      // Store current ranks for next comparison
      const currentRanks = {};
      newData.forEach(player => {
        currentRanks[player.player] = player.rank;
      });
      prevRanksCache[cacheKey][game] = currentRanks;
      return changes;
    }

    newData.forEach(player => {
      const prevRank = prevRanks[player.player];

      if (prevRank === undefined) {
        // New entry to leaderboard
        changes[player.player] = 'new';
      } else if (player.rank < prevRank) {
        // Rank improved (lower number = better)
        changes[player.player] = 'up';
      } else if (player.rank > prevRank) {
        // Rank dropped
        changes[player.player] = 'down';
      }
    });

    // Update prev ranks cache
    const currentRanks = {};
    newData.forEach(player => {
      currentRanks[player.player] = player.rank;
    });
    prevRanksCache[cacheKey][game] = currentRanks;

    return changes;
  }, [game]);

  const fetchAllData = useCallback(async () => {
    try {
      const [pnlRes, volumeRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/tournament/leaderboard`, {
          params: { game, sortBy: 'pnl', limit: 50 }
        }),
        axios.get(`${API_BASE_URL}/api/tournament/leaderboard`, {
          params: { game, sortBy: 'volume', limit: 50 }
        })
      ]);

      if (!mountedRef.current) return;

      let allChanges = {};

      if (pnlRes.data.success) {
        const data = pnlRes.data.leaderboard || [];

        // Cache holder info from API response (using LRU cache)
        data.forEach(player => {
          if (player.isHolder && player.multiplier) {
            holderCache.set(player.player, {
              isHolder: true,
              multiplier: player.multiplier,
              activeCollection: player.activeCollection,
              collectionImage: player.collectionImage
            });
          }
        });

        // Calculate changes only if not first fetch
        if (!isFirstFetch.current) {
          const pnlChanges = calculateRankChanges(data, 'pnl');
          if (sortByRef.current === 'pnl') {
            allChanges = { ...allChanges, ...pnlChanges };
          }
        } else {
          // Initialize prev ranks on first fetch
          calculateRankChanges(data, 'pnl');
        }

        dataCache.pnl[game] = data;
        setPnlData(data);
      }

      if (volumeRes.data.success) {
        const data = volumeRes.data.leaderboard || [];

        // Cache holder info from API response (using LRU cache)
        data.forEach(player => {
          if (player.isHolder && player.multiplier) {
            holderCache.set(player.player, {
              isHolder: true,
              multiplier: player.multiplier,
              activeCollection: player.activeCollection,
              collectionImage: player.collectionImage
            });
          }
        });

        if (!isFirstFetch.current) {
          const volumeChanges = calculateRankChanges(data, 'volume');
          if (sortByRef.current === 'point') {
            allChanges = { ...allChanges, ...volumeChanges };
          }
        } else {
          calculateRankChanges(data, 'volume');
        }

        dataCache.volume[game] = data;
        setVolumeData(data);
      }

      // Apply changes for animations
      if (Object.keys(allChanges).length > 0) {
        setRankChanges(allChanges);

        // Clear changes after animation completes
        setTimeout(() => {
          if (mountedRef.current) {
            setRankChanges({});
          }
        }, 2500);
      }

      isFirstFetch.current = false;
      setInitialLoading(false);
    } catch (error) {
      console.error(`Failed to fetch ${game} leaderboard:`, error);
      setInitialLoading(false);
    }
  }, [game, calculateRankChanges]);

  // Keep fetchAllData ref in sync
  useEffect(() => {
    fetchAllDataRef.current = fetchAllData;
  }, [fetchAllData]);

  const handleTournamentUpdate = useCallback((data) => {
    if (!mountedRef.current) return;

    const isRelevant = game === 'total' || data.game === game;
    if (!isRelevant) return;

    if (data.isSync) return;

    // Use ref to avoid dependency on fetchAllData
    fetchAllDataRef.current?.();
  }, [game]);

  useEffect(() => {
    mountedRef.current = true;
    isFirstFetch.current = true;
    
    // MEMORY OPTIMIZATION: Start rank cache cleanup
    startRankCacheCleanup();

    // Check cache first
    if (dataCache.pnl[game] && dataCache.volume[game]) {
      setPnlData(dataCache.pnl[game]);
      setVolumeData(dataCache.volume[game]);
      setInitialLoading(false);
    } else {
      // Only fetch if not cached
      fetchAllData();
    }

    return () => {
      mountedRef.current = false;
      // MEMORY OPTIMIZATION: Clear this game's data cache on unmount
      delete dataCache.pnl[game];
      delete dataCache.volume[game];
      delete prevRanksCache.pnl[game];
      delete prevRanksCache.volume[game];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  useEffect(() => {
    const ws = getSocket();
    const subscriberId = `${game}-${Math.random()}`;
    socketSubscribers.add(subscriberId);

    ws.on('tournament:update', handleTournamentUpdate);

    return () => {
      socketSubscribers.delete(subscriberId);
      ws.off('tournament:update', handleTournamentUpdate);

      if (socketSubscribers.size === 0 && socket) {
        socket.disconnect();
        socket = null;
      }
    };
  }, [game, handleTournamentUpdate]);

  const renderAllGamesRow = (player) => {
    const isPnl = sortBy === 'pnl';
    const changeType = rankChanges[player.player];
    const offset = positionOffsets[player.player] || 0;

    // Get holder info - prefer API response, fallback to LRU cache
    const cachedHolder = holderCache.get(player.player);
    const isHolder = player.isHolder || cachedHolder?.isHolder || false;
    const multiplier = player.multiplier || cachedHolder?.multiplier || null;
    const activeCollection = player.activeCollection || cachedHolder?.activeCollection || null;
    const collectionImage = player.collectionImage || cachedHolder?.collectionImage || null;

    // Get collection logo - use local image for Monaliens, convert IPFS URLs
    const getCollectionLogo = () => {
      if (activeCollection?.toLowerCase() === 'monaliens' || collectionImage?.includes('/monaliens/')) {
        return '/images/monalienslogo.jpg';
      }
      if (collectionImage?.startsWith('ipfs://')) {
        return collectionImage.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }
      return collectionImage;
    };

    // Calculate display score
    let displayScore = player.score;
    if (isHolder && multiplier && !player.isHolder && player.score) {
      // WebSocket data: multiply score with cached multiplier
      displayScore = player.score * multiplier;
    }

    return (
      <AllGamesItem
        key={player.player}
        $changeType={changeType}
        $offset={offset}
        $isAnimating={isToggleAnimating}
        onClick={(e) => handleRowClick(e, player)}
      >
        <Rank>#{player.rank}</Rank>
        <PlayerInfo>
          {player.discord?.avatarUrl ? (
            <Avatar src={player.discord.avatarUrl} alt="" />
          ) : (
            <DefaultAvatar>{getAvatarInitials(player)}</DefaultAvatar>
          )}
          <PlayerName
            href={`https://monadexplorer.com/address/${player.wallets?.[0] || player.player}`}
            target="_blank"
            rel="noopener noreferrer"
            title={player.wallets?.[0] || player.player}
          >
            {getPlayerDisplay(player)}
          </PlayerName>
        </PlayerInfo>
        {GAMES.map(gameId => {
          const value = getGameStat(player, gameId, isPnl);
          const hasValue = value !== null && value !== undefined && parseFloat(value) !== 0;
          return (
            <GameCell key={gameId} $value={value} $isPnl={isPnl}>
              {formatGameValue(value, isPnl)}
              {isPnl && hasValue && <GameMonIcon src={monadIcon} alt="" />}
            </GameCell>
          );
        })}
        {isPnl ? (
          <PnlContainer>
            <PnlValue $value={player.stats?.pnl}>{formatPnl(player.stats?.pnl)}</PnlValue>
            <MonadIcon src={monadIcon} alt="MON" />
          </PnlContainer>
        ) : (
          <PnlContainer>
            <PnlValue $value={displayScore} $isHolder={isHolder}>
              {formatScore(displayScore)}
            </PnlValue>
            {isHolder && multiplier && (
              <>
                <MultiplierBadge>{multiplier}x</MultiplierBadge>
                {getCollectionLogo() && (
                  <CollectionLogo src={getCollectionLogo()} alt={activeCollection || ''} title={activeCollection || ''} />
                )}
              </>
            )}
          </PnlContainer>
        )}
      </AllGamesItem>
    );
  };

  const renderRegularRow = (player) => {
    const changeType = rankChanges[player.player];
    const offset = positionOffsets[player.player] || 0;

    // Get holder info - prefer API response, fallback to LRU cache
    const cachedHolder = holderCache.get(player.player);
    const isHolder = player.isHolder || cachedHolder?.isHolder || false;
    const multiplier = player.multiplier || cachedHolder?.multiplier || null;
    const activeCollection = player.activeCollection || cachedHolder?.activeCollection || null;
    const collectionImage = player.collectionImage || cachedHolder?.collectionImage || null;

    // Get collection logo - use local image for Monaliens, convert IPFS URLs
    const getCollectionLogo = () => {
      if (activeCollection?.toLowerCase() === 'monaliens' || collectionImage?.includes('/monaliens/')) {
        return '/images/monalienslogo.jpg';
      }
      if (collectionImage?.startsWith('ipfs://')) {
        return collectionImage.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }
      return collectionImage;
    };

    // Calculate display score
    let displayScore = player.score;
    if (isHolder && multiplier && !player.isHolder && player.score) {
      // WebSocket data: multiply score with cached multiplier
      displayScore = player.score * multiplier;
    }

    return (
      <ListItem
        key={player.player}
        $changeType={changeType}
        $offset={offset}
        $isAnimating={isToggleAnimating}
      >
        <Rank>#{player.rank}</Rank>
        <PlayerInfo>
          {player.discord?.avatarUrl ? (
            <Avatar src={player.discord.avatarUrl} alt="" />
          ) : (
            <DefaultAvatar>{getAvatarInitials(player)}</DefaultAvatar>
          )}
          <PlayerName
            href={`https://monadexplorer.com/address/${player.wallets?.[0] || player.player}`}
            target="_blank"
            rel="noopener noreferrer"
            title={player.wallets?.[0] || player.player}
          >
            {getPlayerDisplay(player)}
          </PlayerName>
        </PlayerInfo>
        {sortBy === 'pnl' ? (
          <PnlContainer>
            <PnlValue $value={player.stats?.pnl}>{formatPnl(player.stats?.pnl)}</PnlValue>
            <MonadIcon src={monadIcon} alt="MON" />
          </PnlContainer>
        ) : (
          <PnlContainer>
            <PnlValue $value={displayScore} $isHolder={isHolder}>
              {formatScore(displayScore)}
            </PnlValue>
            {isHolder && multiplier && (
              <>
                <MultiplierBadge>{multiplier}x</MultiplierBadge>
                {getCollectionLogo() && (
                  <CollectionLogo src={getCollectionLogo()} alt={activeCollection || ''} title={activeCollection || ''} />
                )}
              </>
            )}
          </PnlContainer>
        )}
      </ListItem>
    );
  };

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{title}</PanelTitle>
        <ToggleContainer>
          <ToggleButton $active={sortBy === 'pnl'} onClick={() => setSortBy('pnl')}>
            PnL
          </ToggleButton>
          <ToggleButton $active={sortBy === 'point'} onClick={() => setSortBy('point')}>
            Point
          </ToggleButton>
        </ToggleContainer>
      </PanelHeader>

      {isAllGames ? (
        <AllGamesHeader>
          <span>#</span>
          <span>Player</span>
          {GAMES.map(gameId => (
            <GameHeaderCell key={gameId}>{GAME_LABELS[gameId]}</GameHeaderCell>
          ))}
          <span style={{ textAlign: 'right' }}>{sortBy === 'pnl' ? 'Total' : 'Total'}</span>
        </AllGamesHeader>
      ) : (
        <ListHeader>
          <span>#</span>
          <span>Player</span>
          <span style={{ textAlign: 'right' }}>{sortBy === 'pnl' ? 'PnL' : 'Pts'}</span>
        </ListHeader>
      )}

      <ListContainer>
        {initialLoading ? (
          isAllGames ? (
            Array.from({ length: 10 }).map((_, i) => (
              <AllGamesSkeletonRow key={i}>
                <SkeletonBox $width="16px" $height="10px" />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <SkeletonAvatar />
                  <SkeletonBox $width="60px" $height="10px" />
                </div>
                {GAMES.map(gameId => (
                  <SkeletonBox key={gameId} $width="24px" $height="10px" style={{ margin: '0 auto' }} />
                ))}
                <SkeletonBox $width="36px" $height="10px" style={{ marginLeft: 'auto' }} />
              </AllGamesSkeletonRow>
            ))
          ) : (
            Array.from({ length: 10 }).map((_, i) => (
              <SkeletonRow key={i}>
                <SkeletonBox $width="16px" $height="10px" />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <SkeletonAvatar />
                  <SkeletonBox $width={`${50 + Math.random() * 40}px`} $height="10px" />
                </div>
                <SkeletonBox $width="36px" $height="10px" style={{ marginLeft: 'auto' }} />
              </SkeletonRow>
            ))
          )
        ) : leaderboard.length === 0 ? (
          <EmptyState>No data</EmptyState>
        ) : (
          leaderboard.map(player =>
            isAllGames ? renderAllGamesRow(player) : renderRegularRow(player)
          )
        )}
      </ListContainer>

      {/* Mobile breakdown tooltip */}
      {tooltipPlayer && ReactDOM.createPortal(
        <>
          <TooltipOverlay onClick={closeTooltip} />
          <TooltipPanel style={{ top: tooltipPosition.top }}>
            <TooltipHeader>
              {tooltipPlayer.discord?.avatarUrl ? (
                <Avatar src={tooltipPlayer.discord.avatarUrl} alt="" />
              ) : (
                <DefaultAvatar>{getAvatarInitials(tooltipPlayer)}</DefaultAvatar>
              )}
              <TooltipPlayerName>{getPlayerDisplay(tooltipPlayer)}</TooltipPlayerName>
            </TooltipHeader>
            <TooltipTitle>Game Breakdown ({sortBy === 'pnl' ? 'PnL' : 'Point'})</TooltipTitle>
            <TooltipGameList>
              {GAMES.map(gameId => {
                const value = getGameStat(tooltipPlayer, gameId, sortBy === 'pnl');
                const hasValue = value !== null && value !== undefined && parseFloat(value) !== 0;
                return (
                  <TooltipGameRow key={gameId}>
                    <TooltipGameName>{GAME_LABELS[gameId]}</TooltipGameName>
                    <TooltipGameValue $value={value} $isPnl={sortBy === 'pnl'}>
                      {formatGameValue(value, sortBy === 'pnl')}
                      {sortBy === 'pnl' && hasValue && <TooltipMonIcon src={monadIcon} alt="" />}
                    </TooltipGameValue>
                  </TooltipGameRow>
                );
              })}
            </TooltipGameList>
          </TooltipPanel>
        </>,
        document.body
      )}
    </Panel>
  );
});

LeaderboardPanel.displayName = 'LeaderboardPanel';

export default LeaderboardPanel;
