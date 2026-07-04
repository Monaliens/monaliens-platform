import React, { useRef, useEffect, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import Card from './Card';
import { getHiLoStats } from '../utils/hiloApi';
import { getRandomSuit, GameState } from '../utils/constants';
import monadImage from '../../../assets/images/monad.png';
import LeaderboardTooltip from './LeaderboardTooltip';
import EntropyFeeDisplay from '../../common/EntropyFeeDisplay';
import { useMinigameStatsContractBalance } from '../../../hooks/useMinigameStatsContractBalance';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
  20%, 40%, 60%, 80% { transform: translateX(8px); }
`;

const popIn = keyframes`
  0% { transform: scale(0.5); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
`;


const Container = styled.div`
  background: var(--bg-glass);
  border: 2px solid var(--border-light);
  border-radius: 20px;
  padding: 1rem 3.5rem 2.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 8px 25px var(--shadow-color);
  animation: ${fadeIn} 0.6s ease-out;
  position: relative;

  @media (max-width: 768px) {
    padding: 0.75rem 1rem 1.5rem;
    border-radius: 16px;
  }
`;



const CardsContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 2rem;
  margin-bottom: 2rem;
  min-height: 200px;

  @media (max-width: 768px) {
    gap: 1rem;
  }
`;

const CardWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
`;

const CardLabel = styled.div`
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ArrowContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.5rem;
  color: var(--accent-primary);
`;

const ChoiceSelector = styled.div`
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 2rem;

  @media (max-width: 768px) {
    gap: 0.75rem;
  }
`;

const ChoiceButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem 2rem;
  border-radius: 12px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid;

  ${props => props.$isHigh ? css`
    background: ${props.$active ? 'linear-gradient(135deg, var(--accent-green) 0%, #059669 100%)' : 'transparent'};
    border-color: ${props.$active ? 'var(--accent-green)' : 'rgba(16, 185, 129, 0.3)'};
    color: ${props.$active ? 'var(--text-light)' : 'var(--accent-green)'};

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, var(--accent-green) 0%, #059669 100%);
      border-color: var(--accent-green);
      color: var(--text-light);
      transform: translateY(-2px);
    }
  ` : css`
    background: ${props.$active ? 'linear-gradient(135deg, var(--accent-red) 0%, #dc2626 100%)' : 'transparent'};
    border-color: ${props.$active ? 'var(--accent-red)' : 'rgba(239, 68, 68, 0.3)'};
    color: ${props.$active ? 'var(--text-light)' : 'var(--accent-red)'};

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, var(--accent-red) 0%, #dc2626 100%);
      border-color: var(--accent-red);
      color: var(--text-light);
      transform: translateY(-2px);
    }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    padding: 0.75rem 1.5rem;
    font-size: 0.9rem;
  }
`;

const InputGroup = styled.div`
  margin-bottom: 2rem;
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
  animation: ${props => props.$shake ? shake : 'none'} 0.5s ease;

  &:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px var(--shadow-color);
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
    if (props.$waiting) return 'var(--accent-orange)';
    if (props.$success) return 'var(--accent-green)';
    return 'var(--accent-primary)';
  }};
  border-radius: 12px;
  color: ${props => {
    if (props.disabled) return 'var(--text-tertiary)';
    if (props.$waiting) return 'var(--accent-orange)';
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
      if (props.$waiting) return 'linear-gradient(135deg, var(--accent-orange) 0%, #ff8c00 100%)';
      if (props.$success) return 'linear-gradient(135deg, var(--accent-green) 0%, #059669 100%)';
      return 'linear-gradient(135deg, var(--accent-primary) 0%, #8e44ad 100%)';
    }};
    color: var(--text-light);
    transform: scale(1.02);
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

const ResultMessage = styled.div`
  text-align: center;
  padding: 1rem 0;
  font-weight: 800;
  font-size: 2.5rem;
  animation: ${popIn} 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  margin-bottom: 1rem;

  ${props => props.$won ? `
    color: var(--accent-green);
    text-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  ` : `
    color: var(--accent-red);
    text-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  `}

  @media (max-width: 768px) {
    font-size: 2rem;
    padding: 0.75rem 0;
  }
`;

const InfoButton = styled.button`
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--table-header-bg);
  border: 2px solid var(--border-light);
  color: var(--accent-primary);
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  z-index: 10;

  &:hover {
    background: var(--border-light);
    border-color: var(--accent-primary);
    transform: scale(1.1);
  }
`;

const LeaderboardButton = styled.button`
  position: absolute;
  top: 0.75rem;
  right: 2.75rem;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${props => props.$active ? 'var(--border-light)' : 'var(--table-header-bg)'};
  border: 2px solid ${props => props.$active ? 'var(--accent-primary)' : 'var(--border-light)'};
  color: var(--accent-primary);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  z-index: 10;

  &:hover {
    background: var(--border-light);
    border-color: var(--accent-primary);
    transform: scale(1.1);
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

const Tooltip = styled.div`
  position: absolute;
  top: 0;
  left: calc(100% + 15px);
  background: var(--bg-card);
  border: 2px solid var(--border-light);
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 8px 25px var(--shadow-color);
  min-width: 250px;
  z-index: 1000;
  opacity: ${props => props.$show ? '1' : '0'};
  visibility: ${props => props.$show ? 'visible' : 'hidden'};
  transition: all 0.3s ease;

  @media (max-width: 768px) {
    min-width: 220px;
    left: 0;
    top: calc(100% + 10px);
  }
`;

const TooltipTitle = styled.h3`
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--text-primary);
  text-align: center;
`;

const TooltipStatItem = styled.div`
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-light);

  &:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
`;

const TooltipStatLabel = styled.div`
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
  font-weight: 600;
  text-transform: uppercase;
`;

const TooltipStatValue = styled.div`
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
`;

const HiLoInterface = ({
  betAmount,
  setBetAmount,
  predictHigh,
  setPredictHigh,
  onStartGame,
  onRevealCard,
  onPlay,
  txState,
  gameState,
  entropyFee,
  minBet,
  maxBet,
  monBalance,
  gameResult,
  firstCard,
  secondCard,
  blocksRemaining,
  isConnected = true,
  multipliers = { high: null, low: null }
}) => {
  const { formattedMon: statsContractBalanceMon } = useMinigameStatsContractBalance();
  const [showTooltip, setShowTooltip] = useState(false);
  const [stats, setStats] = useState(null);
  const [inputShake, setInputShake] = useState(false);
  const [firstCardSuit] = useState(() => getRandomSuit());
  const [secondCardSuit] = useState(() => getRandomSuit());
  const [showLeaderboard, setShowLeaderboard] = useState(() => window.innerWidth > 768);
  const [leaderboardWasOpen, setLeaderboardWasOpen] = useState(false);
  const [containerHeight, setContainerHeight] = useState(null);
  const tooltipRef = useRef(null);
  const buttonRef = useRef(null);
  const leaderboardRef = useRef(null);
  const leaderboardButtonRef = useRef(null);
  const containerRef = useRef(null);

  // MEMORY OPTIMIZATION: Stats polling with visibility API
  useEffect(() => {
    let isPageVisible = !document.hidden;
    
    const handleVisibilityChange = () => {
      isPageVisible = !document.hidden;
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    const fetchStats = async () => {
      if (!isPageVisible) return; // Skip when hidden
      try {
        const data = await getHiLoStats();
        if (data.success) {
          setStats(data.data);
        }
      } catch (err) {
        // Error fetching stats
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 15000); // Optimized: 15s instead of 10s
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showTooltip && tooltipRef.current && buttonRef.current &&
          !tooltipRef.current.contains(event.target) &&
          !buttonRef.current.contains(event.target)) {
        setShowTooltip(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTooltip]);

  // Hide leaderboard during game and result, reopen after
  const isPlaying = gameState === GameState.WaitingReveal || gameState === GameState.WaitingVRF;
  const shouldHideLeaderboard = isPlaying || gameResult;
  useEffect(() => {
    if (shouldHideLeaderboard && showLeaderboard) {
      setLeaderboardWasOpen(true);
      setShowLeaderboard(false);
    } else if (!shouldHideLeaderboard && leaderboardWasOpen) {
      setLeaderboardWasOpen(false);
      setShowLeaderboard(true);
    }
  }, [shouldHideLeaderboard]);

  // Track container height for leaderboard max-height
  useEffect(() => {
    if (containerRef.current) {
      const updateHeight = () => {
        if (containerRef.current) {
          setContainerHeight(containerRef.current.offsetHeight);
        }
      };
      updateHeight();
      const observer = new ResizeObserver(updateHeight);
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, []);

  const handleBetAmountChange = (value) => {
    if (value.includes(',')) return;

    const numValue = parseFloat(value);
    if (value === '' || value === '.') {
      setBetAmount(value);
      return;
    }

    if (isNaN(numValue) || numValue < 0) return;

    const maxBetNum = parseFloat(maxBet || '100');
    if (numValue > maxBetNum) {
      setInputShake(true);
      setTimeout(() => setInputShake(false), 500);
      setBetAmount(maxBetNum.toString());
      return;
    }

    setBetAmount(value);
  };

  const getButtonText = () => {
    if (!isConnected) return 'Connect Wallet to Play';

    // Step 1: Start Game
    if (gameState === GameState.None) {
      if (txState === 'starting') return 'Starting Game...';
      return 'Start Game';
    }

    // Step 2: Waiting for auto-reveal (backend handles this)
    if (gameState === GameState.WaitingReveal) {
      if (blocksRemaining > 0) return `Waiting ${blocksRemaining} blocks...`;
      return 'Revealing Card...';
    }

    // Step 3: Place Bet
    if (gameState === GameState.WaitingBet) {
      if (txState === 'betting') return 'Placing Bet...';
      if (predictHigh === null) return 'Select HIGH or LOW';
      if (!betAmount) return 'Enter Bet Amount';
      return 'Place Bet';
    }

    // Waiting for VRF
    if (gameState === GameState.WaitingVRF) {
      return 'Waiting for Result...';
    }

    return 'Play';
  };

  const isButtonDisabled = () => {
    if (!isConnected) return true;

    // Starting
    if (txState === 'starting' || txState === 'betting') return true;

    // Waiting for auto-reveal - button disabled, backend will reveal
    if (gameState === GameState.WaitingReveal) return true;

    // Waiting for VRF
    if (gameState === GameState.WaitingVRF) return true;

    // Need to select choice and amount for betting
    if (gameState === GameState.WaitingBet) {
      if (predictHigh === null) return true;
      if (!betAmount || parseFloat(betAmount) <= 0) return true;
    }

    return false;
  };

  const handleButtonClick = () => {
    if (gameState === GameState.None) {
      onStartGame();
    } else if (gameState === GameState.WaitingBet) {
      onPlay();
    }
    // Note: WaitingReveal state doesn't need a button - backend auto-reveals
  };

  const calculatePayout = () => {
    if (!gameResult || !gameResult.winner || !gameResult.payout) return null;
    // Use actual payout from contract (wei to MON)
    const payoutInMon = Number(gameResult.payout) / 1e18;
    return payoutInMon.toFixed(4);
  };

  // Get expected payout for display
  const getExpectedPayout = () => {
    if (!betAmount || parseFloat(betAmount) <= 0 || predictHigh === null) return null;
    const bet = parseFloat(betAmount);
    const mult = predictHigh ? multipliers.high : multipliers.low;
    if (!mult) return null;
    return (bet * parseFloat(mult)).toFixed(4);
  };

  // Get display card values
  const displayFirstCard = gameResult ? gameResult.firstCard : firstCard;
  const displaySecondCard = gameResult ? gameResult.secondCard : secondCard;

  const showBettingUI = gameState === GameState.WaitingBet && !gameResult;

  return (
    <Container ref={containerRef}>
      <LeaderboardButton
        ref={leaderboardButtonRef}
        $active={showLeaderboard}
        onClick={() => setShowLeaderboard(!showLeaderboard)}
        title="Leaderboard"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 11V3H8v6H2v12h20V11h-6zm-6-6h4v14h-4V5zm-6 6h4v8H4v-8zm16 8h-4v-6h4v6z"/>
        </svg>
      </LeaderboardButton>
      <InfoButton ref={buttonRef} onClick={() => setShowTooltip(!showTooltip)}>i</InfoButton>

      <LeaderboardTooltip
        isOpen={showLeaderboard}
        panelRef={leaderboardRef}
        maxHeight={containerHeight}
      />

      <Tooltip ref={tooltipRef} $show={showTooltip}>
        <TooltipTitle>Statistics</TooltipTitle>
        <TooltipStatItem>
          <TooltipStatLabel>Contract Balance</TooltipStatLabel>
          <TooltipStatValue>{statsContractBalanceMon ?? '0.00'} MON</TooltipStatValue>
        </TooltipStatItem>
        <TooltipStatItem>
          <TooltipStatLabel>Total Volume</TooltipStatLabel>
          <TooltipStatValue>{parseFloat(stats?.totalVolume?.ether || '0').toFixed(2)} MON</TooltipStatValue>
        </TooltipStatItem>
        <TooltipStatItem>
          <TooltipStatLabel>Total Games</TooltipStatLabel>
          <TooltipStatValue>{stats?.totalGames || 0}</TooltipStatValue>
        </TooltipStatItem>
        <TooltipStatItem style={{ marginTop: '0.5rem', paddingTop: '0.75rem' }}>
          <TooltipStatLabel>Rules</TooltipStatLabel>
          <TooltipStatValue style={{ fontSize: '0.85rem', fontWeight: '500', lineHeight: '1.5' }}>
            A card is revealed. Predict whether the next card will be higher or lower. The multiplier depends on how likely your prediction is to be correct. If the same card is drawn, you lose.
          </TooltipStatValue>
        </TooltipStatItem>
      </Tooltip>

      {/* Cards Display */}
      <CardsContainer>
        <CardWrapper>
          <CardLabel>First Card</CardLabel>
          <Card
            value={displayFirstCard || 7}
            suit={firstCardSuit}
            faceDown={!displayFirstCard}
            isFlipping={gameState === GameState.WaitingReveal && txState === 'revealing'}
          />
        </CardWrapper>

        <ArrowContainer>
          <span>→</span>
        </ArrowContainer>

        <CardWrapper>
          <CardLabel>Second Card</CardLabel>
          <Card
            value={displaySecondCard || 1}
            suit={secondCardSuit}
            faceDown={!displaySecondCard}
            isFlipping={gameState === GameState.WaitingVRF}
          />
        </CardWrapper>
      </CardsContainer>

      {/* Result Message */}
      {gameResult && !gameResult.timeout && (
        <>
          <ResultMessage $won={gameResult.winner}>
            {gameResult.winner ? 'YOU WON!' : 'YOU LOST'}
          </ResultMessage>
          <StatusText style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--accent-primary)', marginBottom: '1.5rem' }}>
            {gameResult.winner ? `+${calculatePayout()} MON` : `-${betAmount} MON`}
          </StatusText>
        </>
      )}

      {/* Choice and Bet UI - Only show in WaitingBet state */}
      {showBettingUI && (
        <>
          <ChoiceSelector>
            <ChoiceButton
              $isHigh={true}
              $active={predictHigh === true}
              onClick={() => setPredictHigh(true)}
            >
              ↑ HIGH ({multipliers.high ? `${multipliers.high}x` : '0x'})
            </ChoiceButton>
            <ChoiceButton
              $isHigh={false}
              $active={predictHigh === false}
              onClick={() => setPredictHigh(false)}
            >
              ↓ LOW ({multipliers.low ? `${multipliers.low}x` : '0x'})
            </ChoiceButton>
          </ChoiceSelector>

          <InputGroup>
            <Label>
              <LabelIcon src={monadImage} alt="MON" />
              Bet Amount (MON)
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'normal', marginLeft: '0.5rem' }}>
                (Min: {minBet || '50'} / Max: {maxBet || '2500'})
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--accent-red)', fontWeight: '600', marginLeft: '0.75rem' }}>
                *2.5% house edge
              </span>
            </Label>
            {getExpectedPayout() && (
              <div style={{ fontSize: '0.9rem', color: 'var(--accent-green)', fontWeight: '600', marginBottom: '0.5rem' }}>
                Potential Win: {getExpectedPayout()} MON
              </div>
            )}
            <Input
              type="number"
              placeholder={minBet || '50'}
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
        </>
      )}

      {/* Info about current bet during VRF wait */}
      {gameState === GameState.WaitingVRF && !gameResult && (
        <StatusText style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--accent-primary)', marginBottom: '1.5rem' }}>
          Betting {betAmount} MON on {predictHigh ? 'HIGH' : 'LOW'}
        </StatusText>
      )}

      <ActionButton
        onClick={handleButtonClick}
        disabled={isButtonDisabled()}
        $waiting={gameState === GameState.WaitingReveal && blocksRemaining > 0 || gameState === GameState.WaitingVRF}
        $success={gameState === GameState.WaitingReveal && blocksRemaining === 0}
      >
        {getButtonText()}
      </ActionButton>

      {entropyFee && gameState === GameState.WaitingBet && !gameResult && (
        <EntropyFeeDisplay entropyFee={entropyFee} />
      )}
    </Container>
  );
};

export default HiLoInterface;
