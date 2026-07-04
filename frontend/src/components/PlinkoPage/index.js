import React from 'react';
import styled, { keyframes } from 'styled-components';
import { useAccount, useBalance } from 'wagmi';
import { usePrivyOptimized } from '../../context';
import { useActiveGameBalance } from '../../hooks/useActiveGameBalance';
import { usePlinko } from './hooks/usePlinko';
import PlinkoInterface from './components/PlinkoInterface';
import PlinkoHistory from './components/PlinkoHistory';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const PlinkoPageContainer = styled.div`
  width: 100%;
  min-height: 100vh;
  padding: 60px 0 3rem;
  animation: ${fadeIn} 0.6s ease-out;
  overflow-x: hidden;

  @media (max-width: 899px) {
    width: calc(100% + 20px);
    margin: 0 -10px;
    padding-top: 0;
    overflow-x: visible;
  }

  @media (min-width: 900px) {
    padding: 60px 2rem 4rem;
  }

  @media (min-width: 1200px) {
    padding: 60px 3rem 5rem;
  }
`;

const ContentWrapper = styled.div`
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;

  @media (max-width: 900px) {
    align-items: stretch;
    max-width: 100%;
  }
`;


const PlinkoPage = () => {
  const { address } = useAccount();
  const { isConnected } = usePrivyOptimized();
  const { data: balanceData, refetch: refetchBalance } = useBalance({ address, enabled: !!address });
  const { activeBalance, refreshBalances } = useActiveGameBalance({ balanceData, refetchBalance, isConnected });

  const {
    play,
    playMultiple,
    resetState,
    clearStuck,
    setSelectedRisk,
    setSelectedRows,
    onAnimationComplete,
    sendingCount,
    pendingCount,
    animatingCount,
    isAnimating,
    activeAnimations,
    recentResults,
    selectedRisk,
    selectedRows,
    minBet,
    maxBet,
    getMultipliersForConfig,
    getValidRowsForRisk,
    isUsingGameWallet
  } = usePlinko({ refetchBalance: refreshBalances });

  return (
    <PlinkoPageContainer>
      <ContentWrapper>
        <PlinkoInterface
          play={play}
          playMultiple={playMultiple}
          sendingCount={sendingCount}
          pendingCount={pendingCount}
          animatingCount={animatingCount}
          isAnimating={isAnimating}
          activeAnimations={activeAnimations}
          onAnimationComplete={onAnimationComplete}
          selectedRisk={selectedRisk}
          setSelectedRisk={setSelectedRisk}
          selectedRows={selectedRows}
          setSelectedRows={setSelectedRows}
          minBet={minBet}
          maxBet={maxBet}
          getMultipliersForConfig={getMultipliersForConfig}
          getValidRowsForRisk={getValidRowsForRisk}
          isUsingGameWallet={isUsingGameWallet}
          monBalance={activeBalance}
          resetState={resetState}
          clearStuck={clearStuck}
        />
      </ContentWrapper>

      <PlinkoHistory recentResults={recentResults} />

    </PlinkoPageContainer>
  );
};

export default PlinkoPage;
