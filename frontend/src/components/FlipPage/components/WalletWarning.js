import React from 'react';
import styled from 'styled-components';
import { usePrivyOptimized } from '../../../context';

const WarningContainer = styled.div`
  background: linear-gradient(135deg, var(--bg-card) 0%, var(--table-header-bg) 100%);
  border: 2px solid var(--border-light);
  border-radius: 16px;
  padding: 2rem;
  margin: 2rem auto;
  max-width: 500px;
  text-align: center;
  box-shadow: 0 4px 15px var(--shadow-color);

  p {
    margin-bottom: 1.5rem;
    color: var(--text-primary);
    font-weight: 600;
    font-size: 1.1rem;
  }
`;

const ConnectButton = styled.button`
  background: linear-gradient(135deg, #6930c3 0%, #8e44ad 100%);
  color: var(--text-light);
  padding: 12px 24px;
  border-radius: 50px;
  font-weight: 700;
  font-size: 1rem;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 15px rgba(105, 48, 195, 0.3);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(105, 48, 195, 0.4);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  @media (max-width: 768px) {
    padding: 10px 20px;
    font-size: 0.9rem;
  }
`;

/**
 * WalletWarning Component - Display wallet connection warning
 */
const WalletWarning = () => {
  const { login } = usePrivyOptimized();

  return (
    <WarningContainer>
      <p>Connect your wallet to start flipping coins!</p>
      <ConnectButton onClick={login}>
        Connect Wallet
      </ConnectButton>
    </WarningContainer>
  );
};

export default WalletWarning;

