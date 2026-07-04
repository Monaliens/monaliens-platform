import React, { useState, useCallback, useEffect } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { usePrivyOptimized, useBalanceFlash } from '../../context';
import styled, { keyframes } from 'styled-components';
import toast from 'react-hot-toast';
import { useActiveGameBalance } from '../../hooks/useActiveGameBalance';
import { useCoinFlip } from './hooks/useCoinFlip';
import { useFlipResult } from './hooks/useFlipResult';
import { playSound, initAudioManager } from './utils/audioManager';
import CoinFlipInterface from './components/CoinFlipInterface';
import FlipHistory from './components/FlipHistory';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const FlipPageContainer = styled.div`
  width: 100%;
  min-height: 100vh;
  padding: 60px 1rem 3rem;
  animation: ${fadeIn} 0.6s ease-out;
  overflow-x: hidden; // Prevent horizontal scroll

  @media (min-width: 768px) {
    padding: 60px 2rem 4rem;
  }

  @media (min-width: 1200px) {
    padding: 60px 3rem 5rem;
  }
`;

const ContentWrapper = styled.div`
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const FlipPage = () => {
  const { address } = useAccount();
  const { isConnected } = usePrivyOptimized();
  const { triggerFlash } = useBalanceFlash();
  const { data: balanceData, refetch: refetchBalance } = useBalance({ address, enabled: !!address });
  const [tokenType] = useState('MON'); // LMON disabled - only MON supported
  // const [tokenType, setTokenType] = useState('MON'); // Uncomment to re-enable LMON
  const [betAmount, setBetAmount] = useState('');
  const [choice, setChoice] = useState(true); // true = heads, false = tails - default to Heads
  const [flipResult, setFlipResult] = useState(null);
  const [lastBetAmount, setLastBetAmount] = useState('');
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
    flipNative,
    flipLMON,
    approveLMON,
    txState,
    sequenceNumber,
    entropyFee,
    lmonBalance,
    needsApproval,
    resetFlipState // Add this function to reset state
  } = useCoinFlip({ refetchBalance });

  // Handle result from event listener
  const handleResult = useCallback((result) => {
    if (result.timeout) {
      toast.error('Timeout waiting for result. Please check manually.');
      setFlipResult(result);
      // Reset state to allow new flip
      resetFlipState();
      return;
    }

    setFlipResult(result);

    // Refresh history when result is received
    setHistoryRefreshTrigger(prev => prev + 1);

    // Reset state to allow new flip - IMPORTANT: Do this immediately
    resetFlipState();

    refreshBalances();

    // Trigger balance flash animation
    triggerFlash(result.winner ? 'win' : 'lose');

    // Play win/lose sound
    if (result.winner) {
      playSound('win');
    } else {
      playSound('lose');
    }

    // Small delay to ensure state is updated before showing toast
    setTimeout(() => {
      if (result.winner) {
        toast.success('🎉 You won! Payout: 1.95x');
      } else {
        toast.error('You lost. Better luck next time!');
      }
    }, 100);

    // Auto-clear result after 3 seconds so user can change choice
    setTimeout(() => {
      setFlipResult(null);
    }, 3000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetFlipState, txState, triggerFlash]);

  // Listen for results
  useFlipResult(address, handleResult, sequenceNumber);

  const handleFlip = useCallback(async () => {
    if (!choice && choice !== false) {
      toast.error('Please select Heads or Tails');
      return;
    }

    if (!betAmount || parseFloat(betAmount) <= 0) {
      toast.error('Please enter a valid bet amount');
      return;
    }

    // Reset previous result and state
    setFlipResult(null);
    setLastBetAmount(betAmount);
    if (resetFlipState) {
      resetFlipState();
    }

    // LMON disabled - only MON flips supported
    await flipNative(choice, betAmount);

    // Uncomment below to re-enable LMON support
    /* if (tokenType === 'MON') {
      await flipNative(choice, betAmount);
    } else {
      // For LMON, flipLMON will handle approval automatically if needed
      await flipLMON(choice, betAmount);
    } */
  }, [choice, betAmount, tokenType, flipNative, flipLMON, approveLMON, needsApproval, resetFlipState]);

  return (
    <FlipPageContainer>
      <ContentWrapper>
        <CoinFlipInterface
          tokenType={tokenType}
          // setTokenType={setTokenType} // LMON disabled
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          choice={choice}
          setChoice={setChoice}
          onFlip={handleFlip}
          txState={txState}
          entropyFee={entropyFee}
          lmonBalance={lmonBalance}
          monBalance={activeBalance}
          needsApproval={needsApproval}
          flipResult={flipResult}
          resultBetAmount={lastBetAmount}
          onResultClick={() => setFlipResult(null)}
          isConnected={isConnected}
        />
      </ContentWrapper>
      <FlipHistory userAddress={address} isConnected={isConnected} refreshTrigger={historyRefreshTrigger} />
    </FlipPageContainer>
  );
};

export default FlipPage;
