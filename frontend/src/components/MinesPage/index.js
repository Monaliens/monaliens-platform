import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { usePrivyOptimized, useBalanceFlash } from '../../context';
import styled, { keyframes } from 'styled-components';
import { useActiveGameBalance } from '../../hooks/useActiveGameBalance';
import { useMines } from './hooks/useMines';
import MinesInterface from './components/MinesInterface';
import MinesHistory from './components/MinesHistory';
import { GRID_5X5 } from './utils/constants';
import { initAudioManager } from './utils/audioManager';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const PageContainer = styled.div`
  width: 100%;
  min-height: 100vh;
  padding: 10px 1rem 3rem;
  animation: ${fadeIn} 0.6s ease-out;
  overflow-x: hidden;

  @media (min-width: 768px) {
    padding: 10px 2rem 4rem;
  }

  @media (min-width: 1200px) {
    padding: 10px 3rem 5rem;
  }
`;

const ContentWrapper = styled.div`
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const MinesPage = () => {
  const { address } = useAccount();
  const { isConnected } = usePrivyOptimized();
  const { triggerFlash } = useBalanceFlash();
  const { data: balanceData, refetch: refetchBalance } = useBalance({ address, enabled: !!address });

  // Game settings
  const [betAmount, setBetAmount] = useState('');
  const [gridSize, setGridSize] = useState(GRID_5X5);
  const [mineCount, setMineCount] = useState(3);
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);

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

  // Game hook
  const {
    startGame,
    revealTile,
    cashOut,
    resetState,
    fetchMultipliers,
    createSession,
    txState,
    currentGame,
    gameResult,
    revealedTiles,
    currentMultiplier,
    minePositions,
    multipliers,
    minBet,
    maxBet,
    entropyFee,
    isGameActive,
    isWaitingVRF,
    canReveal,
    finalSeed,
    hasSession,
    isInitializing
  } = useMines({ refetchBalance });

  // Fetch multipliers when grid/mine changes (skip if active game exists - it fetches its own)
  useEffect(() => {
    if (!currentGame) {
      fetchMultipliers(gridSize, mineCount);
    }
  }, [gridSize, mineCount, fetchMultipliers, currentGame]);

  // Refresh history and balance when game ends
  useEffect(() => {
    if (gameResult) {
      setHistoryRefreshTrigger(prev => prev + 1);
      refreshBalances();
      // Trigger balance flash animation
      triggerFlash(gameResult.won ? 'win' : 'lose');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameResult]);

  // Handle tile click - no canReveal check here, MinesInterface handles queue
  const handleTileClick = useCallback((index) => {
    revealTile(index);
  }, [revealTile]);

  // Handle start game
  const handleStartGame = useCallback(() => {
    startGame(gridSize, mineCount, betAmount);
  }, [startGame, gridSize, mineCount, betAmount]);

  // Close result modal
  const handleCloseResult = useCallback(() => {
    resetState();
  }, [resetState]);

  // Grid size from current game or settings
  const activeGridSize = currentGame?.grid_size || gridSize;
  const activeMineCount = currentGame?.mine_count || mineCount;

  return (
    <PageContainer>
      <ContentWrapper>
        <MinesInterface
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          gridSize={gridSize}
          setGridSize={setGridSize}
          mineCount={mineCount}
          setMineCount={setMineCount}
          activeGridSize={activeGridSize}
          activeMineCount={activeMineCount}
          currentGame={currentGame}
          onStartGame={handleStartGame}
          onCashOut={cashOut}
          onTileClick={handleTileClick}
          onCloseResult={handleCloseResult}
          txState={txState}
          isGameActive={isGameActive}
          isWaitingVRF={isWaitingVRF}
          canReveal={canReveal}
          currentMultiplier={currentMultiplier}
          revealedTiles={revealedTiles}
          minePositions={minePositions}
          multipliers={multipliers}
          minBet={minBet}
          maxBet={maxBet}
          entropyFee={entropyFee}
          monBalance={activeBalance}
          gameResult={gameResult}
          isConnected={isConnected}
          finalSeed={finalSeed}
          hasSession={hasSession}
          onCreateSession={createSession}
          isInitializing={isInitializing}
        />
      </ContentWrapper>
      <MinesHistory
        userAddress={address}
        isConnected={isConnected}
        refreshTrigger={historyRefreshTrigger}
      />
    </PageContainer>
  );
};

export default MinesPage;
