import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { getLeaderboard } from '../utils/blackjackApi';
import monadIcon from '../../../assets/images/monad.png';

const shimmer = keyframes`
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
`;

const TooltipPanel = styled.div`
  position: absolute;
  top: 0px;
  left: calc(100% + 170px);
  background: var(--bg-card);
  border: 2px solid var(--border-light);
  border-radius: 12px;
  box-shadow: 0 8px 25px var(--shadow-color);
  width: 280px;
  max-height: ${props => props.$maxHeight ? `${props.$maxHeight}px` : '596px'};
  z-index: 1000;
  opacity: ${props => props.$show ? '1' : '0'};
  visibility: ${props => props.$show ? 'visible' : 'hidden'};
  transform: ${props => props.$show ? 'translateX(0)' : 'translateX(-10px)'};
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media (max-width: 768px) {
    width: 280px;
    max-height: ${props => props.$maxHeight ? `${Math.min(props.$maxHeight, 480)}px` : '480px'};
    left: auto;
    right: 0;
    top: calc(100% + 10px);
    transform: ${props => props.$show ? 'translateY(0)' : 'translateY(-10px)'};
  }
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--divider-color);
  flex-shrink: 0;
`;

const PanelTitle = styled.h3`
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  text-align: center;
`;

const FiltersContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--divider-color);
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
`;

const ToggleContainer = styled.div`
  display: inline-flex;
  width: fit-content;
  padding: 3px;
  background: var(--bg-glass);
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px var(--border-light);
  gap: 2px;
`;

const ToggleButton = styled.button`
  padding: 5px 10px;
  background: ${props => props.$active
    ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 60%, #c084fc 100%)'
    : 'transparent'
  };
  color: ${props => props.$active ? 'var(--text-light)' : 'var(--text-secondary)'};
  border: none;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;

  &:hover:not(:disabled) {
    color: ${props => props.$active ? 'white' : 'var(--accent-primary)'};
    background: ${props => props.$active
      ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 60%, #c084fc 100%)'
      : 'var(--table-header-bg)'
    };
  }
`;

const ListContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.25rem 0;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--border-light);
    border-radius: 2px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: var(--border-color);
  }
`;

const ListHeader = styled.div`
  display: grid;
  grid-template-columns: 32px 1fr 70px;
  padding: 0.5rem 0.75rem;
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--divider-color);
  position: sticky;
  top: 0;
  background: var(--bg-card);
  z-index: 1;
`;

const ListItem = styled.div`
  display: grid;
  grid-template-columns: 32px 1fr 70px;
  padding: 0.4rem 0.75rem;
  align-items: center;
  transition: background 0.2s ease;
  border-bottom: 1px solid var(--divider-color);

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--table-row-hover);
  }
`;

const Rank = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  color: ${props => {
    if (props.$rank === 1) return 'var(--accent-primary)';
    if (props.$rank === 2) return '#8e44ad';
    if (props.$rank === 3) return '#a855f7';
    return 'var(--text-primary)';
  }};
`;

const PlayerInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
`;

const Avatar = styled.img`
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--table-header-bg);
`;

const DefaultAvatar = styled.div`
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
  background: linear-gradient(135deg, #6930c3 0%, #8e44ad 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-light);
  font-size: 0.55rem;
  font-weight: 700;
`;

const PlayerLink = styled.a`
  font-size: 0.75rem;
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

const StatValue = styled.span`
  font-size: 0.7rem;
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

const PnlValue = styled.span`
  font-size: 0.7rem;
  font-weight: 700;
  text-align: right;
  color: ${props => props.$positive ? '#16a34a' : '#dc2626'};
`;

const MonadIcon = styled.img`
  width: 12px;
  height: 12px;
  border-radius: 50%;
`;

const SkeletonRow = styled.div`
  display: grid;
  grid-template-columns: 32px 1fr 70px;
  padding: 0.4rem 0.75rem;
  align-items: center;
  gap: 0.5rem;
`;

const SkeletonBox = styled.div`
  background: linear-gradient(
    90deg,
    var(--table-header-bg) 0%,
    var(--border-light) 50%,
    var(--table-header-bg) 100%
  );
  background-size: 200px 100%;
  animation: ${shimmer} 1.5s infinite linear;
  border-radius: ${props => props.$radius || '4px'};
  width: ${props => props.$width || '100%'};
  height: ${props => props.$height || '12px'};
`;

const SkeletonAvatar = styled(SkeletonBox)`
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
`;

const SkeletonPlayerInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--text-secondary);
  font-size: 0.8rem;
  text-align: center;
`;

const PERIODS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' }
];

const SORT_OPTIONS = [
  { value: 'points', label: 'Points' },
  { value: 'pnl', label: 'PnL' }
];

const LeaderboardTooltip = ({ isOpen, panelRef, maxHeight, refreshTrigger }) => {
  const [period, setPeriod] = useState('weekly');
  const [sortBy, setSortBy] = useState('points');
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const isFirstLoad = useRef(true);

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

    if (sortBy === 'points') {
      result.sort((a, b) => parseFloat(b.stats?.points || 0) - parseFloat(a.stats?.points || 0));
    } else {
      result.sort((a, b) => parseFloat(b.stats?.pnl || 0) - parseFloat(a.stats?.pnl || 0));
    }

    return result.map((p, i) => ({ ...p, rank: i + 1 }));
  };

  useEffect(() => {
    if (!isOpen) return;

    const fetchLeaderboard = async () => {
      if (isFirstLoad.current) {
        setLoading(true);
      }

      try {
        const data = await getLeaderboard(period, sortBy, 20);
        if (data && data.success) {
          const merged = mergeByDiscord(data.leaderboard || []);
          setLeaderboard(merged);
        }
      } catch (error) {
        // Keep existing data on error
      }

      setLoading(false);
      isFirstLoad.current = false;
    };

    fetchLeaderboard();
  }, [isOpen, period, sortBy, refreshTrigger]);

  // Show skeleton when period or sortBy changes
  useEffect(() => {
    if (leaderboard.length > 0) {
      setLoading(true);
      isFirstLoad.current = true;
    }
  }, [period, sortBy]);

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

  const shortenAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-3)}`;
  };

  const getExplorerUrl = (address) => {
    return `https://monadexplorer.com/address/${address}`;
  };

  const getPlayerDisplay = (player) => {
    if (player.discord?.username) {
      return player.discord.globalName || player.discord.username;
    }
    return shortenAddress(player.player);
  };

  return (
    <TooltipPanel ref={panelRef} $show={isOpen} $maxHeight={maxHeight}>
      <PanelHeader>
        <PanelTitle>Leaderboard</PanelTitle>
      </PanelHeader>

      <FiltersContainer>
        <ToggleContainer>
          {PERIODS.map(p => (
            <ToggleButton
              key={p.value}
              $active={period === p.value}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </ToggleButton>
          ))}
        </ToggleContainer>
        <ToggleContainer>
          {SORT_OPTIONS.map(s => (
            <ToggleButton
              key={s.value}
              $active={sortBy === s.value}
              onClick={() => setSortBy(s.value)}
            >
              {s.label}
            </ToggleButton>
          ))}
        </ToggleContainer>
      </FiltersContainer>

      <ListHeader>
        <span>#</span>
        <span>Player</span>
        <span style={{ textAlign: 'right' }}>{sortBy === 'points' ? 'Pts' : 'PnL'}</span>
      </ListHeader>

      <ListContainer>
        {loading ? (
          Array.from({ length: 8 }).map((_, index) => (
            <SkeletonRow key={index}>
              <SkeletonBox $width="16px" $height="12px" />
              <SkeletonPlayerInfo>
                <SkeletonAvatar />
                <SkeletonBox $width={`${60 + Math.random() * 40}px`} $height="10px" />
              </SkeletonPlayerInfo>
              <SkeletonBox $width="40px" $height="10px" style={{ marginLeft: 'auto' }} />
            </SkeletonRow>
          ))
        ) : leaderboard.length === 0 ? (
          <EmptyState>
            No data available.
          </EmptyState>
        ) : (
          leaderboard.map((player) => (
            <ListItem key={player.player}>
              <Rank $rank={player.rank}>{player.rank}</Rank>
              <PlayerInfo>
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
              </PlayerInfo>
              {sortBy === 'points' ? (
                <StatValue>{formatPoints(player.stats?.points)}</StatValue>
              ) : (
                <PnlContainer>
                  <PnlValue $positive={parseFloat(player.stats?.pnl) >= 0}>
                    {formatPnl(player.stats?.pnl)}
                  </PnlValue>
                  <MonadIcon src={monadIcon} alt="MON" />
                </PnlContainer>
              )}
            </ListItem>
          ))
        )}
      </ListContainer>
    </TooltipPanel>
  );
};

export default LeaderboardTooltip;
