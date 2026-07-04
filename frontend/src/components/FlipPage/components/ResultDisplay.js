import React from 'react';
import styled, { keyframes } from 'styled-components';
import { formatEther, parseEther } from 'viem';
import { MONVISION_BASE_URL, WIN_MULTIPLIER } from '../utils/constants';

const slideUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(40px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const Container = styled.div`
  background: var(--bg-glass);
  border: 2px solid var(--border-color);
  border-radius: 20px;
  padding: 2.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 8px 25px var(--shadow-color);
  animation: ${slideUp} 0.6s ease-out;
  text-align: center;

  @media (max-width: 768px) {
    padding: 1.5rem;
    border-radius: 16px;
  }
`;

const ResultIcon = styled.div`
  font-size: 5rem;
  margin-bottom: 1rem;
  animation: ${slideUp} 0.6s ease-out;
`;

const ResultTitle = styled.h2`
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 1rem;
  color: ${props => props.$winner ? 'var(--accent-green)' : 'var(--accent-red)'};

  @media (max-width: 768px) {
    font-size: 2rem;
  }
`;

const ResultText = styled.p`
  font-size: 1.25rem;
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
  font-weight: 600;
`;

const DetailsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const DetailItem = styled.div`
  background: var(--table-header-bg);
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid var(--border-light);
`;

const DetailLabel = styled.div`
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const DetailValue = styled.div`
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
`;

const PayoutInfo = styled.div`
  background: rgba(22, 163, 74, 0.1);
  border: 2px solid rgba(22, 163, 74, 0.3);
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
`;

const PayoutTitle = styled.div`
  font-size: 0.9rem;
  color: var(--accent-green);
  font-weight: 600;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const PayoutAmount = styled.div`
  font-size: 2rem;
  font-weight: 800;
  color: var(--accent-green);
`;

const LinkButton = styled.a`
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, var(--accent-primary) 0%, #8e44ad 100%);
  color: var(--text-light);
  border-radius: 50px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px var(--shadow-color);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px var(--shadow-color);
  }
`;

const ResultDisplay = ({ result, betAmount, tokenType, txHash }) => {
  if (!result) return null;

  if (result.timeout) {
    return (
      <Container>
        <ResultIcon>⏰</ResultIcon>
        <ResultTitle>Timeout</ResultTitle>
        <ResultText>
          Waiting for result timed out. Please check manually.
        </ResultText>
        {txHash && (
          <LinkButton
            href={`${MONVISION_BASE_URL}${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View Transaction
          </LinkButton>
        )}
      </Container>
    );
  }

  const choiceText = result.choice ? 'Heads' : 'Tails';
  const resultText = result.result ? 'Heads' : 'Tails';
  const isWinner = result.winner;

  const calculatePayout = () => {
    if (!betAmount) return '0';
    try {
      const bet = parseEther(betAmount.toString());
      const payout = (bet * BigInt(WIN_MULTIPLIER)) / BigInt(100);
      return formatEther(payout);
    } catch {
      return '0';
    }
  };

  return (
    <Container>
      <ResultIcon>
        {isWinner ? '🎉' : ''}
      </ResultIcon>
      <ResultTitle $winner={isWinner}>
        {isWinner ? 'You Won!' : 'You Lost'}
      </ResultTitle>
      <ResultText>
        Result: <strong>{resultText}</strong> • Your Choice: <strong>{choiceText}</strong>
      </ResultText>

      <DetailsGrid>
        <DetailItem>
          <DetailLabel>Your Choice</DetailLabel>
          <DetailValue>{choiceText}</DetailValue>
        </DetailItem>
        <DetailItem>
          <DetailLabel>Result</DetailLabel>
          <DetailValue>{resultText}</DetailValue>
        </DetailItem>
        <DetailItem>
          <DetailLabel>Bet Amount</DetailLabel>
          <DetailValue>{betAmount} {tokenType}</DetailValue>
        </DetailItem>
        <DetailItem>
          <DetailLabel>Sequence</DetailLabel>
          <DetailValue>#{result.sequenceNumber?.toString()}</DetailValue>
        </DetailItem>
      </DetailsGrid>

      {isWinner && (
        <PayoutInfo>
          <PayoutTitle>Payout (1.95x)</PayoutTitle>
          <PayoutAmount>{calculatePayout()} {tokenType}</PayoutAmount>
        </PayoutInfo>
      )}

      {result.transactionHash && (
        <LinkButton
          href={`${MONVISION_BASE_URL}${result.transactionHash}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View Result Transaction
        </LinkButton>
      )}
    </Container>
  );
};

export default ResultDisplay;

