import React, { useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import monadImage from '../../../assets/images/monad.png';
import EntropyFeeDisplay from '../../common/EntropyFeeDisplay';

// Animations
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
  20%, 40%, 60%, 80% { transform: translateX(8px); }
`;

// Container - HiLo gibi
const Container = styled.div`
  background: var(--bg-glass);
  border: 2px solid var(--border-light);
  border-radius: 20px;
  padding: 1rem 2rem 1.5rem;
  margin-top: 1rem;
  box-shadow: 0 8px 25px var(--shadow-color);
  animation: ${fadeIn} 0.6s ease-out;

  @media (max-width: 768px) {
    padding: 0.75rem 1rem 1.25rem;
    border-radius: 16px;
  }
`;

const InputGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const Label = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
  font-weight: 600;
  font-size: 0.95rem;
`;

const LabelIcon = styled.img`
  width: 20px;
  height: 20px;
  border-radius: 50%;
`;

const Input = styled.input`
  width: 100%;
  padding: 1rem;
  border: 2px solid var(--input-border);
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.3s ease;
  background: var(--input-bg);
  color: var(--text-primary);
  ${props => props.$shake && css`animation: ${shake} 0.5s ease;`}

  &:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px var(--border-light);
  }

  &::placeholder {
    color: var(--placeholder-color);
  }

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  &[type=number] {
    -moz-appearance: textfield;
  }
`;

const BalanceDisplay = styled.div`
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;

  span {
    color: var(--accent-primary);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
`;

const BalanceIcon = styled.img`
  width: 16px;
  height: 16px;
  border-radius: 50%;
`;

const ActionButton = styled.button`
  width: 100%;
  padding: 16px;
  background: transparent;
  border: 2px solid ${props => {
    if (props.disabled) return 'var(--text-tertiary)';
    if (props.$waiting) return '#ffa502';
    if (props.$success) return 'var(--accent-green)';
    return 'var(--accent-primary)';
  }};
  border-radius: 12px;
  color: ${props => {
    if (props.disabled) return 'var(--text-tertiary)';
    if (props.$waiting) return '#ffa502';
    if (props.$success) return 'var(--accent-green)';
    return 'var(--accent-primary)';
  }};
  font-weight: 700;
  font-size: 16px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &:hover:not(:disabled) {
    background: ${props => {
      if (props.$waiting) return 'rgba(255, 165, 2, 0.1)';
      if (props.$success) return 'rgba(16, 185, 129, 0.1)';
      return 'var(--border-light)';
    }};
    border-color: ${props => {
      if (props.$waiting) return '#ffa502';
      if (props.$success) return 'var(--accent-green)';
      return 'var(--accent-primary)';
    }};
    transform: translateY(-2px);
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }
`;

const StatusText = styled.div`
  text-align: center;
  margin-top: 1rem;
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.9rem;
`;

const GameActionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;

  @media (max-width: 768px) {
    gap: 0.5rem;
  }
`;

const GameActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.85rem 1.5rem;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid;
  background: transparent;

  ${props => props.$variant === 'success' && css`
    border-color: ${props.disabled ? 'rgba(16, 185, 129, 0.3)' : 'var(--accent-green)'};
    color: ${props.disabled ? 'rgba(16, 185, 129, 0.5)' : 'var(--accent-green)'};

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, var(--accent-green) 0%, #059669 100%);
      border-color: var(--accent-green);
      color: var(--text-light);
      transform: translateY(-2px);
    }
  `}

  ${props => props.$variant === 'danger' && css`
    border-color: ${props.disabled ? 'rgba(239, 68, 68, 0.3)' : 'var(--accent-red)'};
    color: ${props.disabled ? 'rgba(239, 68, 68, 0.5)' : 'var(--accent-red)'};

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, var(--accent-red) 0%, #dc2626 100%);
      border-color: var(--accent-red);
      color: var(--text-light);
      transform: translateY(-2px);
    }
  `}

  ${props => props.$variant === 'warning' && css`
    border-color: ${props.disabled ? 'rgba(245, 158, 11, 0.3)' : 'var(--accent-orange)'};
    color: ${props.disabled ? 'rgba(245, 158, 11, 0.5)' : 'var(--accent-orange)'};

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, var(--accent-orange) 0%, #d97706 100%);
      border-color: var(--accent-orange);
      color: var(--text-light);
      transform: translateY(-2px);
    }
  `}

  ${props => props.$variant === 'primary' && css`
    border-color: ${props.disabled ? 'var(--border-light)' : 'var(--accent-primary)'};
    color: ${props.disabled ? 'var(--text-tertiary)' : 'var(--accent-primary)'};

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, var(--accent-primary) 0%, #8e44ad 100%);
      border-color: var(--accent-primary);
      color: var(--text-light);
      transform: translateY(-2px);
    }
  `}

  ${props => props.$variant === 'secondary' && css`
    border-color: ${props.disabled ? 'rgba(107, 114, 128, 0.3)' : 'rgba(107, 114, 128, 0.5)'};
    color: ${props.disabled ? 'rgba(107, 114, 128, 0.5)' : 'var(--text-secondary)'};

    &:hover:not(:disabled) {
      background: rgba(107, 114, 128, 0.1);
      border-color: var(--text-secondary);
      color: var(--text-primary);
    }
  `}

  &:disabled {
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    padding: 0.75rem 1rem;
    font-size: 0.85rem;
  }
`;

const FullWidthButton = styled(GameActionButton)`
  grid-column: 1 / -1;
`;

const InsurancePrompt = styled.div`
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%);
  border: 2px solid rgba(245, 158, 11, 0.3);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
  text-align: center;
`;

const InsuranceTitle = styled.div`
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent-orange);
  margin-bottom: 0.5rem;
`;

const InsuranceText = styled.div`
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
`;

const InsuranceButtons = styled.div`
  display: flex;
  gap: 0.75rem;
  justify-content: center;
`;

const CurrentBetInfo = styled.div`
  text-align: center;
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent-primary);
  margin-top: 0.75rem;
`;

const BlackjackControls = ({
  gamePhase,
  txState,
  currentBet,
  minBet,
  maxBet,
  entropyFee,
  monBalance,
  isConnected,
  canHit,
  canStand,
  canDoubleDown,
  canSplit,
  canSurrender,
  showInsurancePrompt,
  onStartGame,
  onPlaceBet,
  onHit,
  onStand,
  onDoubleDown,
  onSplit,
  onSurrender,
  onTakeInsurance,
  onDeclineInsurance,
  onNewGame
}) => {
  const [betAmount, setBetAmount] = useState('');
  const [inputShake, setInputShake] = useState(false);

  const handlePlaceBet = () => {
    if (!betAmount || parseFloat(betAmount) <= 0) return;
    onPlaceBet(betAmount);
  };

  const handleBetAmountChange = (value) => {
    if (value.includes(',')) return;

    const numValue = parseFloat(value);
    if (value === '' || value === '.') {
      setBetAmount(value);
      return;
    }

    if (isNaN(numValue) || numValue < 0) return;

    const maxBetNum = parseFloat(maxBet || '2500');
    if (numValue > maxBetNum) {
      setInputShake(true);
      setTimeout(() => setInputShake(false), 500);
      setBetAmount(maxBetNum.toString());
      return;
    }

    setBetAmount(value);
  };

  const isLoading = txState !== 'idle' && txState !== 'player_turn';

  // Not connected
  if (!isConnected) {
    return (
      <Container>
        <StatusText>Connect wallet to play Blackjack</StatusText>
      </Container>
    );
  }

  // Initializing - auto-starting game
  if (gamePhase === 'initializing') {
    return (
      <Container>
        <ActionButton disabled $waiting>
          Loading...
        </ActionButton>
      </Container>
    );
  }

  // Idle - fallback if auto-start failed
  if (gamePhase === 'idle') {
    return (
      <Container>
        <ActionButton
          onClick={onStartGame}
          disabled={txState === 'starting'}
          $waiting={txState === 'starting'}
        >
          {txState === 'starting' ? 'Starting Game...' : 'Start Game'}
        </ActionButton>
      </Container>
    );
  }

  // Betting phase
  if (gamePhase === 'betting') {
    return (
      <Container>
        <InputGroup>
          <Label>
            <LabelIcon src={monadImage} alt="MON" />
            Bet Amount (MON)
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'normal', marginLeft: '0.5rem' }}>
              (Min: {minBet || '25'} / Max: {maxBet || '2500'})
            </span>
          </Label>
          <Input
            type="number"
            placeholder={minBet || '25'}
            value={betAmount}
            onChange={(e) => handleBetAmountChange(e.target.value)}
            min="0"
            step="1"
            $shake={inputShake}
          />
          {monBalance && (
            <BalanceDisplay>
              Balance: <span><BalanceIcon src={monadImage} alt="MON" />{parseFloat(monBalance).toFixed(4)} MON</span>
            </BalanceDisplay>
          )}
        </InputGroup>

        <ActionButton
          onClick={handlePlaceBet}
          disabled={!betAmount || parseFloat(betAmount) < parseFloat(minBet) || txState === 'betting' || !entropyFee || parseFloat(entropyFee) === 0}
          $waiting={txState === 'betting'}
        >
          {txState === 'betting' ? 'Placing Bet...' : (!entropyFee || parseFloat(entropyFee) === 0 ? 'Loading...' : 'Place Bet')}
        </ActionButton>

        {entropyFee && (
          <EntropyFeeDisplay entropyFee={entropyFee} />
        )}
      </Container>
    );
  }

  // Waiting for VRF
  if (gamePhase === 'waiting_vrf') {
    return (
      <Container>
        <ActionButton disabled $waiting>
          Dealing Cards...
        </ActionButton>
      </Container>
    );
  }

  // Player's turn
  if (gamePhase === 'player_turn') {
    return (
      <Container>
        {showInsurancePrompt && (
          <InsurancePrompt>
            <InsuranceTitle>Insurance?</InsuranceTitle>
            <InsuranceText>
              Dealer shows Ace. Take insurance for half your bet?
            </InsuranceText>
            <InsuranceButtons>
              <GameActionButton $variant="warning" onClick={onTakeInsurance}>
                Yes
              </GameActionButton>
              <GameActionButton $variant="secondary" onClick={onDeclineInsurance}>
                No
              </GameActionButton>
            </InsuranceButtons>
          </InsurancePrompt>
        )}

        <GameActionsGrid>
          <GameActionButton
            $variant="success"
            onClick={onHit}
            disabled={!canHit || isLoading || showInsurancePrompt}
          >
            {txState === 'hitting' ? 'Hitting...' : 'Hit'}
          </GameActionButton>

          <GameActionButton
            $variant="danger"
            onClick={onStand}
            disabled={!canStand || isLoading || showInsurancePrompt}
          >
            {txState === 'standing' ? 'Standing...' : 'Stand'}
          </GameActionButton>

          <GameActionButton
            $variant="warning"
            onClick={onDoubleDown}
            disabled={!canDoubleDown || isLoading || showInsurancePrompt}
          >
            {txState === 'doubling' ? 'Doubling...' : 'Double'}
          </GameActionButton>

          <GameActionButton
            $variant="primary"
            onClick={onSplit}
            disabled={!canSplit || isLoading || showInsurancePrompt}
          >
            {txState === 'splitting' ? 'Splitting...' : 'Split'}
          </GameActionButton>

          <FullWidthButton
            $variant="secondary"
            onClick={onSurrender}
            disabled={!canSurrender || isLoading || showInsurancePrompt}
          >
            {txState === 'surrendering' ? 'Surrendering...' : 'Surrender'}
          </FullWidthButton>
        </GameActionsGrid>

        <CurrentBetInfo>
          Bet: {currentBet} MON
        </CurrentBetInfo>
      </Container>
    );
  }

  // Dealer's turn
  if (gamePhase === 'dealer_turn') {
    return (
      <Container>
        <ActionButton disabled $waiting>
          Dealer Playing...
        </ActionButton>
      </Container>
    );
  }

  // Game completed
  if (gamePhase === 'completed') {
    return (
      <Container>
        <ActionButton $success onClick={onNewGame}>
          Play Again
        </ActionButton>
      </Container>
    );
  }

  return null;
};

export default BlackjackControls;
