import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { getLimboStats } from '../utils/limboApi';
import monadImage from '../../../assets/images/monad.png';
import LeaderboardTooltip from './LeaderboardTooltip';
import EntropyFeeDisplay from '../../common/EntropyFeeDisplay';
import { useMinigameStatsContractBalance } from '../../../hooks/useMinigameStatsContractBalance';

// ═══════════════════════════════════════════════════════════════
// ANIMATIONS
// ═══════════════════════════════════════════════════════════════

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
  20%, 40%, 60%, 80% { transform: translateX(8px); }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
`;

// ═══════════════════════════════════════════════════════════════
// MAIN CONTAINER
// ═══════════════════════════════════════════════════════════════

const Container = styled.div`
  animation: ${fadeIn} 0.6s ease-out;
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
`;

// ═══════════════════════════════════════════════════════════════
// RECENT RESULTS BAR
// ═══════════════════════════════════════════════════════════════

const RecentResultsBar = styled.div`
  position: absolute;
  top: 12px;
  left: 12px;
  right: 120px;
  display: flex;
  justify-content: flex-start;
  gap: 5px;
  overflow-x: auto;
  z-index: 5;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const ResultChip = styled.div`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 700;
  background: ${props => {
    const mult = parseFloat(props.$multiplier);
    if (mult >= 10) return 'linear-gradient(135deg, var(--accent-green) 0%, var(--accent-green-dark, #16a34a) 100%)';
    if (mult >= 2) return 'linear-gradient(135deg, var(--accent-blue-light, #3b82f6) 0%, var(--accent-blue) 100%)';
    return 'var(--bg-glass)';
  }};
  color: ${props => {
    const mult = parseFloat(props.$multiplier);
    if (mult >= 2) return 'white';
    return 'var(--text-secondary)';
  }};
  white-space: nowrap;
  flex-shrink: 0;
`;

// ═══════════════════════════════════════════════════════════════
// GAME AREA (Graph + Multiplier)
// ═══════════════════════════════════════════════════════════════

const GameArea = styled.div`
  background: var(--bg-card);
  border-radius: 20px;
  padding: 2rem;
  margin-bottom: 1rem;
  position: relative;
  overflow: visible;
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--border-light);

  @media (max-width: 768px) {
    padding: 1rem;
    min-height: 160px;
  }
`;

const MultiplierDisplay = styled.div`
  position: relative;
  z-index: 10;
  text-align: center;
`;

const MultiplierValue = styled.div`
  font-size: 5rem;
  font-weight: 900;
  color: ${props => {
    if (props.$won === true) return 'var(--accent-green)';
    if (props.$won === false) return 'var(--accent-red)';
    if (props.$rolling) return 'var(--accent-green)';
    return 'var(--accent-green)';
  }};
  text-shadow: 0 0 40px ${props => {
    if (props.$won === true) return 'var(--accent-green-glow, rgba(34, 197, 94, 0.5))';
    if (props.$won === false) return 'var(--accent-red-glow, rgba(239, 68, 68, 0.5))';
    return 'var(--accent-green-glow, rgba(34, 197, 94, 0.3))';
  }};
  animation: ${props => props.$rolling ? pulse : 'none'} 0.3s ease-in-out infinite;
  transition: color 0.3s ease;
  font-family: 'Arial Black', sans-serif;
  letter-spacing: -2px;

  @media (max-width: 768px) {
    font-size: 3.5rem;
  }
`;

const PayoutDisplay = styled.div`
  font-size: 1.2rem;
  font-weight: 700;
  margin-top: 0.5rem;
  color: ${props => props.$won ? 'var(--accent-green)' : 'var(--accent-red)'};
`;

// ═══════════════════════════════════════════════════════════════
// CONTROLS PANEL
// ═══════════════════════════════════════════════════════════════

const ControlsPanel = styled.div`
  background: var(--bg-card);
  border: 2px solid var(--border-light);
  border-radius: 20px;
  padding: 1.5rem;
  position: relative;
`;

const ControlsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const InputSection = styled.div`
  display: flex;
  flex-direction: column;
`;

const InputLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
`;

const LabelIcon = styled.img`
  width: 16px;
  height: 16px;
  border-radius: 50%;
`;

const InputWrapper = styled.div`
  display: flex;
  align-items: center;
  background: var(--input-bg);
  border: 2px solid var(--input-border);
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.2s;

  &:focus-within {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px var(--border-light);
  }
`;

const Input = styled.input`
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  font-size: 1rem;
  font-weight: 600;
  background: transparent;
  outline: none;
  color: var(--text-primary);
  animation: ${props => props.$shake ? shake : 'none'} 0.5s ease;

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  &[type=number] {
    -moz-appearance: textfield;
  }

  &:disabled {
    color: var(--text-secondary);
  }
`;

const InputButton = styled.button`
  padding: 0.75rem;
  background: transparent;
  border: none;
  border-left: 1px solid var(--border-light);
  color: var(--accent-primary);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: var(--border-light);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const TargetWrapper = styled.div`
  display: flex;
  align-items: center;
  background: var(--input-bg);
  border: 2px solid var(--input-border);
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.2s;

  &:focus-within {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px var(--border-light);
  }
`;

const TargetInput = styled.input`
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  font-size: 1rem;
  font-weight: 600;
  background: transparent;
  outline: none;
  text-align: center;
  color: var(--text-primary);

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  &[type=number] {
    -moz-appearance: textfield;
  }

  &:disabled {
    color: var(--text-secondary);
  }
`;

const TargetSuffix = styled.span`
  padding-right: 1rem;
  font-weight: 700;
  color: var(--accent-primary);
  font-size: 1rem;
`;

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const StatBox = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: ${props => props.$green ? 'var(--accent-green-bg, rgba(34, 197, 94, 0.1))' : 'var(--table-header-bg)'};
  border-radius: 10px;
`;

const StatLabel = styled.span`
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 500;
`;

const StatValue = styled.span`
  font-size: 0.95rem;
  font-weight: 700;
  color: ${props => props.$green ? 'var(--accent-green)' : 'var(--accent-primary)'};
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const StatIcon = styled.img`
  width: 14px;
  height: 14px;
  border-radius: 50%;
`;

const HouseEdge = styled.span`
  font-size: 0.75rem;
  color: var(--accent-red);
  font-weight: 600;
  margin-left: auto;
`;

const BetButton = styled.button`
  width: 100%;
  padding: 1rem;
  background: ${props => {
    if (props.disabled) return 'var(--bg-disabled, #e5e7eb)';
    if (props.$rolling) return 'linear-gradient(135deg, var(--accent-orange) 0%, var(--accent-orange-dark, #d97706) 100%)';
    return 'linear-gradient(135deg, var(--accent-green) 0%, var(--accent-green-dark, #16a34a) 100%)';
  }};
  border: none;
  border-radius: 12px;
  color: ${props => props.disabled ? 'var(--text-tertiary)' : 'white'};
  font-weight: 700;
  font-size: 1.1rem;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px ${props => props.$rolling ? 'var(--accent-orange-glow, rgba(245, 158, 11, 0.4))' : 'var(--accent-green-glow, rgba(34, 197, 94, 0.4))'};
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
`;

const BalanceRow = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-light);
`;

const BalanceLabel = styled.span`
  font-size: 0.8rem;
  color: var(--text-secondary);
`;

const BalanceValue = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent-primary);
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const BalanceIcon = styled.img`
  width: 14px;
  height: 14px;
  border-radius: 50%;
`;

// ═══════════════════════════════════════════════════════════════
// INFO TOOLTIP
// ═══════════════════════════════════════════════════════════════

const HeaderButtons = styled.div`
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  display: flex;
  gap: 0.5rem;
  z-index: 20;
`;

const InfoButton = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--border-light);
  border: 2px solid var(--border-color);
  color: var(--accent-primary);
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    background: var(--border-color);
    transform: scale(1.1);
  }
`;

const LeaderboardButton = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${props => props.$active ? 'var(--border-color)' : 'var(--border-light)'};
  border: 2px solid ${props => props.$active ? 'var(--accent-primary)' : 'var(--border-color)'};
  color: var(--accent-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    background: var(--border-color);
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
    min-width: 200px;
    left: auto;
    right: 0;
    top: 40px;
    bottom: auto;
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

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

const LimboInterface = ({
  betAmount,
  setBetAmount,
  targetMultiplier,
  setTargetMultiplier,
  onPlay,
  txState,
  minBet,
  maxBet,
  monBalance,
  gameResult,
  isConnected = true,
  getWinChance,
  entropyFee,
  recentResults = []
}) => {
  const { formattedMon: statsContractBalanceMon } = useMinigameStatsContractBalance();
  const [showTooltip, setShowTooltip] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(() => window.innerWidth > 768);
  const [stats, setStats] = useState(null);
  const [inputShake, setInputShake] = useState(false);
  const [displayMultiplier, setDisplayMultiplier] = useState('1.00');
  const [resultState, setResultState] = useState(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const tooltipRef = useRef(null);
  const buttonRef = useRef(null);
  const leaderboardRef = useRef(null);
  const leaderboardButtonRef = useRef(null);
  const containerRef = useRef(null);

  const isRolling = txState === 'betting' || txState === 'confirming' || txState === 'waiting_vrf';

  const winChance = getWinChance(parseFloat(targetMultiplier) || 1.01);
  const potentialProfit = betAmount && parseFloat(betAmount) > 0 && targetMultiplier
    ? (parseFloat(betAmount) * parseFloat(targetMultiplier) * 0.975 - parseFloat(betAmount)).toFixed(4)
    : '0';

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
        const data = await getLimboStats();
        if (data.success) {
          setStats(data.data);
        }
      } catch (err) {}
    };

    fetchStats();
    const interval = setInterval(fetchStats, 15000); // Optimized: 15s instead of 10s
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Draw parabolic graph
  const drawGraph = useCallback((progress, result = null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    const width = rect.width;
    const height = rect.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(105, 48, 195, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const y = (height / 10) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (progress <= 0) return;

    // Determine color based on result
    let lineColor = '#22c55e'; // Default green
    if (result !== null) {
      lineColor = result ? '#22c55e' : '#ef4444';
    }

    // Draw parabolic curve
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const startX = 50;
    const startY = height - 50;
    const maxProgress = Math.min(progress, 1);

    ctx.moveTo(startX, startY);

    for (let t = 0; t <= maxProgress; t += 0.01) {
      // Parabolic curve: starts flat, curves up exponentially
      const x = startX + (width - 100) * t;
      const curveHeight = (height - 100) * Math.pow(t, 1.5);
      const y = startY - curveHeight;
      ctx.lineTo(x, Math.max(y, 30));
    }

    ctx.stroke();

    // Glow effect
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw rocket at the end of curve
    if (progress > 0) {
      const endT = maxProgress;
      const endX = startX + (width - 100) * endT;
      const endY = startY - (height - 100) * Math.pow(endT, 1.5);

      ctx.fillStyle = lineColor;
      ctx.beginPath();
      ctx.arc(endX, Math.max(endY, 30), 8, 0, Math.PI * 2);
      ctx.fill();

      // Outer glow
      ctx.fillStyle = `${lineColor}40`;
      ctx.beginPath();
      ctx.arc(endX, Math.max(endY, 30), 15, 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);

  // Rolling animation
  useEffect(() => {
    if (isRolling) {
      setResultState(null);
      let progress = 0;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        progress = Math.min(elapsed / 3000, 0.95); // Max 95% during rolling

        // Random multiplier animation
        const randomMult = (1 + Math.random() * (parseFloat(targetMultiplier) * 1.5 || 10)).toFixed(2);
        setDisplayMultiplier(randomMult);

        drawGraph(progress);
        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
    // Don't reset displayMultiplier here - let gameResult handler do it
  }, [isRolling, targetMultiplier, drawGraph]);

  // Update display when targetMultiplier changes (only when idle)
  useEffect(() => {
    if (!isRolling && !gameResult && resultState === null) {
      setDisplayMultiplier(targetMultiplier || '1.00');
      drawGraph(0);
    }
  }, [targetMultiplier]);

  // Handle game result
  useEffect(() => {
    if (gameResult) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      setDisplayMultiplier(gameResult.resultMultiplier);
      setResultState(gameResult.won);
      drawGraph(1, gameResult.won);

      // Reset after 3 seconds
      const timer = setTimeout(() => {
        setResultState(null);
        setDisplayMultiplier(targetMultiplier || '1.00');
        drawGraph(0);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [gameResult, targetMultiplier, drawGraph]);

  // Initial draw
  useEffect(() => {
    drawGraph(0);
  }, [drawGraph]);

  // Close tooltip on outside click
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

  // Track container height for leaderboard max-height
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.offsetHeight);
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const handleBetAmountChange = (value) => {
    if (value.includes(',')) return;
    const numValue = parseFloat(value);
    if (value === '' || value === '.') {
      setBetAmount(value);
      return;
    }
    if (isNaN(numValue) || numValue < 0) return;
    const maxBetNum = parseFloat(maxBet || '1');
    if (numValue > maxBetNum) {
      setInputShake(true);
      setTimeout(() => setInputShake(false), 500);
      setBetAmount(maxBetNum.toString());
      return;
    }
    setBetAmount(value);
  };

  const handleTargetChange = (value) => {
    if (value === '' || value === '.') {
      setTargetMultiplier(value);
      return;
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;
    if (numValue > 100) {
      setTargetMultiplier('100');
      return;
    }
    setTargetMultiplier(value);
  };

  const handleHalf = () => {
    const current = parseFloat(betAmount) || 0;
    setBetAmount((current / 2).toFixed(4));
  };

  const handleDouble = () => {
    const current = parseFloat(betAmount) || 0;
    const doubled = current * 2;
    const maxBetNum = parseFloat(maxBet || '1');
    setBetAmount(Math.min(doubled, maxBetNum).toFixed(4));
  };

  const getButtonText = () => {
    if (!isConnected) return 'Connect Wallet';
    if (txState === 'betting') return 'Confirming...';
    if (txState === 'confirming') return 'Processing...';
    if (txState === 'waiting_vrf') return 'Rolling...';
    return 'Bet';
  };

  const isButtonDisabled = () => {
    if (!isConnected) return true;
    if (isRolling) return true;
    if (!betAmount || parseFloat(betAmount) <= 0) return true;
    if (!targetMultiplier || parseFloat(targetMultiplier) < 1.01) return true;
    return false;
  };

  return (
    <Container ref={containerRef}>
      {/* Game Area with Graph */}
      <GameArea>
        {/* Recent Results - Top of GameArea */}
        {recentResults && recentResults.length > 0 && (
          <RecentResultsBar>
            {recentResults.map((result, index) => (
              <ResultChip key={index} $multiplier={result}>
                {parseFloat(result).toFixed(2)}x
              </ResultChip>
            ))}
          </RecentResultsBar>
        )}
        <HeaderButtons>
          <div style={{ position: 'relative' }}>
            <LeaderboardButton
              ref={leaderboardButtonRef}
              $active={showLeaderboard}
              onClick={() => setShowLeaderboard(!showLeaderboard)}
              aria-label="Show leaderboard"
              title="Leaderboard"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 11V3H8v6H2v12h20V11h-6zm-6-6h4v14h-4V5zm-6 6h4v8H4v-8zm16 8h-4v-6h4v6z"/>
              </svg>
            </LeaderboardButton>
            <LeaderboardTooltip
              isOpen={showLeaderboard}
              panelRef={leaderboardRef}
              maxHeight={containerHeight}
            />
          </div>
          <InfoButton ref={buttonRef} onClick={() => setShowTooltip(!showTooltip)}>i</InfoButton>
        </HeaderButtons>

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
              Set your target multiplier and place your bet. If the generated multiplier reaches or exceeds your target, you win. Higher targets mean higher payouts but lower win chances.
            </TooltipStatValue>
          </TooltipStatItem>
        </Tooltip>

        <MultiplierDisplay>
          <MultiplierValue $won={resultState} $rolling={isRolling}>
            {displayMultiplier}x
          </MultiplierValue>
          {resultState !== null && gameResult && (
            <PayoutDisplay $won={resultState}>
              {resultState ? `+${parseFloat(gameResult.payout).toFixed(4)} MON` : `-${parseFloat(betAmount || 0).toFixed(4)} MON`}
            </PayoutDisplay>
          )}
        </MultiplierDisplay>
      </GameArea>

      {/* Controls Panel */}
      <ControlsPanel>
        <ControlsGrid>
          {/* Bet Amount */}
          <InputSection>
            <InputLabel>
              <LabelIcon src={monadImage} alt="MON" />
              Bet Amount
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'normal', marginLeft: '0.5rem', whiteSpace: 'nowrap' }}>
                (Min: {minBet} / Max: {maxBet})
              </span>
              <HouseEdge>*2.5% house edge</HouseEdge>
            </InputLabel>
            <InputWrapper>
              <Input
                type="number"
                placeholder={minBet || '0.01'}
                value={betAmount}
                onChange={(e) => handleBetAmountChange(e.target.value)}
                $shake={inputShake}
                disabled={isRolling}
              />
              <InputButton onClick={handleHalf} disabled={isRolling}>½</InputButton>
              <InputButton onClick={handleDouble} disabled={isRolling}>2×</InputButton>
            </InputWrapper>
            {/* Balance under Bet Amount */}
            {monBalance && (
              <BalanceRow style={{ marginTop: '0.25rem', paddingTop: '0', borderTop: 'none' }}>
                <BalanceLabel>Balance:</BalanceLabel>
                <BalanceValue>
                  <BalanceIcon src={monadImage} alt="" />{parseFloat(monBalance).toFixed(4)} MON
                </BalanceValue>
              </BalanceRow>
            )}
          </InputSection>

          {/* Target Multiplier */}
          <InputSection>
            <InputLabel>Target Multiplier</InputLabel>
            <TargetWrapper>
              <TargetInput
                type="number"
                placeholder="2.00"
                value={targetMultiplier}
                onChange={(e) => handleTargetChange(e.target.value)}
                min="1.01"
                max="100"
                step="0.01"
                disabled={isRolling}
              />
              <TargetSuffix>×</TargetSuffix>
            </TargetWrapper>
          </InputSection>
        </ControlsGrid>

        {/* Win Chance & Profit on Win - Side by Side */}
        <StatsRow>
          <StatBox>
            <StatLabel>Win Chance</StatLabel>
            <StatValue>{winChance}%</StatValue>
          </StatBox>
          <StatBox $green>
            <StatLabel>Profit on Win</StatLabel>
            <StatValue $green>
              <StatIcon src={monadImage} alt="MON" />
              {potentialProfit}
            </StatValue>
          </StatBox>
        </StatsRow>

        {/* Bet Button */}
        <BetButton
          onClick={onPlay}
          disabled={isButtonDisabled()}
          $rolling={isRolling}
        >
          {getButtonText()}
        </BetButton>

        {entropyFee && !isRolling && (
          <EntropyFeeDisplay entropyFee={entropyFee} />
        )}
      </ControlsPanel>
    </Container>
  );
};

export default LimboInterface;
