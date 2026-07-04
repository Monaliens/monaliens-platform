import React, { useState, useEffect, useRef } from 'react';
import { useAccount, useBalance } from 'wagmi';
import styled, { keyframes } from 'styled-components';
import { usePrivyOptimized, useBalanceFlash } from '../../context';
import { useActiveGameBalance } from '../../hooks/useActiveGameBalance';
import useBlackjack from './hooks/useBlackjack';
import BlackjackTable from './components/BlackjackTable';
import BlackjackControls from './components/BlackjackControls';
import BlackjackHistory from './components/BlackjackHistory';
import GameResult from './components/GameResult';
import LeaderboardTooltip from './components/LeaderboardTooltip';
import { getStats } from './utils/blackjackApi';
import { initAudioManager } from './utils/audioManager';
import { useMinigameStatsContractBalance } from '../../hooks/useMinigameStatsContractBalance';

// Animations
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

// Styled Components
const PageContainer = styled.div`
  width: 100%;
  min-height: 100vh;
  padding: 20px 1rem 3rem;
  animation: ${fadeIn} 0.6s ease-out;
  overflow-x: hidden;

  @media (min-width: 768px) {
    padding: 20px 2rem 4rem;
  }

  @media (min-width: 1200px) {
    padding: 20px 3rem 5rem;
  }
`;

const ContentWrapper = styled.div`
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  position: relative;
`;

const GameInfo = styled.div`
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  position: relative;

  @media (max-width: 768px) {
    gap: 12px;
  }
`;

const InfoBadge = styled.div`
  background: var(--border-light);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-primary);

  @media (max-width: 768px) {
    padding: 6px 12px;
    font-size: 12px;
  }
`;

const StatsButton = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--border-light);
  border: 2px solid var(--border-color);
  color: var(--accent-primary);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;

  &:hover {
    background: var(--border-color);
    border-color: var(--accent-primary);
    transform: scale(1.1);
  }
`;

const LeaderboardButton = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${props => props.$active ? 'var(--border-color)' : 'var(--border-light)'};
  border: 2px solid ${props => props.$active ? 'var(--accent-primary)' : 'var(--border-color)'};
  color: var(--accent-primary);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  position: relative;

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

const LeaderboardWrapper = styled.div`
  position: relative;
`;

const GameArea = styled.div`
  position: relative;
`;

const StatsModal = styled.div`
  position: absolute;
  top: 40px;
  right: 0;
  background: var(--bg-card);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 10px 40px var(--shadow-color);
  border: 2px solid var(--border-light);
  z-index: 101;
  min-width: 280px;

  @media (max-width: 768px) {
    padding: 16px;
    min-width: 250px;
  }
`;

const StatsTitle = styled.h3`
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  padding-bottom: 12px;
  border-bottom: 2px solid var(--border-light);
`;

const StatRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-light);

  &:last-child {
    border-bottom: none;
  }
`;

const StatLabel = styled.span`
  font-size: 13px;
  color: var(--text-secondary);
`;

const StatValue = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
`;

const StatsOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99;
`;

const SeedDisplay = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 16px;
  background: var(--table-header-bg);
  border-radius: 8px;
  font-size: 11px;
`;

const SeedLabel = styled.span`
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const SeedValue = styled.span`
  font-family: monospace;
  color: var(--accent-primary);
  font-weight: 500;
`;

const BlackjackPage = () => {
  const { address } = useAccount();
  const { isConnected } = usePrivyOptimized();
  const { triggerFlash } = useBalanceFlash();
  const { data: balanceData, refetch: refetchBalance } = useBalance({
    address,
    query: {
      enabled: !!address,
      staleTime: 10 * 1000, // 10 seconds
      refetchInterval: false // Disable polling - manual refetch only
    }
  });

  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);
  const [leaderboardRefreshTrigger, setLeaderboardRefreshTrigger] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState(null);
  const { formattedMon: statsContractBalanceMon } = useMinigameStatsContractBalance();
  const [showLeaderboard, setShowLeaderboard] = useState(() => window.innerWidth > 768);
  const [containerHeight, setContainerHeight] = useState(null);

  const containerRef = useRef(null);
  const leaderboardRef = useRef(null);

  const { activeBalance, refreshBalances } = useActiveGameBalance({
    balanceData,
    refetchBalance,
    isConnected
  });

  // Initialize audio manager
  useEffect(() => {
    const cleanup = initAudioManager();
    return cleanup;
  }, []);

  // Fetch stats on mount
  useEffect(() => {
    getStats().then(res => {
      if (res.success) {
        setStats(res.data);
      }
    });
  }, []);

  // Track container height for leaderboard max-height
  useEffect(() => {
    if (containerRef.current) {
      const updateHeight = () => {
        if (containerRef.current) {
          setContainerHeight(containerRef.current.offsetHeight);
        }
      };
      updateHeight();
      const observer = new ResizeObserver(updateHeight);
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, []);

  
  const {
    // State
    gameId,
    gamePhase,
    playerHands,
    activeHandIndex,
    dealerCards,
    currentBet,
    txState,
    gameResult,
    isDealing,
    dealingToHandIndex,
    vrfSeed,
    showInsurancePrompt,

    // Computed
    canHit,
    canStand,
    canDoubleDown,
    canSplit,
    canSurrender,

    // Contract data
    minBet,
    maxBet,
    entropyFee,

    // Actions
    startNewGame,
    placeBet,
    hit,
    stand,
    doubleDown,
    split,
    surrender,
    takeInsurance,
    declineInsurance
  } = useBlackjack({ refetchBalance });

  // Show result modal when game completes
  useEffect(() => {
    if (gameResult && gamePhase === 'completed') {
      setShowResult(true);
      setHistoryRefreshTrigger(prev => prev + 1);
      setLeaderboardRefreshTrigger(prev => prev + 1);
      refreshBalances();
      // Trigger balance flash animation - check if player won (payout > bet)
      const won = gameResult.totalPayout > gameResult.totalBet;
      triggerFlash(won ? 'win' : 'lose');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameResult, gamePhase]);

  const handlePlayAgain = async () => {
    setShowResult(false);
    // Don't just reset - actually start a new game
    await startNewGame();
  };

  return (
    <PageContainer>
      <ContentWrapper>
        {showStats && <StatsOverlay onClick={() => setShowStats(false)} />}

        <GameArea ref={containerRef}>
        <GameInfo>
          <InfoBadge>Blackjack pays 3:2</InfoBadge>
          <InfoBadge>Dealer hits soft 17</InfoBadge>
          <InfoBadge>Min: {minBet} MON</InfoBadge>
          <StatsButton onClick={() => setShowStats(!showStats)}>i</StatsButton>
          <LeaderboardWrapper ref={leaderboardRef}>
            <LeaderboardButton
              $active={showLeaderboard}
              onClick={() => setShowLeaderboard(!showLeaderboard)}
              title="Leaderboard"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 11V3H8v6H2v12h20V11h-6zm-6-6h4v14h-4V5zm-6 6h4v8H4v-8zm16 8h-4v-6h4v6z"/>
              </svg>
            </LeaderboardButton>
            <LeaderboardTooltip
              isOpen={showLeaderboard}
              maxHeight={containerHeight}
              refreshTrigger={leaderboardRefreshTrigger}
            />
          </LeaderboardWrapper>
          {showStats && (
            <StatsModal>
              <StatsTitle>Stats</StatsTitle>
              <StatRow>
                <StatLabel>Contract Balance</StatLabel>
                <StatValue>{statsContractBalanceMon ?? '0.00'} MON</StatValue>
              </StatRow>
              <StatRow>
                <StatLabel>Total Volume</StatLabel>
                <StatValue>{parseFloat(stats?.totalVolume?.ether || '0').toFixed(2)} MON</StatValue>
              </StatRow>
              <StatRow>
                <StatLabel>Total Games</StatLabel>
                <StatValue>{stats?.totalGames?.toLocaleString() || '0'}</StatValue>
              </StatRow>
            </StatsModal>
          )}
        </GameInfo>

        <BlackjackTable
          playerHands={playerHands}
          activeHandIndex={activeHandIndex}
          dealerCards={dealerCards}
          gamePhase={gamePhase}
          isDealing={isDealing}
          dealingToHandIndex={dealingToHandIndex}
          gameId={gameId}
        />

        {vrfSeed && gamePhase !== 'idle' && gamePhase !== 'completed' && (
          <SeedDisplay>
            <SeedLabel>VRF Seed:</SeedLabel>
            <SeedValue>{vrfSeed.slice(0, 10)}...{vrfSeed.slice(-8)}</SeedValue>
          </SeedDisplay>
        )}

        <BlackjackControls
          gamePhase={gamePhase}
          txState={txState}
          currentBet={currentBet}
          minBet={minBet}
          maxBet={maxBet}
          entropyFee={entropyFee}
          monBalance={activeBalance}
          isConnected={isConnected}
          canHit={canHit}
          canStand={canStand}
          canDoubleDown={canDoubleDown}
          canSplit={canSplit}
          canSurrender={canSurrender}
          showInsurancePrompt={showInsurancePrompt}
          onStartGame={startNewGame}
          onPlaceBet={placeBet}
          onHit={hit}
          onStand={stand}
          onDoubleDown={doubleDown}
          onSplit={split}
          onSurrender={surrender}
          onTakeInsurance={takeInsurance}
          onDeclineInsurance={declineInsurance}
          onNewGame={handlePlayAgain}
        />
        </GameArea>

        <BlackjackHistory
          userAddress={address}
          isConnected={isConnected}
          refreshTrigger={historyRefreshTrigger}
        />

        {showResult && gameResult && (
          <GameResult
            result={gameResult}
            onPlayAgain={handlePlayAgain}
          />
        )}
      </ContentWrapper>
    </PageContainer>
  );
};

export default BlackjackPage;
