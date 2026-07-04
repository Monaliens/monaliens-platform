import React, { useState, useCallback, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { useAccount } from 'wagmi';
import { RISK_LEVELS } from '../utils/constants';
import PlinkoBoard from './PlinkoBoard';
import monadImage from '../../../assets/images/monad.png';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
`;

const GameContainer = styled.div`
  display: flex;
  gap: 16px;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;

  @media (max-width: 900px) {
    flex-direction: column;
    align-items: stretch;
    gap: 0;
  }
`;

const ControlsPanel = styled.div`
  flex: 0 0 280px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 1.25rem;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 16px;
  box-shadow: 0 4px 20px var(--shadow-color);
  animation: ${fadeIn} 0.5s ease-out;
  height: fit-content;

  @media (max-width: 900px) {
    order: 2;
    flex: 0 0 auto;
    width: 100%;
    max-width: 100%;
    border-radius: 0;
    border-left: none;
    border-right: none;
    border-bottom: none;
    box-shadow: none;
  }
`;

const SectionLabel = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  color: var(--text-secondary);
  font-weight: 500;
  font-size: 0.8rem;
`;

const BalanceText = styled.span`
  color: var(--text-secondary);
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 4px;

  img {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const InputRow = styled.div`
  display: flex;
  gap: 6px;
  align-items: stretch;
`;

const BetInputWrapper = styled.div`
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
`;

const BetInput = styled.input`
  width: 100%;
  padding: 10px 40px 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  background: var(--input-bg);
  color: var(--text-primary);
  transition: all 0.2s ease;
  animation: ${props => props.$shake ? shake : 'none'} 0.4s ease;

  &:focus {
    outline: none;
    border-color: var(--accent-primary);
  }

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  &[type=number] {
    -moz-appearance: textfield;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const InputIcon = styled.img`
  position: absolute;
  right: 10px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  pointer-events: none;
`;

const ModifierButton = styled.button`
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--input-bg);
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    border-color: var(--accent-primary);
    color: var(--text-primary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const DropdownWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const DropdownTrigger = styled.button`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  background: var(--input-bg);
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.2s ease;
  text-align: left;

  &:focus { outline: none; border-color: var(--accent-primary); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }

  span.arrow {
    font-size: 0.7rem;
    color: var(--text-secondary);
    transition: transform 0.2s;
    &.open { transform: rotate(180deg); }
  }
`;

const DropdownMenu = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  z-index: 999;
  overflow: hidden;
`;

const DropdownOption = styled.button`
  width: 100%;
  padding: 10px 12px;
  background: ${p => p.$active ? 'var(--accent-primary)' : 'transparent'};
  color: ${p => p.$active ? '#fff' : 'var(--text-primary)'};
  border: none;
  font-size: 0.9rem;
  font-weight: ${p => p.$active ? 700 : 500};
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;

  &:hover { background: ${p => p.$active ? 'var(--accent-primary)' : 'var(--bg-hover, rgba(0,0,0,0.05))'}; }
`;

const SelectArrow = styled.div`
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--text-secondary);
  font-size: 0.7rem;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 8px;
`;

const PlayButton = styled.button`
  flex: 1;
  padding: 14px;
  background: ${props => {
    if (props.disabled) return 'var(--border-color)';
    if (props.$isBetting) return '#f59e0b';
    if (props.$hasPending) return '#3b82f6';
    return '#22c55e';
  }};
  border: none;
  border-radius: 8px;
  color: ${props => props.disabled ? 'var(--text-tertiary)' : '#fff'};
  font-weight: 700;
  font-size: 0.95rem;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &:hover:not(:disabled) {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
`;

const MultiBetButton = styled.button`
  padding: 14px 16px;
  background: ${props => props.disabled ? 'var(--border-color)' : '#8b5cf6'};
  border: none;
  border-radius: 8px;
  color: ${props => props.disabled ? 'var(--text-tertiary)' : '#fff'};
  font-weight: 700;
  font-size: 0.85rem;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;
  white-space: nowrap;

  &:hover:not(:disabled) {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
`;

const StatusBadge = styled.div`
  padding: 6px 10px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  color: #3b82f6;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: var(--text-secondary);
  padding: 4px 0;

  span:last-child {
    color: var(--text-primary);
    font-weight: 500;
  }
`;

const GameWalletBadge = styled.div`
  padding: 8px 10px;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #22c55e;
  text-align: center;
`;

const BoardPanel = styled.div`
  flex: 1;
  min-width: 0;
  animation: ${fadeIn} 0.5s ease-out 0.1s both;

  @media (max-width: 900px) {
    order: 1;
    width: 100%;
  }
`;

const PlinkoInterface = ({
  play,
  playMultiple,
  sendingCount,
  pendingCount,
  animatingCount,
  isAnimating,
  activeAnimations,
  onAnimationComplete,
  selectedRisk,
  setSelectedRisk,
  selectedRows,
  setSelectedRows,
  minBet,
  maxBet,
  getMultipliersForConfig,
  getValidRowsForRisk,
  isUsingGameWallet,
  monBalance,
  resetState,
  clearStuck
}) => {
  const { address, isConnected } = useAccount();
  const [betAmount, setBetAmount] = useState('0.1');
  const [inputShake, setInputShake] = useState(false);
  const [isMultiBetting, setIsMultiBetting] = useState(false);
  const [betFlash, setBetFlash] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // 'risk' | 'rows' | null
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const currentMultipliers = getMultipliersForConfig();
  const validRows = getValidRowsForRisk();

  const handleBetChange = (e) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setBetAmount(value);
    }
  };

  const halfBet = () => {
    const current = parseFloat(betAmount) || 0;
    setBetAmount((current / 2).toFixed(4));
  };

  const doubleBet = () => {
    const current = parseFloat(betAmount) || 0;
    const doubled = current * 2;
    const max = parseFloat(maxBet);
    setBetAmount(Math.min(doubled, max).toFixed(4));
  };

  const handlePlay = useCallback(() => {
    if (!isConnected) return;

    const amount = parseFloat(betAmount);
    const min = parseFloat(minBet);
    const max = parseFloat(maxBet);

    if (isNaN(amount) || amount < min || amount > max) {
      setInputShake(true);
      setTimeout(() => setInputShake(false), 400);
      return;
    }

    play(betAmount);
  }, [betAmount, minBet, maxBet, play, isConnected]);

  const handleMultiBet = useCallback(async () => {
    if (!isConnected || isMultiBetting) return;

    const amount = parseFloat(betAmount);
    const min = parseFloat(minBet);
    const max = parseFloat(maxBet);

    if (isNaN(amount) || amount < min || amount > max) {
      setInputShake(true);
      setTimeout(() => setInputShake(false), 400);
      return;
    }

    setIsMultiBetting(true);
    try {
      await playMultiple(betAmount, 10);
    } finally {
      setIsMultiBetting(false);
    }
  }, [betAmount, minBet, maxBet, playMultiple, isConnected, isMultiBetting]);

  // Pool-based computed values (must be before useEffect that depends on them)
  const totalActive = sendingCount + pendingCount + animatingCount;
  const isPoolFull = totalActive >= 10;
  const isDisabled = isPoolFull || !isConnected;
  const hasActivity = totalActive > 0;

  const getButtonText = () => {
    if (!isConnected) return 'Connect Wallet';
    if (isPoolFull) return 'Pool Full';
    if (sendingCount > 0 || betFlash) return 'Betting...';
    if (pendingCount > 0) return 'Waiting...';
    if (isUsingGameWallet) {
      return window.innerWidth <= 900 ? 'Bet (Tap)' : 'Bet (Space)';
    }
    return 'Bet';
  };

  // Space key to quick bet
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (!isConnected || !isUsingGameWallet) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isPoolFull) return;
        setBetFlash(true);
        setTimeout(() => setBetFlash(false), 200);
        handlePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlay, isConnected, isUsingGameWallet, isPoolFull]);

  const getRiskLabel = (value) => {
    if (value === RISK_LEVELS.LOW) return 'Low';
    if (value === RISK_LEVELS.MEDIUM) return 'Medium';
    return 'High';
  };

  return (
    <GameContainer>
      <ControlsPanel>
        {/* Bet Amount */}
        <InputGroup>
          <SectionLabel>
            Bet Amount
            {monBalance && (
              <BalanceText>
                <img src={monadImage} alt="MON" />
                {parseFloat(monBalance).toFixed(2)}
              </BalanceText>
            )}
          </SectionLabel>
          <InputRow>
            <BetInputWrapper>
              <BetInput
                type="text"
                value={betAmount}
                onChange={handleBetChange}
                disabled={isPoolFull}
                $shake={inputShake}
                placeholder="0.1"
              />
              <InputIcon src={monadImage} alt="MON" />
            </BetInputWrapper>
            <ModifierButton onClick={halfBet} disabled={isPoolFull}>
              ½
            </ModifierButton>
            <ModifierButton onClick={doubleBet} disabled={isPoolFull}>
              2×
            </ModifierButton>
          </InputRow>
        </InputGroup>

        {/* Risk & Rows dropdowns */}
        <div ref={dropdownRef}>
          <InputGroup>
            <SectionLabel>Risk</SectionLabel>
            <DropdownWrapper>
              <DropdownTrigger
                type="button"
                disabled={isPoolFull}
                onClick={() => setOpenDropdown(openDropdown === 'risk' ? null : 'risk')}
              >
                {getRiskLabel(selectedRisk)}
                <span className={`arrow${openDropdown === 'risk' ? ' open' : ''}`}>▼</span>
              </DropdownTrigger>
              {openDropdown === 'risk' && (
                <DropdownMenu>
                  {Object.entries(RISK_LEVELS).map(([name, value]) => (
                    <DropdownOption
                      key={name}
                      type="button"
                      $active={selectedRisk === value}
                      onClick={() => { setSelectedRisk(value); setOpenDropdown(null); }}
                    >
                      {getRiskLabel(value)}
                    </DropdownOption>
                  ))}
                </DropdownMenu>
              )}
            </DropdownWrapper>
          </InputGroup>

          <InputGroup>
            <SectionLabel>Rows</SectionLabel>
            <DropdownWrapper>
              <DropdownTrigger
                type="button"
                disabled={isPoolFull}
                onClick={() => setOpenDropdown(openDropdown === 'rows' ? null : 'rows')}
              >
                {selectedRows}
                <span className={`arrow${openDropdown === 'rows' ? ' open' : ''}`}>▼</span>
              </DropdownTrigger>
              {openDropdown === 'rows' && (
                <DropdownMenu>
                  {validRows.map((row) => (
                    <DropdownOption
                      key={row}
                      type="button"
                      $active={selectedRows === row}
                      onClick={() => { setSelectedRows(row); setOpenDropdown(null); }}
                    >
                      {row}
                    </DropdownOption>
                  ))}
                </DropdownMenu>
              )}
            </DropdownWrapper>
          </InputGroup>
        </div>

        {/* Play Buttons */}
        <ButtonRow>
          <PlayButton
            onClick={handlePlay}
            disabled={isDisabled}
            $isBetting={sendingCount > 0 || betFlash}
            $hasPending={hasActivity}
          >
            {getButtonText()}
          </PlayButton>
          <MultiBetButton
            onClick={handleMultiBet}
            disabled={isDisabled || isMultiBetting}
            title=""
          >
            {isMultiBetting ? '...' : '10×'}
          </MultiBetButton>
        </ButtonRow>

        {/* Status - Sending → Waiting → Dropping */}
        {hasActivity && (
          <StatusBadge>
            {sendingCount > 0 && `${sendingCount} sending`}
            {sendingCount > 0 && (pendingCount > 0 || animatingCount > 0) && ' • '}
            {pendingCount > 0 && `${pendingCount} waiting`}
            {pendingCount > 0 && animatingCount > 0 && ' • '}
            {animatingCount > 0 && `${animatingCount} dropping`}
          </StatusBadge>
        )}

        {/* Info */}
        <div>
          <InfoRow>
            <span>Min / Max Bet</span>
            <span>{minBet} / {maxBet} MON</span>
          </InfoRow>
        </div>

        {/* Game Wallet Indicator */}
        {isUsingGameWallet && (
          <GameWalletBadge>
            Signless Mode
          </GameWalletBadge>
        )}
      </ControlsPanel>

      {/* Board Panel */}
      <BoardPanel>
        <PlinkoBoard
          rows={selectedRows}
          multipliers={currentMultipliers}
          activeAnimations={activeAnimations}
          pendingCount={pendingCount}
          onAnimationComplete={onAnimationComplete}
          selectedRisk={selectedRisk}
        />
      </BoardPanel>
    </GameContainer>
  );
};

export default PlinkoInterface;
