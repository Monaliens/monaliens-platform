import React, { useState, useCallback, useEffect } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { usePrivyOptimized, useBalanceFlash } from '../../context';
import styled, { keyframes } from 'styled-components';
import toast from 'react-hot-toast';
import { useActiveGameBalance } from '../../hooks/useActiveGameBalance';
import { useHiLo } from './hooks/useHiLo';
import HiLoInterface from './components/HiLoInterface';
import HiLoHistory from './components/HiLoHistory';
import { GameState } from './utils/constants';
import { initAudioManager } from './utils/audioManager';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const HiLoPageContainer = styled.div`
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
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const HiLoPage = () => {
  const { address } = useAccount();
  const { isConnected } = usePrivyOptimized();
  const { triggerFlash } = useBalanceFlash();
  const { data: balanceData, refetch: refetchBalance } = useBalance({ address, enabled: !!address });
  const [betAmount, setBetAmount] = useState('');
  const [predictHigh, setPredictHigh] = useState(null);
  const [gameResult, setGameResult] = useState(null);
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

  const {
    // Actions
    startGame,
    revealFirstCard,
    play,
    // State
    txState,
    gameState,
    firstCard,
    secondCard,
    gameResult: hookGameResult,
    blocksRemaining,
    // Contract data
    entropyFee,
    minBet,
    maxBet,
    // Dynamic multipliers
    multipliers
  } = useHiLo({ refetchBalance });

  // Handle result from hook - single source of truth for game results
  useEffect(() => {
    if (hookGameResult && gameState === GameState.Completed) {
      setGameResult(hookGameResult);
      setHistoryRefreshTrigger(prev => prev + 1);
      refreshBalances();
      // Trigger balance flash animation
      triggerFlash(hookGameResult.winner ? 'win' : 'lose');
      // Auto-restart in useHiLo will handle starting new game after 3 seconds
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hookGameResult, gameState]);

  // Clear local state when new game starts
  useEffect(() => {
    if (gameState === GameState.WaitingReveal || gameState === GameState.None) {
      setGameResult(null);
      setPredictHigh(null);
      setBetAmount('');
    }
  }, [gameState]);

  // Step 1: Start a new game
  const handleStartGame = useCallback(async () => {
    setGameResult(null);
    setPredictHigh(null);
    setBetAmount('');
    await startGame();
  }, [startGame]);

  // Step 2: Reveal first card
  const handleRevealCard = useCallback(async () => {
    await revealFirstCard();
  }, [revealFirstCard]);

  // Step 3: Place bet
  const handlePlay = useCallback(async () => {
    if (predictHigh === null) {
      toast.error('Please select HIGH or LOW');
      return;
    }

    if (!betAmount || parseFloat(betAmount) <= 0) {
      toast.error('Please enter a valid bet amount');
      return;
    }

    const minBetNum = parseFloat(minBet || '50');
    if (parseFloat(betAmount) < minBetNum) {
      toast.error(`Minimum bet is ${minBet} MON`);
      return;
    }

    await play(predictHigh, betAmount);
  }, [predictHigh, betAmount, minBet, play]);

  return (
    <HiLoPageContainer>
      <ContentWrapper>
        <HiLoInterface
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          predictHigh={predictHigh}
          setPredictHigh={setPredictHigh}
          onStartGame={handleStartGame}
          onRevealCard={handleRevealCard}
          onPlay={handlePlay}
          txState={txState}
          gameState={gameState}
          entropyFee={entropyFee}
          minBet={minBet}
          maxBet={maxBet}
          monBalance={activeBalance}
          gameResult={gameResult}
          firstCard={firstCard}
          secondCard={secondCard}
          blocksRemaining={blocksRemaining}
          isConnected={isConnected}
          multipliers={multipliers}
        />
      </ContentWrapper>
      <HiLoHistory
        userAddress={address}
        isConnected={isConnected}
        refreshTrigger={historyRefreshTrigger}
      />
    </HiLoPageContainer>
  );
};

export default HiLoPage;
