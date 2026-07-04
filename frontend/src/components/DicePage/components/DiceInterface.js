import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { getDiceStats } from '../utils/diceApi';
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

const Container = styled.div`
  background: var(--bg-card);
  border: 2px solid var(--border-color);
  border-radius: 20px;
  padding: 2rem 3rem 2.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 8px 25px var(--shadow-color);
  animation: ${fadeIn} 0.6s ease-out;
  position: relative;
  max-width: 800px;
  width: 100%;
  transition: background-color 0.3s ease, border-color 0.3s ease;

  @media (max-width: 768px) {
    padding: 1.5rem 1.5rem 2rem;
    border-radius: 16px;
  }
`;

const SliderContainer = styled.div`
  margin-bottom: 2rem;
  padding: 0 1rem;
`;

const SliderLabel = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
`;

const SliderWrapper = styled.div`
  position: relative;
  padding: 2.5rem 0 0.5rem;
`;

const Slider = styled.input`
  width: 100%;
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(to right,
    #ef4444 0%,
    #ef4444 ${props => props.$isOver ? props.value : props.value - 1}%,
    #10b981 ${props => props.$isOver ? props.value : props.value - 1}%,
    #10b981 100%
  );
  outline: none;
  -webkit-appearance: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 32px;
    height: 32px;
    background: var(--bg-secondary);
    border: 4px solid var(--accent-primary);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 4px 12px var(--shadow-color);
    transition: transform 0.2s;
  }

  &::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }

  &::-moz-range-thumb {
    width: 32px;
    height: 32px;
    background: var(--bg-secondary);
    border: 4px solid var(--accent-primary);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 4px 12px var(--shadow-color);
  }
`;

// Mini dice that appears on slider
const MiniDice = styled.div`
  position: absolute;
  top: -20px;
  left: ${props => props.$position}%;
  transform: translateX(-50%);
  width: 40px;
  height: 40px;
  background: ${props => {
    if (props.$won === true) return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    if (props.$won === false) return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    return 'linear-gradient(135deg, #6930c3 0%, #8e44ad 100%)';
  }};
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--text-light);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 10;
  opacity: ${props => props.$visible ? 1 : 0};
  pointer-events: ${props => props.$visible ? 'auto' : 'none'};

  /* Arrow pointing down */
  &::after {
    content: '▼';
    position: absolute;
    bottom: -18px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 14px;
    color: ${props => {
      if (props.$won === true) return '#10b981';
      if (props.$won === false) return '#ef4444';
      return '#6930c3';
    }};
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  @media (max-width: 768px) {
    width: 36px;
    height: 36px;
    font-size: 1rem;

    &::after {
      font-size: 12px;
      bottom: -16px;
    }
  }
`;

const ThresholdDisplay = styled.div`
  text-align: center;
  font-size: 2rem;
  font-weight: 700;
  color: var(--accent-primary);
  margin-bottom: 1rem;
  margin-top: 0.5rem;
`;

const ResultDisplay = styled.div`
  text-align: center;
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  margin-top: 0.5rem;
  color: ${props => props.$won ? '#10b981' : '#ef4444'};
  opacity: ${props => props.$fading ? 0 : 1};
  transform: ${props => props.$fading ? 'translateY(-10px)' : 'translateY(0)'};
  transition: opacity 0.4s ease, transform 0.4s ease;
  animation: ${fadeIn} 0.4s ease-out;
`;

const ChoiceSelector = styled.div`
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1.5rem;

  @media (max-width: 768px) {
    gap: 0.75rem;
  }
`;

const ChoiceButton = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem 2rem;
  border-radius: 12px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid;
  min-width: 140px;

  ${props => props.$isOver ? css`
    background: ${props.$active ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent'};
    border-color: ${props.$active ? '#10b981' : 'rgba(16, 185, 129, 0.3)'};
    color: ${props.$active ? 'var(--text-light)' : '#10b981'};

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-color: #10b981;
      color: var(--text-light);
      transform: translateY(-2px);
    }
  ` : css`
    background: ${props.$active ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'transparent'};
    border-color: ${props.$active ? '#ef4444' : 'rgba(239, 68, 68, 0.3)'};
    color: ${props.$active ? 'var(--text-light)' : '#ef4444'};

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      border-color: #ef4444;
      color: var(--text-light);
      transform: translateY(-2px);
    }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    padding: 0.75rem 1.25rem;
    font-size: 0.9rem;
    min-width: 120px;
  }
`;

const ChoiceInfo = styled.span`
  font-size: 0.75rem;
  opacity: 0.8;
  margin-top: 0.25rem;
`;

const StatsRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--table-header-bg);
  border-radius: 12px;
`;

const StatItem = styled.div`
  text-align: center;
`;

const StatLabel = styled.div`
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
  text-transform: uppercase;
`;

const StatValue = styled.div`
  font-size: 1.1rem;
  font-weight: 700;
  color: ${props => props.$color || 'var(--text-primary)'};
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
    if (props.disabled) return 'var(--disabled-text)';
    if (props.$rolling) return 'var(--accent-orange)';
    return 'var(--accent-primary)';
  }};
  border-radius: 12px;
  color: ${props => {
    if (props.disabled) return 'var(--disabled-text)';
    if (props.$rolling) return 'var(--accent-orange)';
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
      if (props.$rolling) return 'linear-gradient(135deg, var(--accent-orange) 0%, #ff8c00 100%)';
      return 'linear-gradient(135deg, var(--accent-primary) 0%, #8e44ad 100%)';
    }};
    color: var(--text-light);
    transform: scale(1.02);
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
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
  border: 2px solid var(--border-color);
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
  border-bottom: 1px solid var(--divider-color);

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

const LabelInfo = styled.span`
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: normal;
  margin-left: 0.5rem;
`;

const LabelWarning = styled.span`
  font-size: 0.85rem;
  color: var(--accent-red);
  font-weight: 600;
  margin-left: 0.75rem;
`;

const DiceInterface = ({
  betAmount,
  setBetAmount,
  threshold,
  setThreshold,
  isOver,
  setIsOver,
  onPlay,
  txState,
  minBet,
  maxBet,
  minThreshold = 4,
  maxThreshold = 97,
  monBalance,
  gameResult,
  isConnected = true,
  getMultiplier,
  getWinChance,
  entropyFee
}) => {
  const { formattedMon: statsContractBalanceMon } = useMinigameStatsContractBalance();
  const [showTooltip, setShowTooltip] = useState(false);
  const [stats, setStats] = useState(null);
  const [inputShake, setInputShake] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [fadingResult, setFadingResult] = useState(false);
  const [displayedResult, setDisplayedResult] = useState(null);
  const [dicePosition, setDicePosition] = useState(50);
  const [showLeaderboard, setShowLeaderboard] = useState(() => window.innerWidth > 768);
  const [leaderboardWasOpen, setLeaderboardWasOpen] = useState(false);
  const [containerHeight, setContainerHeight] = useState(null);
  const tooltipRef = useRef(null);
  const buttonRef = useRef(null);
  const leaderboardRef = useRef(null);
  const leaderboardButtonRef = useRef(null);
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  const targetPositionRef = useRef(null);
  const currentPositionRef = useRef(50);

  const isRolling = txState === 'betting' || txState === 'confirming' || txState === 'waiting_vrf';

  // Win chances calculated locally (no edge shown)
  const winChance = getWinChance(threshold, isOver);
  const underChance = getWinChance(threshold, false);
  const overChance = getWinChance(threshold, true);

  // Multiplier from cached API data (no RPC calls)
  const multiplier = getMultiplier(threshold, isOver);

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
        const data = await getDiceStats();
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


  // Handle rolling state - start oscillation
  useEffect(() => {
    if (isRolling) {
      setShowResult(false);
      setDisplayedResult(null);
      targetPositionRef.current = null;

      // Start infinite oscillation while rolling
      const startTime = Date.now();
      const frequency = 0.003; // Much slower - about 1 full cycle per 2 seconds
      const amplitude = 35;

      const oscillate = () => {
        if (targetPositionRef.current !== null) return; // Stop if target is set

        const elapsed = Date.now() - startTime;
        const position = 50 + Math.sin(elapsed * frequency) * amplitude;
        currentPositionRef.current = position; // Track current position
        setDicePosition(position);
        animationRef.current = requestAnimationFrame(oscillate);
      };

      animationRef.current = requestAnimationFrame(oscillate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [isRolling]);

  // Handle game result - smoothly transition to result
  useEffect(() => {
    if (gameResult) {
      // Cancel any running animation FIRST
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      targetPositionRef.current = gameResult.result;

      setDisplayedResult(gameResult);
      setShowResult(true);
      setFadingResult(false);

      // Get current position from ref (not stale state)
      const startPosition = currentPositionRef.current;
      const targetPosition = gameResult.result;
      const startTime = Date.now();
      const duration = 1500;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const position = startPosition + (targetPosition - startPosition) * easeOut;
        setDicePosition(position);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setDicePosition(targetPosition);
        }
      };

      animationRef.current = requestAnimationFrame(animate);

      // Start fading after 3.5 seconds
      const fadeTimer = setTimeout(() => {
        setFadingResult(true);
      }, 3500);

      // Hide completely after 4 seconds
      const hideTimer = setTimeout(() => {
        setShowResult(false);
        setFadingResult(false);
        setDicePosition(50);
        currentPositionRef.current = 50;
      }, 4000);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [gameResult]);

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

  // Hide leaderboard during rolling and result, reopen after
  const shouldHideLeaderboard = isRolling || showResult;
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

  const getExpectedPayout = () => {
    if (!betAmount || parseFloat(betAmount) <= 0 || !multiplier) return null;
    const bet = parseFloat(betAmount);
    const payout = (bet * multiplier).toFixed(4);
    return payout;
  };

  const getButtonText = () => {
    if (!isConnected) return 'Connect Wallet';
    if (txState === 'betting') return 'Confirming...';
    if (txState === 'confirming') return 'Processing...';
    if (txState === 'waiting_vrf') return 'Waiting for Result...';
    return 'Roll Dice';
  };

  const isButtonDisabled = () => {
    if (!isConnected) return true;
    if (isRolling) return true;
    if (!betAmount || parseFloat(betAmount) <= 0) return true;
    const minBetNum = parseFloat(minBet || '50');
    const maxBetNum = parseFloat(maxBet || '1000');
    if (parseFloat(betAmount) < minBetNum) return true;
    if (parseFloat(betAmount) > maxBetNum) return true;
    return false;
  };

  const getDiceValue = () => {
    if (displayedResult && showResult) {
      return displayedResult.result;
    }
    return '?';
  };

  const getDiceWonState = () => {
    if (displayedResult && showResult) {
      return displayedResult.won;
    }
    return null;
  };

  const isDiceVisible = isRolling || showResult;

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
            Select your number, and whether the dice roll will be over or under that selected number to multiply your bet amount.
          </TooltipStatValue>
        </TooltipStatItem>
      </Tooltip>


      {/* Threshold Slider with Mini Dice */}
      <SliderContainer>
        <SliderWrapper>
          <MiniDice
            $position={dicePosition}
            $won={getDiceWonState()}
            $visible={isDiceVisible}
          >
            {getDiceValue()}
          </MiniDice>
          <Slider
            type="range"
            min="0"
            max="100"
            value={threshold}
            onChange={(e) => {
              if (isRolling) return;
              let val = Number(e.target.value);
              if (val < minThreshold) val = minThreshold;
              if (val > maxThreshold) val = maxThreshold;
              setThreshold(val);
            }}
            disabled={isRolling}
            $isOver={isOver}
          />
        </SliderWrapper>
        <SliderLabel>
          <span>0</span>
          <span>Threshold</span>
          <span>100</span>
        </SliderLabel>
        {/* Show result OR threshold - not both */}
        {showResult && displayedResult ? (
          <ResultDisplay $won={displayedResult.won} $fading={fadingResult}>
            {displayedResult.won ? 'You Won! ' : 'You Lost · '}
            Rolled {displayedResult.result}
            {displayedResult.won && ` · +${displayedResult.payout} MON`}
          </ResultDisplay>
        ) : (
          <ThresholdDisplay>{threshold}</ThresholdDisplay>
        )}
      </SliderContainer>

      {/* Over/Under Selection */}
      <ChoiceSelector>
        <ChoiceButton
          $isOver={false}
          $active={!isOver}
          onClick={() => !isRolling && setIsOver(false)}
          disabled={isRolling}
        >
          ↓ UNDER {threshold}
          <ChoiceInfo>{underChance}% chance</ChoiceInfo>
        </ChoiceButton>
        <ChoiceButton
          $isOver={true}
          $active={isOver}
          onClick={() => !isRolling && setIsOver(true)}
          disabled={isRolling}
        >
          ↑ OVER {threshold}
          <ChoiceInfo>{overChance}% chance</ChoiceInfo>
        </ChoiceButton>
      </ChoiceSelector>

      {/* Stats Row */}
      <StatsRow>
        <StatItem>
          <StatLabel>Multiplier</StatLabel>
          <StatValue $color="#6930c3">{multiplier.toFixed(2)}x</StatValue>
        </StatItem>
        <StatItem>
          <StatLabel>Win Chance</StatLabel>
          <StatValue $color="#10b981">{winChance}%</StatValue>
        </StatItem>
        <StatItem>
          <StatLabel>Potential Win</StatLabel>
          <StatValue $color="#6930c3">{getExpectedPayout() || '0'} MON</StatValue>
        </StatItem>
      </StatsRow>

      {/* Bet Input */}
      <InputGroup>
        <Label>
          <LabelIcon src={monadImage} alt="MON" />
          Bet Amount (MON)
          <LabelInfo>
            (Min: {minBet} / Max: {maxBet})
          </LabelInfo>
          <LabelWarning>
            *2.5% house edge
          </LabelWarning>
        </Label>
        <Input
          type="number"
          placeholder={minBet}
          value={betAmount}
          onChange={(e) => handleBetAmountChange(e.target.value)}
          min="0"
          step="0.01"
          $shake={inputShake}
          disabled={isRolling}
        />
        {monBalance && (
          <BalanceDisplay>
            Balance: <span><BalanceIcon src={monadImage} alt="MON" />{parseFloat(monBalance).toFixed(4)} MON</span>
          </BalanceDisplay>
        )}
      </InputGroup>

      <ActionButton
        onClick={onPlay}
        disabled={isButtonDisabled()}
        $rolling={isRolling}
      >
        {getButtonText()}
      </ActionButton>

      {entropyFee && txState === 'idle' && (
        <EntropyFeeDisplay entropyFee={entropyFee} />
      )}
    </Container>
  );
};

export default DiceInterface;
