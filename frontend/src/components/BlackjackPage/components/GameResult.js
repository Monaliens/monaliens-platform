import React from 'react';
import styled, { keyframes } from 'styled-components';

// Animations
const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const celebrate = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

// Styled Components
const ResultOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-bg-heavy);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
`;

const ResultCard = styled.div`
  background: var(--bg-card);
  border-radius: 24px;
  padding: 32px 48px;
  text-align: center;
  animation: ${slideIn} 0.5s ease-out;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 20px 60px var(--shadow-color);
  border: 2px solid var(--border-light);

  @media (max-width: 768px) {
    padding: 24px;
    border-radius: 20px;
  }
`;

const ResultIcon = styled.div`
  font-size: 64px;
  margin-bottom: 16px;
  animation: ${props => props.$won ? celebrate : 'none'} 1s ease-in-out infinite;

  @media (max-width: 768px) {
    font-size: 48px;
  }
`;

const ResultTitle = styled.h2`
  font-size: 28px;
  font-weight: 800;
  margin: 0 0 8px 0;
  color: ${props => {
    if (props.$won) return 'var(--accent-green)';
    if (props.$push) return 'var(--text-secondary)';
    return 'var(--accent-red)';
  }};
  background: ${props => props.$won ? 'linear-gradient(90deg, var(--accent-green), #10b981, var(--accent-green))' : 'none'};
  background-size: 200% auto;
  -webkit-background-clip: ${props => props.$won ? 'text' : 'none'};
  -webkit-text-fill-color: ${props => props.$won ? 'transparent' : 'inherit'};
  animation: ${props => props.$won ? shimmer : 'none'} 3s linear infinite;

  @media (max-width: 768px) {
    font-size: 24px;
  }
`;

const ResultSubtitle = styled.p`
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 24px 0;
`;

const PayoutRow = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-light);

  &:last-of-type {
    border-bottom: none;
  }
`;

const PayoutLabel = styled.span`
  font-size: 14px;
  color: var(--text-secondary);
`;

const PayoutValue = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.$highlight ? 'var(--accent-green)' : 'var(--text-primary)'};
`;

const TotalPayout = styled.div`
  background: ${props => {
    if (props.$won) return 'rgba(16, 185, 129, 0.1)';
    if (props.$push) return 'var(--table-header-bg)';
    return 'rgba(239, 68, 68, 0.1)';
  }};
  border-radius: 12px;
  padding: 16px;
  margin: 24px 0;
`;

const TotalLabel = styled.div`
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
`;

const TotalAmount = styled.div`
  font-size: 32px;
  font-weight: 800;
  color: ${props => {
    if (props.$won) return 'var(--accent-green)';
    if (props.$push) return 'var(--text-secondary)';
    return 'var(--accent-red)';
  }};

  @media (max-width: 768px) {
    font-size: 28px;
  }
`;

const PlayAgainButton = styled.button`
  width: 100%;
  padding: 16px 32px;
  font-size: 16px;
  font-weight: 700;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  background: linear-gradient(135deg, var(--accent-primary) 0%, #5e2db8 100%);
  color: var(--text-light);
  box-shadow: 0 4px 15px var(--shadow-color);
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 1px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px var(--border-color);
  }

  &:active {
    transform: scale(0.98);
  }
`;

const GameResult = ({ result, onPlayAgain }) => {
  if (!result) return null;

  const { totalBet, totalPayout, won, push, result: resultType } = result;
  const betAmount = parseFloat(totalBet || '0');
  const payoutAmount = parseFloat(totalPayout || '0');
  const profit = payoutAmount - betAmount;

  const getIcon = () => {
    return null;
  };

  const getTitle = () => {
    if (resultType === 'blackjack') return 'BLACKJACK';
    if (won) return 'YOU WIN';
    if (push) return 'DRAW';
    if (resultType === 'surrender') return 'SURRENDERED';
    return 'YOU LOSE';
  };

  const getSubtitle = () => {
    if (resultType === 'blackjack') return 'Natural 21 pays 3:2';
    if (won) return '';
    if (push) return 'Bet returned';
    if (resultType === 'surrender') return 'Half bet returned';
    return '';
  };

  return (
    <ResultOverlay onClick={onPlayAgain}>
      <ResultCard onClick={(e) => e.stopPropagation()}>
        {getIcon() && <ResultIcon $won={won}>{getIcon()}</ResultIcon>}
        <ResultTitle $won={won} $push={push}>{getTitle()}</ResultTitle>
        <ResultSubtitle>{getSubtitle()}</ResultSubtitle>

        <PayoutRow>
          <PayoutLabel>Bet Amount</PayoutLabel>
          <PayoutValue>{betAmount.toFixed(4)} MON</PayoutValue>
        </PayoutRow>
        <PayoutRow>
          <PayoutLabel>Payout</PayoutLabel>
          <PayoutValue $highlight={won}>{payoutAmount.toFixed(4)} MON</PayoutValue>
        </PayoutRow>

        <TotalPayout $won={won} $push={push}>
          <TotalLabel>{won ? 'Profit' : push ? 'Returned' : 'Lost'}</TotalLabel>
          <TotalAmount $won={won} $push={push}>
            {profit > 0 ? '+' : ''}{profit.toFixed(4)} MON
          </TotalAmount>
        </TotalPayout>

        <PlayAgainButton onClick={onPlayAgain}>
          Play Again
        </PlayAgainButton>
      </ResultCard>
    </ResultOverlay>
  );
};

export default GameResult;
