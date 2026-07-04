import React, { useRef, useEffect, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import monadImage from '../../../assets/images/monad.png';
import { getFlipStats } from '../utils/flipApi';
import LeaderboardTooltip from './LeaderboardTooltip';
import EntropyFeeDisplay from '../../common/EntropyFeeDisplay';

// Flip coin images and animation
const coinHeadsImage = '/assets/images/flip/head.png';
const coinTailsImage = '/assets/images/flip/tail.png';
const coinFlipVideo = '/assets/images/flip/video.webm';

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
  background: var(--bg-glass);
  border: 2px solid var(--border-light);
  border-radius: 20px;
  padding: 2rem 2.5rem 2.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 8px 25px var(--shadow-color);
  animation: ${fadeIn} 0.6s ease-out;
  position: relative;

  @media (max-width: 768px) {
    padding: 1.5rem;
    border-radius: 16px;
  }
`;

const BalanceDisplay = styled.div`
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-bottom: 1rem;
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

const InputGroup = styled.div`
  margin-bottom: 2rem;

  ${props => props.$compactBottom && css`
    margin-bottom: 0.75rem;
  `}
`;

const InputRow = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: stretch;

  @media (max-width: 768px) {
    gap: 0.5rem;
  }
`;

const InputWrapper = styled.div`
  flex: 1;
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
    box-shadow: 0 0 0 3px var(--border-light);
  }

  &::placeholder {
    color: var(--placeholder-color);
  }

  /* Remove number input spinners */
  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  &[type=number] {
    -moz-appearance: textfield;
  }
`;

const ChoiceSelector = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
`;

const ToggleSwitch = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  background: var(--table-header-bg);
  border: 2px solid var(--border-color);
  border-radius: 50px;
  padding: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;
  width: 280px;
  height: 50px;

  &:hover {
    border-color: var(--accent-primary);
  }

  @media (max-width: 768px) {
    width: 240px;
    height: 45px;
  }
`;

const ToggleSlider = styled.div`
  position: absolute;
  width: calc(50% - 4px);
  height: calc(100% - 8px);
  background: linear-gradient(135deg, var(--accent-primary) 0%, #8e44ad 100%);
  border-radius: 50px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  left: ${props => props.$isHeads ? '4px' : 'calc(50% + 0px)'};
  box-shadow: 0 2px 8px var(--shadow-color);
`;

const ToggleOption = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  font-weight: 700;
  font-size: 0.9rem;
  color: ${props => props.$active ? 'var(--text-light)' : 'var(--text-secondary)'};
  transition: color 0.3s ease;
  z-index: 1;
  position: relative;

  @media (max-width: 768px) {
    font-size: 0.85rem;
  }
`;

const ButtonWrapper = styled.div`
  min-height: 60px;
  display: flex;
  align-items: center;
  width: 100%;
`;

const FlipButton = styled.button`
  width: 100%;
  padding: 16px;
  background: transparent;
  border: 2px solid ${props => {
    if (props.disabled) return 'var(--text-tertiary)';
    if (props.$txState === 'pending' || props.$txState === 'confirming') return '#ffa502';
    if (props.$txState === 'waiting-result') return '#1e90ff';
    return 'var(--accent-blue)';
  }};
  border-radius: 8px;
  color: ${props => {
    if (props.disabled) return 'var(--text-tertiary)';
    if (props.$txState === 'pending' || props.$txState === 'confirming') return '#ffa502';
    if (props.$txState === 'waiting-result') return '#1e90ff';
    return 'var(--accent-blue)';
  }};
  font-weight: 700;
  font-size: 16px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &:hover:not(:disabled) {
    transform: scale(1.02);
    box-shadow: 0 4px 12px var(--shadow-color);
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  @media (max-width: 768px) {
    padding: 1rem;
    font-size: 0.9rem;
  }
`;

const StatusText = styled.div`
  text-align: center;
  margin-top: 1rem;
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.9rem;
`;

const CoinContainer = styled.div`
  perspective: 1000px;
  width: 400px;
  height: 200px;
  margin: 0 auto 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: visible;

  @media (max-width: 768px) {
    width: 320px;
    height: 160px;
  }
`;

const Coin = styled.div`
  position: relative;
  width: 200px;
  height: 200px;
  transform-style: preserve-3d;

  @media (max-width: 768px) {
    width: 160px;
    height: 160px;
  }
  ${props => {
    if (props.$result !== null || props.$choice !== null) {
      // Smooth transition to final result or choice
      return css`
        transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
      `;
    }
    return css`
      transition: none;
    `;
  }}
  ${props => {
    // No CSS animation when flipping - video handles the animation
    if (props.$isFlipping) {
      return css`
        animation: none;
      `;
    }
    return css`
      animation: none;
    `;
  }}
  ${props => {
    if (props.$result !== null && !props.$isFlipping) {
      // Show result side with slight bounce effect
      const rotation = props.$result ? '0deg' : '180deg';
      return css`
        transform: rotateY(${rotation}) translateY(0px);
      `;
    } else if (props.$choice !== null && !props.$isFlipping) {
      // Show choice side (true = heads = 0deg, false = tails = 180deg)
      const rotation = props.$choice ? '0deg' : '180deg';
      return css`
        transform: rotateY(${rotation}) translateY(0px);
      `;
    }
    return css`
      transform: rotateY(0deg) translateY(0px);
    `;
  }}
`;

const CoinFace = styled.div`
  position: absolute;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  backface-visibility: hidden;
  box-shadow: none;
  transition: box-shadow 0.3s ease;
  background-size: 142%;
  background-position: center;
  background-repeat: no-repeat;
  overflow: hidden;
  opacity: ${props => props.$showVideo ? 0 : 1};
  visibility: ${props => props.$showVideo ? 'hidden' : 'visible'};
  transition: opacity 0.3s ease, visibility 0.3s ease;

  @media (max-width: 768px) {
    width: 160px;
    height: 160px;
    background-size: 142%;
  }
  
  ${props => props.$side === 'heads' ? `
    background-image: url(${coinHeadsImage});
    background-color: #fbbf24; /* Fallback color */
    transform: rotateY(0deg) translateZ(2px);
  ` : `
    background-image: url(${coinTailsImage});
    background-color: #e5e7eb; /* Fallback color */
    transform: rotateY(180deg) translateZ(2px);
  `}
`;

const CoinVideo = styled.video`
  position: absolute;
  width: 284px;
  height: 284px;
  border-radius: 50%;
  object-fit: cover;
  opacity: ${props => props.$show ? 1 : 0};
  visibility: ${props => props.$show ? 'visible' : 'hidden'};
  transition: opacity 0.3s ease;
  box-shadow: none;
  z-index: 1;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);

  @media (max-width: 768px) {
    width: 227px;
    height: 227px;
  }
`;

// Bet limits
const MIN_BET_MON = 10;
const MAX_BET_MON = 2000;
const MAX_BET_LMON = 100000;

// Info button and tooltip styles
const HeaderButtons = styled.div`
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  display: flex;
  gap: 0.5rem;
  z-index: 10;

  @media (max-width: 768px) {
    top: 1rem;
    right: 1rem;
  }
`;

const InfoButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--table-header-bg);
  border: 2px solid var(--border-color);
  color: var(--accent-primary);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;

  &:hover {
    background: var(--border-color);
    border-color: var(--accent-primary);
    transform: scale(1.1);
  }

  @media (max-width: 768px) {
    width: 28px;
    height: 28px;
    font-size: 0.9rem;
  }
`;

const LeaderboardButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${props => props.$active ? 'var(--border-color)' : 'var(--table-header-bg)'};
  border: 2px solid ${props => props.$active ? 'var(--accent-primary)' : 'var(--border-color)'};
  color: var(--accent-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;

  &:hover {
    background: var(--border-color);
    border-color: var(--accent-primary);
    transform: scale(1.1);
  }

  @media (max-width: 768px) {
    width: 28px;
    height: 28px;
  }

  svg {
    width: 16px;
    height: 16px;

    @media (max-width: 768px) {
      width: 14px;
      height: 14px;
    }
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
  min-width: 280px;
  z-index: 1000;
  opacity: ${props => props.$show ? '1' : '0'};
  visibility: ${props => props.$show ? 'visible' : 'hidden'};
  transform: ${props => props.$show ? 'translateX(0)' : 'translateX(-10px)'};
  transition: all 0.3s ease;

  @media (max-width: 768px) {
    min-width: 260px;
    left: 0;
    top: calc(100% + 10px);
    transform: ${props => props.$show ? 'translateY(0)' : 'translateY(-10px)'};
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
  letter-spacing: 0.5px;
`;

const TooltipStatValue = styled.div`
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;

  span {
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
`;

const TooltipTokenIcon = styled.img`
  width: 16px;
  height: 16px;
  border-radius: 50%;
`;

const CoinFlipInterface = ({
  tokenType,
  setTokenType,
  betAmount,
  setBetAmount,
  choice,
  setChoice,
  onFlip,
  txState,
  entropyFee,
  lmonBalance,
  monBalance,
  needsApproval,
  flipResult,
  resultBetAmount,
  onResultClick,
  isConnected = true
}) => {
  const isFlipping = txState === 'pending' || txState === 'confirming' || txState === 'waiting-result';
  const showAnimation = isFlipping;


  const [leaderboardWasOpen, setLeaderboardWasOpen] = useState(false);


  const shouldHideLeaderboard = isFlipping || flipResult;

  useEffect(() => {
    if (shouldHideLeaderboard && showLeaderboard) {
      setLeaderboardWasOpen(true);
      setShowLeaderboard(false);
    } else if (!shouldHideLeaderboard && leaderboardWasOpen) {
      setLeaderboardWasOpen(false);
      setShowLeaderboard(true);
    }
  }, [shouldHideLeaderboard]);
  
  // Stats state for tooltip
  const [showTooltip, setShowTooltip] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(() => window.innerWidth > 768);
  const [stats, setStats] = useState(null);
  const [containerHeight, setContainerHeight] = useState(null);
  const statsInitialized = useRef(false);
  const tooltipRef = useRef(null);
  const buttonRef = useRef(null);
  const leaderboardRef = useRef(null);
  const leaderboardButtonRef = useRef(null);
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [inputShake, setInputShake] = useState(false);
  const [justResetToMax, setJustResetToMax] = useState(false);
  
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
        const data = await getFlipStats();
        if (data && (data.success || data.contractBalance || data.totalVolume)) {
          setStats(data);
        }
      } catch (err) {
        // Error fetching stats
      } finally {
        if (!statsInitialized.current) {
          statsInitialized.current = true;
        }
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 15000); // Optimized: 15s instead of 10s
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Reset bet amount when token type changes if it exceeds new max
  useEffect(() => {
    if (txState !== 'idle' || flipResult) return;
    if (!betAmount) return;
    
    const numValue = parseFloat(betAmount);
    if (isNaN(numValue)) return;
    
    const maxBet = tokenType === 'MON' ? MAX_BET_MON : MAX_BET_LMON;
    const currentBalance = tokenType === 'MON' ? parseFloat(monBalance || '0') : parseFloat(lmonBalance || '0');
    
    // If bet amount exceeds max bet or balance, reset it
    if (numValue > maxBet || (currentBalance > 0 && numValue > currentBalance)) {
      // Reset to max bet or balance, whichever is lower
      const resetValue = currentBalance > 0 && currentBalance < maxBet ? currentBalance : maxBet;
      setBetAmount(resetValue.toString());
    }
  }, [tokenType, betAmount, monBalance, lmonBalance, txState, flipResult]);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showTooltip &&
        tooltipRef.current &&
        buttonRef.current &&
        !tooltipRef.current.contains(event.target) &&
        !buttonRef.current.contains(event.target)
      ) {
        setShowTooltip(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTooltip, showLeaderboard]);

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

  // Control video playback - only during animation
  useEffect(() => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    
    // Seamless loop handler
    const handleVideoEnd = () => {
      if (showAnimation) {
        video.currentTime = 0;
        video.play().catch(err => {
          // Error replaying video
        });
      }
    };
    
    video.addEventListener('ended', handleVideoEnd);
    
    if (showAnimation) {
      // Video is already sped up 15x via ffmpeg, so we use normal playbackRate
      if (txState === 'pending' || txState === 'confirming') {
        video.playbackRate = 1.0; // Normal speed
      } else if (txState === 'waiting-result') {
        video.playbackRate = 0.8; // Slightly slower when waiting for result
      } else {
        video.playbackRate = 1.0; // Normal speed
      }
      
      // Start playing video when animation starts
      video.play().catch(err => {
        // Error playing video
      });
    } else {
      // Pause and reset video when animation stops
      video.pause();
      video.currentTime = 0;
    }
    
    return () => {
      video.removeEventListener('ended', handleVideoEnd);
    };
  }, [showAnimation, txState]);
  
  // Animation speed control: faster during pending/confirming, slower during waiting-result
  const getAnimationSpeed = () => {
    if (txState === 'pending' || txState === 'confirming') return 0.3; // Fast
    if (txState === 'waiting-result') return 0.6; // Slower
    return 0.5; // Default
  };

  // Format MON values to 2 decimal places
  const formatMON = (value) => {
    if (!value || value === '0') return '0.00';
    const num = parseFloat(value);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };
  // Get max bet for current token type
  const getMaxBet = () => {
    return tokenType === 'MON' ? MAX_BET_MON : MAX_BET_LMON;
  };

  // Validate bet amount
  const handleBetAmountChange = (value) => {
    // Block comma input - only allow dot for decimal separator
    if (value.includes(',')) {
      return; // Don't allow comma
    }
    
    const numValue = parseFloat(value);
    
    // Allow empty input
    if (value === '' || value === '.') {
      setBetAmount(value);
      return;
    }
    
    // Check if valid number
    if (isNaN(numValue)) {
      return;
    }
    
    // Allow negative check (should be handled by min="0" but double check)
    if (numValue < 0) {
      return;
    }
    
    // Check max limit
    const maxBet = getMaxBet();
    if (numValue > maxBet) {
      // Shake animation and reset to max value
      setInputShake(true);
      setJustResetToMax(true);
      setTimeout(() => {
        setInputShake(false);
        setJustResetToMax(false);
      }, 2000); // Show message for 2 seconds
      setBetAmount(maxBet.toString());
      return;
    }
    
    // Check balance limit
    const currentBalance = tokenType === 'MON' ? parseFloat(monBalance || '0') : parseFloat(lmonBalance || '0');
    if (currentBalance > 0 && numValue > currentBalance) {
      // Shake animation and reset to balance
      setInputShake(true);
      setJustResetToMax(true);
      setTimeout(() => {
        setInputShake(false);
        setJustResetToMax(false);
      }, 2000);
      setBetAmount(currentBalance.toString());
      return;
    }
    
    // Reset shake state and flag when valid value is entered
    if (inputShake) {
      setInputShake(false);
    }
    if (justResetToMax) {
      setJustResetToMax(false);
    }
    
    setBetAmount(value);
  };

  // Check if bet amount is invalid (below min, exceeds max or balance)
  const isBetInvalid = () => {
    if (!betAmount) return false;
    const numValue = parseFloat(betAmount);
    if (isNaN(numValue)) return false;

    // Check min limit (only for MON)
    if (tokenType === 'MON' && numValue < MIN_BET_MON) return 'min';

    // Check max limit
    if (numValue > getMaxBet()) return 'max';

    // Check balance limit
    const currentBalance = tokenType === 'MON' ? parseFloat(monBalance || '0') : parseFloat(lmonBalance || '0');
    if (currentBalance > 0 && numValue > currentBalance) return 'balance';

    return false;
  };

  // Keep old function name for backward compatibility
  const isBetExceedsMax = () => {
    return isBetInvalid() !== false;
  };

  // Calculate payout (1.95x multiplier)
  const calculatePayout = () => {
    const displayBetAmount = resultBetAmount || betAmount;
    if (!flipResult || !flipResult.winner || !displayBetAmount) return null;
    try {
      const bet = parseFloat(displayBetAmount);
      const payout = bet * 1.95;
      return payout.toFixed(2);
    } catch {
      return null;
    }
  };
  const getButtonText = () => {
    // If not connected, show connect message
    if (!isConnected) {
      return 'Connect Wallet to Flip';
    }

    // If result is shown, always show "Flip Coin" (don't show Approve)
    if (flipResult && !flipResult.timeout) {
      return 'Flip Coin';
    }

    if (txState === 'pending') return 'Pending...';
    if (txState === 'confirming') return 'Confirming...';
    if (txState === 'waiting-result') return 'Waiting for result...';
    if (needsApproval && tokenType === 'LMON' && betAmount) {
      return 'Approve LMON';
    }
    if (!choice && choice !== false) return 'Select Heads or Tails';
    if (!betAmount) return 'Enter bet amount';
    const betInvalidReason = isBetInvalid();
    if (betInvalidReason || justResetToMax) {
      const maxBet = getMaxBet();
      const currentBalance = tokenType === 'MON' ? parseFloat(monBalance || '0') : parseFloat(lmonBalance || '0');

      // Check which limit is exceeded
      if (betInvalidReason === 'min') {
        return `Min bet: ${MIN_BET_MON} ${tokenType}`;
      }
      if (betInvalidReason === 'balance') {
        return `Insufficient balance: ${currentBalance.toFixed(4)} ${tokenType}`;
      }
      return `Max bet: ${maxBet.toLocaleString()} ${tokenType}`;
    }
    return 'Flip Coin';
  };

  const isFlipDisabled = () => {
    // Disabled if not connected
    if (!isConnected) {
      return true;
    }

    // Disabled during transaction states
    if (txState === 'pending' || txState === 'confirming' || txState === 'waiting-result') {
      return true;
    }

    // Disabled if no choice selected
    if (!choice && choice !== false) {
      return true;
    }

    // Disabled if no bet amount
    if (!betAmount) {
      return true;
    }

    // Disabled if bet exceeds max or balance
    if (isBetExceedsMax()) {
      return true;
    }

    return false;
  };

  const getStatusText = () => {
    if (txState === 'pending') return 'Transaction pending...';
    if (txState === 'confirming') return 'Transaction confirming...';
    // Removed "Waiting for entropy callback..." message
    return '';
  };

  const contractBalance = stats?.contractBalance || {};
  const totalVolume = stats?.totalVolume || {};

  return (
    <Container ref={containerRef}>
      {/* Header Buttons */}
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
        <InfoButton
          ref={buttonRef}
          onClick={() => setShowTooltip(!showTooltip)}
          aria-label="Show statistics"
        >
          i
        </InfoButton>
      </HeaderButtons>

      {/* Tooltip */}
      <Tooltip ref={tooltipRef} $show={showTooltip}>
        <TooltipTitle>Statistics</TooltipTitle>
        
        <TooltipStatItem>
          <TooltipStatLabel>Contract Balance</TooltipStatLabel>
          <TooltipStatValue>
            {formatMON(contractBalance.native?.ether)}
            <span><TooltipTokenIcon src={monadImage} alt="MON" />MON</span>
          </TooltipStatValue>
          {/* LMON stats disabled - uncomment to re-enable */}
          {/* <TooltipStatValue style={{ marginTop: '0.25rem' }}>
            {contractBalance.lmon?.ether || '0'}
            <span><TooltipTokenIcon src={lmonImage} alt="LMON" />LMON</span>
          </TooltipStatValue> */}
        </TooltipStatItem>

        <TooltipStatItem>
          <TooltipStatLabel>Total Volume</TooltipStatLabel>
          <TooltipStatValue>
            {formatMON(totalVolume.native?.ether)}
            <span><TooltipTokenIcon src={monadImage} alt="MON" />MON</span>
          </TooltipStatValue>
          {/* LMON stats disabled - uncomment to re-enable */}
          {/* <TooltipStatValue style={{ marginTop: '0.25rem' }}>
            {totalVolume.lmon?.ether || '0'}
            <span><TooltipTokenIcon src={lmonImage} alt="LMON" />LMON</span>
          </TooltipStatValue> */}
        </TooltipStatItem>
        <TooltipStatItem>
          <TooltipStatLabel>Total Games</TooltipStatLabel>
          <TooltipStatValue>{stats?.gamesPlayed || 0}</TooltipStatValue>
        </TooltipStatItem>
        <TooltipStatItem style={{ marginTop: '0.5rem', paddingTop: '0.75rem' }}>
          <TooltipStatLabel>Rules</TooltipStatLabel>
          <TooltipStatValue style={{ fontSize: '0.85rem', fontWeight: '500', lineHeight: '1.5' }}>
            Choose Heads or Tails and place your bet. If the coin lands on your chosen side, you win 1.95x your bet.
          </TooltipStatValue>
        </TooltipStatItem>
      </Tooltip>

      {/* Coin Animation */}
      <CoinContainer>
        <Coin
          $isFlipping={showAnimation}
          $isWaitingResult={txState === 'waiting-result'}
          $result={flipResult && !flipResult.timeout ? flipResult.result : null}
          $choice={choice}
          $speed={getAnimationSpeed()}
        >
          <CoinVideo
            ref={videoRef}
            $show={showAnimation}
            src={coinFlipVideo}
            autoPlay
            loop
            muted
            playsInline
          />
          <CoinFace $side="heads" $showVideo={showAnimation} />
          <CoinFace $side="tails" $showVideo={showAnimation} />
        </Coin>
      </CoinContainer>

      {/* Show toggle and inputs only when idle (not flipping and no result) */}
      {!flipResult && !(txState === 'pending' || txState === 'confirming' || txState === 'waiting-result') && (
        <>
          <ChoiceSelector>
            <ToggleSwitch
              onClick={() => {
                if (txState === 'idle' || txState === 'error') {
                  setChoice(!choice);
                }
              }}
            >
              <ToggleSlider $isHeads={choice === true || choice === null} />
              <ToggleOption
                $active={choice === true || choice === null}
                onClick={(e) => {
                  e.stopPropagation();
                  if (txState === 'idle' || txState === 'error') setChoice(true);
                }}
              >
                Heads
              </ToggleOption>
              <ToggleOption
                $active={choice === false}
                onClick={(e) => {
                  e.stopPropagation();
                  if (txState === 'idle' || txState === 'error') setChoice(false);
                }}
              >
                Tails
              </ToggleOption>
            </ToggleSwitch>
          </ChoiceSelector>

          <InputGroup $compactBottom>
          <Label>
            <LabelIcon src={monadImage} alt="MON" />
            Bet Amount (MON)
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'normal', marginLeft: '0.5rem' }}>
              (Min: {MIN_BET_MON} / Max: {getMaxBet().toLocaleString()} MON)
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--accent-red)', fontWeight: '600', marginLeft: '0.75rem' }}>
              *2.5% house edge
            </span>
          </Label>
          <InputRow>
            <InputWrapper>
              <Input
                type="number"
                placeholder="25"
                value={betAmount}
                onChange={(e) => handleBetAmountChange(e.target.value)}
                min="0"
                max={getMaxBet()}
                step="0.01"
                disabled={txState !== 'idle' && txState !== 'error'}
                $shake={inputShake}
                style={isBetExceedsMax() ? { borderColor: 'var(--accent-red)', boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.1)' } : {}}
              />
            </InputWrapper>
            {/* LMON support disabled - uncomment to re-enable */}
            {/* <TokenSelector
              onClick={() => {
                setTokenType(tokenType === 'MON' ? 'LMON' : 'MON');
              }}
            >
              <TokenSlider $isMON={tokenType === 'MON'} />
              <TokenOption
                $active={tokenType === 'MON'}
                onClick={(e) => {
                  e.stopPropagation();
                  setTokenType('MON');
                }}
              >
                <TokenIcon src={monadImage} alt="MON" />
                MON
              </TokenOption>
              <TokenOption
                $active={tokenType === 'LMON'}
                onClick={(e) => {
                  e.stopPropagation();
                  setTokenType('LMON');
                }}
              >
                <TokenIcon src={lmonImage} alt="LMON" />
                LMON
              </TokenOption>
            </TokenSelector> */}
          </InputRow>
          {monBalance && (
            <BalanceDisplay>
              Balance: <span><BalanceIcon src={monadImage} alt="MON" />{parseFloat(monBalance).toFixed(4)} MON</span>
            </BalanceDisplay>
          )}
          {/* LMON balance disabled - uncomment to re-enable */}
          {/* {tokenType === 'LMON' && lmonBalance && (
            <BalanceDisplay>
              Balance: <span><BalanceIcon src={lmonImage} alt="LMON" />{parseFloat(lmonBalance).toFixed(4)} LMON</span>
            </BalanceDisplay>
          )} */}
        </InputGroup>
        </>
      )}

      {/* Show result message when result exists */}
      {flipResult && !flipResult.timeout && (
        <InputGroup>
          <StatusText style={{ fontSize: '2rem', fontWeight: '800', color: flipResult.winner ? 'var(--accent-green)' : 'var(--accent-red)', marginBottom: '0.5rem', textShadow: flipResult.winner ? '0 4px 12px rgba(16, 185, 129, 0.3)' : '0 4px 12px rgba(239, 68, 68, 0.3)' }}>
            {flipResult.winner ? 'YOU WON!' : 'YOU LOST'}
          </StatusText>
          <StatusText style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--accent-primary)' }}>
            {flipResult.winner ? `+${calculatePayout()} ${tokenType}` : `-${resultBetAmount || betAmount} ${tokenType}`}
          </StatusText>
        </InputGroup>
      )}

      {/* Show betting info during flip */}
      {!flipResult && (txState === 'pending' || txState === 'confirming' || txState === 'waiting-result') && (
        <InputGroup>
          <StatusText style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--accent-primary)', marginBottom: '1rem' }}>
            Betting {betAmount} {tokenType} on {choice ? 'Heads' : 'Tails'}
          </StatusText>
        </InputGroup>
      )}

      <ButtonWrapper>
        {(!flipResult || flipResult.timeout) && (
          <FlipButton
            onClick={onFlip}
            disabled={isFlipDisabled()}
            $txState={txState}
          >
            {getButtonText()}
          </FlipButton>
        )}
      </ButtonWrapper>

      {entropyFee && txState === 'idle' && !flipResult && (
        <EntropyFeeDisplay entropyFee={entropyFee} />
      )}

      {getStatusText() && (
        <StatusText>{getStatusText()}</StatusText>
      )}
    </Container>
  );
};

export default CoinFlipInterface;
