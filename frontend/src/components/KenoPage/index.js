import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { useBalanceFlash } from '../../context';
import styled, { keyframes } from 'styled-components';
import { useActiveGameBalance } from '../../hooks/useActiveGameBalance';
import { useKeno } from './hooks/useKeno';
import KenoInterface from './components/KenoInterface';
import KenoHistory from './components/KenoHistory';
import { DEFAULT_RISK, fetchMultipliers } from './utils/constants';
import { initAudioManager } from './utils/audioManager';
import { useMinigameStatsContractBalance } from '../../hooks/useMinigameStatsContractBalance';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const PageContainer = styled.div`
  width: 100%;
  min-height: 100vh;
  padding: 2rem 1rem 3rem;
  animation: ${fadeIn} 0.6s ease-out;
  overflow-x: hidden;

  @media (min-width: 768px) {
    padding: 2.5rem 2rem 4rem;
  }

  @media (min-width: 1200px) {
    padding: 3rem 3rem 5rem;
  }
`;

const ContentWrapper = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const KenoPage = () => {
  const { address, isConnected } = useAccount();
  const { triggerFlash } = useBalanceFlash();
  const { data: balanceData, refetch: refetchBalance } = useBalance({ address, enabled: !!address });

  // Game settings
  const [betAmount, setBetAmount] = useState('');
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);
  const [riskLevel, setRiskLevel] = useState(DEFAULT_RISK);
  const [multipliers, setMultipliers] = useState(null);
  const [multipliersLoading, setMultipliersLoading] = useState(true);

  const { activeBalance, refreshBalances } = useActiveGameBalance({
    balanceData,
    refetchBalance,
    isConnected
  });
  const { formattedMon: statsContractBalanceMon } = useMinigameStatsContractBalance();

  // Initialize audio manager
  useEffect(() => {
    const cleanup = initAudioManager();
    return cleanup;
  }, []);

  // Fetch multipliers from backend on mount
  useEffect(() => {
    const loadMultipliers = async () => {
      try {
        const data = await fetchMultipliers();
        setMultipliers(data);
      } catch (err) {
        console.error('Failed to load multipliers:', err);
      } finally {
        setMultipliersLoading(false);
      }
    };
    loadMultipliers();
  }, []);

  // Game hook
  const {
    toggleNumber,
    autoPick,
    clearSelection,
    startGame,
    resetState,
    selectedNumbers,
    drawnNumbers,
    currentDrawIndex,
    txState,
    gameResult,
    minBet,
    maxBet,
    entropyFee,
    getNumberState,
    getDrawOrder
  } = useKeno({ refetchBalance });

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

  // Handle start game
  const handleStartGame = useCallback(() => {
    startGame(betAmount, riskLevel);
  }, [startGame, betAmount, riskLevel]);

  // Close result modal
  const handleCloseResult = useCallback(() => {
    resetState();
  }, [resetState]);

  return (
    <PageContainer>
      <ContentWrapper>
        <KenoInterface
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          selectedNumbers={selectedNumbers}
          drawnNumbers={drawnNumbers}
          currentDrawIndex={currentDrawIndex}
          onNumberClick={toggleNumber}
          onAutoPick={autoPick}
          onClearSelection={clearSelection}
          onStartGame={handleStartGame}
          onCloseResult={handleCloseResult}
          getNumberState={getNumberState}
          getDrawOrder={getDrawOrder}
          txState={txState}
          gameResult={gameResult}
          minBet={minBet}
          maxBet={maxBet}
          entropyFee={entropyFee}
          monBalance={activeBalance}
          contractBalance={statsContractBalanceMon ?? '0'}
          riskLevel={riskLevel}
          setRiskLevel={setRiskLevel}
          isConnected={isConnected}
          multipliers={multipliers}
          multipliersLoading={multipliersLoading}
        />
      </ContentWrapper>

      <KenoHistory
        userAddress={address}
        isConnected={isConnected}
        refreshTrigger={historyRefreshTrigger}
      />
    </PageContainer>
  );
};

export default KenoPage;
