import React, { useState, useCallback, useEffect } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { usePrivyOptimized, useBalanceFlash } from '../../context';
import styled, { keyframes } from 'styled-components';
import toast from 'react-hot-toast';
import { useActiveGameBalance } from '../../hooks/useActiveGameBalance';
import { useDice } from './hooks/useDice';
import DiceInterface from './components/DiceInterface';
import DiceHistory from './components/DiceHistory';
import { initAudioManager } from './utils/audioManager';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const DicePageContainer = styled.div`
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

const DicePage = () => {
  const { address } = useAccount();
  const { isConnected } = usePrivyOptimized();
  const { triggerFlash } = useBalanceFlash();
  const { data: balanceData, refetch: refetchBalance } = useBalance({ address, enabled: !!address });

  const [betAmount, setBetAmount] = useState('');
  const [threshold, setThreshold] = useState(50);
  const [isOver, setIsOver] = useState(true);
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
    play,
    txState,
    gameResult,
    minBet,
    maxBet,
    entropyFee,
    minThreshold,
    maxThreshold,
    getMultiplier,
    getWinChance
  } = useDice({ refetchBalance });

  // Handle game result
  useEffect(() => {
    if (gameResult) {
      setHistoryRefreshTrigger(prev => prev + 1);
      refreshBalances();
      // Trigger balance flash animation
      triggerFlash(gameResult.won ? 'win' : 'lose');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameResult]);

  // Play handler
  const handlePlay = useCallback(async () => {
    if (!betAmount || parseFloat(betAmount) <= 0) {
      toast.error('Please enter a valid bet amount');
      return;
    }

    const minBetNum = parseFloat(minBet || '50');
    if (parseFloat(betAmount) < minBetNum) {
      toast.error(`Minimum bet is ${minBet} MON`);
      return;
    }

    await play(threshold, isOver, betAmount);
  }, [betAmount, threshold, isOver, minBet, play]);

  return (
    <DicePageContainer>
      <ContentWrapper>
        <DiceInterface
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          threshold={threshold}
          setThreshold={setThreshold}
          isOver={isOver}
          setIsOver={setIsOver}
          onPlay={handlePlay}
          txState={txState}
          minBet={minBet}
          maxBet={maxBet}
          minThreshold={minThreshold}
          maxThreshold={maxThreshold}
          monBalance={activeBalance}
          gameResult={gameResult}
          isConnected={isConnected}
          getMultiplier={getMultiplier}
          getWinChance={getWinChance}
          entropyFee={entropyFee}
        />
      </ContentWrapper>
      <DiceHistory
        userAddress={address}
        isConnected={isConnected}
        refreshTrigger={historyRefreshTrigger}
      />
    </DicePageContainer>
  );
};

export default DicePage;
