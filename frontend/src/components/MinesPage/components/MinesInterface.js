import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getStats } from '../utils/minesApi';
import { GRID_OPTIONS } from '../utils/constants';
import monadImage from '../../../assets/images/monad.png';
import EntropyFeeDisplay from '../../common/EntropyFeeDisplay';
import { useMinigameStatsContractBalance } from '../../../hooks/useMinigameStatsContractBalance';
import {
  Container,
  LeftPanel,
  ControlSection,
  InputLabel,
  LabelIcon,
  LabelHint,
  HouseEdge,
  Input,
  BalanceRow,
  BalanceValue,
  BalanceIcon,
  SectionTitle,
  GridSelector,
  GridOption,
  MinesLabel,
  MinesTitle,
  MinesValue,
  Slider,
  ActionButton,
  MobileCashoutButton,
  RightPanel,
  GridContainer,
  Tile,
  SeedDisplay,
  SeedLabel,
  SeedValue,
  StatsBar,
  StatItem,
  StatLabel,
  StatValue,
  ResultOverlay,
  ResultText,
  ResultAmount,
  PlayAgainButton,
  InfoButton,
  Tooltip,
  TooltipTitle,
  TooltipRow,
  TooltipLabel,
  TooltipValue
} from '../styles/MinesInterface.styles';

const MinesInterface = ({
  betAmount,
  setBetAmount,
  gridSize,
  setGridSize,
  mineCount,
  setMineCount,
  activeGridSize,
  activeMineCount,
  currentGame,
  onStartGame,
  onCashOut,
  onTileClick,
  onCloseResult,
  txState,
  isGameActive,
  isWaitingVRF,
  canReveal,
  currentMultiplier,
  revealedTiles,
  minePositions,
  multipliers,
  minBet,
  maxBet,
  entropyFee,
  monBalance,
  gameResult,
  isConnected = true,
  finalSeed,
  hasSession,
  onCreateSession,
  isInitializing = false
}) => {
  const { formattedMon: statsContractBalanceMon } = useMinigameStatsContractBalance();
  const [showTooltip, setShowTooltip] = useState(false);
  const [stats, setStats] = useState(null);
  const [inputShake, setInputShake] = useState(false);
  const [pendingTiles, setPendingTiles] = useState(new Map()); // Map<tileIndex, {timestamp, retries}>
  const tooltipRef = useRef(null);
  const buttonRef = useRef(null);
  const gridRef = useRef(null);

  const maxMines = gridSize - 1;
  const sliderPercent = ((mineCount - 1) / (maxMines - 1)) * 100;
  const gridSizeNum = Math.sqrt(activeGridSize);

  const isLoading = txState === 'starting' || txState === 'confirming' || txState === 'cashing_out';
  const isInGame = currentGame || isWaitingVRF;
  const hasPendingTiles = pendingTiles.size > 0;
  const canCashOutNow = isGameActive && revealedTiles.size > 0 && !isLoading && txState !== 'revealing' && hasSession && !hasPendingTiles;
  const needsSession = isGameActive && !hasSession;

  // Handle tile click
  const handleTileClick = useCallback(async (index) => {
    if (!currentGame || gameResult) return;
    if (revealedTiles.has(index)) return;
    if (pendingTiles.has(index)) return;

    // Need session to reveal
    if (!hasSession) {
      toast.error('Please sign in first to play');
      return;
    }

    if (!canReveal) return;

    setPendingTiles(prev => new Map(prev).set(index, { timestamp: Date.now(), retries: 0 }));
    onTileClick(index);
  }, [currentGame, revealedTiles, gameResult, pendingTiles, onTileClick, canReveal, hasSession]);

  // Auto-retry pending tiles after 10 seconds (max 2 retries)
  const pendingTilesRef = useRef(pendingTiles);
  pendingTilesRef.current = pendingTiles;

  useEffect(() => {
    if (!currentGame || gameResult) return;

    const interval = setInterval(() => {
      const pending = pendingTilesRef.current;
      if (pending.size === 0) return;

      const now = Date.now();
      const updates = [];

      for (const [index, info] of pending.entries()) {
        // Skip if already revealed
        if (revealedTiles.has(index)) {
          updates.push({ index, action: 'delete' });
          continue;
        }

        // Check if 10 seconds passed (increased from 4)
        if (now - info.timestamp > 10000) {
          if (info.retries < 2) { // max 2 retries (reduced from 3)
            updates.push({ index, action: 'retry', retries: info.retries + 1 });
            onTileClick(index); // Re-send request
          } else {
            updates.push({ index, action: 'delete' });
          }
        }
      }

      if (updates.length > 0) {
        setPendingTiles(prev => {
          const next = new Map(prev);
          for (const u of updates) {
            if (u.action === 'delete') {
              next.delete(u.index);
            } else if (u.action === 'retry') {
              next.set(u.index, { timestamp: now, retries: u.retries });
            }
          }
          return next;
        });
      }
    }, 2000); // Check every 2 seconds (reduced frequency)

    return () => clearInterval(interval);
  }, [currentGame, gameResult, revealedTiles, onTileClick]);

  // Fetch stats
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
        const data = await getStats();
        if (data.success) setStats(data.stats);
      } catch (err) {}
    };
    
    fetchStats();
    const interval = setInterval(fetchStats, 15000); // Optimized: 15s instead of 10s
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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

  // Clear pending tiles when revealed
  useEffect(() => {
    setPendingTiles(prev => {
      const next = new Map(prev);
      revealedTiles.forEach(tile => next.delete(tile));
      return next;
    });
  }, [revealedTiles]);

  // Clear pending when game ends
  useEffect(() => {
    if (gameResult) setPendingTiles(new Map());
  }, [gameResult]);

  // Clear pending when game ID changes
  const prevGameIdRef = useRef(currentGame?.game_id);
  useEffect(() => {
    if (currentGame?.game_id !== prevGameIdRef.current) {
      setPendingTiles(new Map());
      prevGameIdRef.current = currentGame?.game_id;
    }
  }, [currentGame?.game_id]);

  // Auto scroll to grid when game starts or page loads with active game (mobile UX)
  const prevIsWaitingVRFRef = useRef(false);
  const hasScrolledOnMount = useRef(false);

  const scrollToGrid = useCallback((instant = false) => {
    if (gridRef.current) {
      const elementTop = gridRef.current.getBoundingClientRect().top + window.scrollY;
      const offset = 80;
      window.scrollTo({ top: elementTop - offset, behavior: instant ? 'instant' : 'smooth' });
    }
  }, []);

  // Scroll when game starts (waiting_vrf)
  useEffect(() => {
    if (isWaitingVRF && !prevIsWaitingVRFRef.current) {
      setTimeout(() => scrollToGrid(false), 100);
    }
    prevIsWaitingVRFRef.current = isWaitingVRF;
  }, [isWaitingVRF, scrollToGrid]);

  // Scroll on page load if there's an active game (instant, no animation)
  useEffect(() => {
    if (!hasScrolledOnMount.current && !isInitializing && (isGameActive || isWaitingVRF) && currentGame) {
      hasScrolledOnMount.current = true;
      // Use instant scroll on page load to avoid visible jump
      setTimeout(() => scrollToGrid(true), 50);
    }
  }, [isGameActive, isWaitingVRF, currentGame, isInitializing, scrollToGrid]);

  const handleBetAmountChange = (value) => {
    if (value.includes(',')) return;
    const numValue = parseFloat(value);
    if (value === '' || value === '.') {
      setBetAmount(value);
      return;
    }
    if (isNaN(numValue) || numValue < 0) return;
    const maxBetNum = parseFloat(maxBet || '1000');
    if (numValue > maxBetNum) {
      setInputShake(true);
      setTimeout(() => setInputShake(false), 500);
      setBetAmount(maxBetNum.toString());
      return;
    }
    setBetAmount(value);
  };

  const getTileState = (index) => {
    if (gameResult && minePositions.includes(index) && !revealedTiles.has(index)) return 'mine_revealed';
    if (gameResult && !gameResult.won && gameResult.mineHitTile === index) return 'mine';
    if (revealedTiles.has(index)) return 'safe';
    return 'hidden';
  };

  const getTileMultiplier = (index) => {
    const revealedArray = Array.from(revealedTiles);
    const tilePosition = revealedArray.indexOf(index);
    if (tilePosition >= 0 && multipliers[tilePosition]) {
      return multipliers[tilePosition].toFixed(2);
    }
    return null;
  };

  const getExpectedPayout = () => {
    const activeBet = currentGame?.bet_amount
      ? parseFloat(currentGame.bet_amount) / 1e18
      : parseFloat(betAmount);
    if (!activeBet || activeBet <= 0) return '0.0000';
    return (activeBet * currentMultiplier).toFixed(4);
  };

  const getNextMultiplier = () => {
    return multipliers[revealedTiles.size] || currentMultiplier;
  };

  const getMaxPayout = () => {
    const activeBet = currentGame?.bet_amount
      ? parseFloat(currentGame.bet_amount) / 1e18
      : parseFloat(betAmount);
    if (!activeBet || activeBet <= 0 || !multipliers.length) return '0.00';
    const maxMultiplier = multipliers[multipliers.length - 1] || 1;
    return (activeBet * maxMultiplier).toFixed(2);
  };

  const getButtonText = () => {
    if (!isConnected) return 'Connect Wallet';
    if (isInitializing) return 'Loading...';
    if (txState === 'starting') return 'Starting...';
    if (txState === 'confirming') return 'Confirming...';
    if (isWaitingVRF) return 'Waiting for VRF...';
    if (!betAmount || parseFloat(betAmount) <= 0) return 'Enter Bet Amount';
    return 'Start Game';
  };

  const getCashoutButtonText = () => {
    if (!hasSession) return 'Sign In to Play';
    if (txState === 'cashing_out') return 'Cashing Out...';
    if (txState === 'revealing' || hasPendingTiles) return 'Revealing...';
    if (isWaitingVRF) return 'Waiting for VRF...';
    if (revealedTiles.size === 0) return 'Reveal a tile first';
    return `Cash Out ${getExpectedPayout()} MON`;
  };

  const isStartDisabled = () => {
    if (!isConnected) return true;
    if (isInitializing) return true;
    if (isLoading || isGameActive || isWaitingVRF) return true;
    if (!betAmount || parseFloat(betAmount) <= 0) return true;
    const minBetNum = parseFloat(minBet || '10');
    if (parseFloat(betAmount) < minBetNum) return true;
    return false;
  };

  return (
    <>
      <Container $initializing={isInitializing}>
        {/* LEFT PANEL - Controls */}
        <LeftPanel>
          {/* Bet Amount */}
          <ControlSection>
            <InputLabel>
              <LabelIcon src={monadImage} alt="MON" />
              Bet Amount (MON)
              <LabelHint>
                <div>Min: {minBet}</div>
                <div>Max: {maxBet}</div>
              </LabelHint>
            </InputLabel>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
              <HouseEdge>*2.5% house edge</HouseEdge>
            </div>
            <Input
              type="number"
              placeholder={minBet}
              value={isInGame ? (currentGame?.bet_amount ? (parseFloat(currentGame.bet_amount) / 1e18).toFixed(4) : betAmount) : betAmount}
              onChange={(e) => handleBetAmountChange(e.target.value)}
              min="0"
              step="1"
              $shake={inputShake}
              disabled={isInGame || isLoading}
            />
            {monBalance && (
              <BalanceRow>
                Balance:
                <BalanceValue>
                  <BalanceIcon src={monadImage} alt="MON" />
                  {parseFloat(monBalance).toFixed(4)} MON
                </BalanceValue>
              </BalanceRow>
            )}
          </ControlSection>

          {/* Grid Size */}
          <ControlSection>
            <SectionTitle>Grid Size</SectionTitle>
            <GridSelector>
              {GRID_OPTIONS.map(option => (
                <GridOption
                  key={option.value}
                  $selected={gridSize === option.value}
                  $disabled={option.disabled}
                  onClick={() => {
                    if (option.disabled) return;
                    setGridSize(option.value);
                    if (mineCount >= option.value) {
                      setMineCount(option.value - 1);
                    }
                  }}
                  disabled={isInGame || isLoading || option.disabled}
                >
                  {option.label}
                </GridOption>
              ))}
            </GridSelector>
          </ControlSection>

          {/* Mines */}
          <ControlSection>
            <MinesLabel>
              <MinesTitle>Mines</MinesTitle>
              <MinesValue>{mineCount}</MinesValue>
            </MinesLabel>
            <Slider
              type="range"
              min={1}
              max={maxMines}
              value={mineCount}
              onChange={(e) => setMineCount(parseInt(e.target.value))}
              $percent={sliderPercent}
              disabled={isInGame || isLoading}
            />
          </ControlSection>

          {/* Action Button */}
          {isInGame && !gameResult ? (
            needsSession ? (
              <ActionButton
                onClick={onCreateSession}
                disabled={isLoading}
              >
                Sign In to Play
              </ActionButton>
            ) : (
              <ActionButton
                $cashout
                onClick={onCashOut}
                disabled={!canCashOutNow}
              >
                {getCashoutButtonText()}
              </ActionButton>
            )
          ) : (
            <>
              <ActionButton
                onClick={onStartGame}
                disabled={isStartDisabled()}
              >
                {getButtonText()}
              </ActionButton>
              {entropyFee && !isStartDisabled() && (
                <EntropyFeeDisplay entropyFee={entropyFee} />
              )}
            </>
          )}
        </LeftPanel>

        {/* RIGHT PANEL - Grid */}
        <RightPanel ref={gridRef}>
          <div style={{ position: 'relative' }}>
            <InfoButton ref={buttonRef} onClick={() => setShowTooltip(!showTooltip)}>i</InfoButton>
            <Tooltip ref={tooltipRef} $show={showTooltip}>
              <TooltipTitle>Statistics</TooltipTitle>
              <TooltipRow>
                <TooltipLabel>Contract Balance</TooltipLabel>
                <TooltipValue>{statsContractBalanceMon ?? '0.00'} MON</TooltipValue>
              </TooltipRow>
              <TooltipRow>
                <TooltipLabel>Total Volume</TooltipLabel>
                <TooltipValue>{stats?.volume ? (parseFloat(stats.volume) / 1e18).toFixed(2) : '0'} MON</TooltipValue>
              </TooltipRow>
              <TooltipRow>
                <TooltipLabel>Total Games</TooltipLabel>
                <TooltipValue>{stats?.total_games || 0}</TooltipValue>
              </TooltipRow>
              <TooltipRow style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
                <TooltipLabel>Rules</TooltipLabel>
                <TooltipValue style={{ fontSize: '0.85rem', fontWeight: '500', lineHeight: '1.5' }}>
                  Reveal tiles on the grid without hitting a mine. Each safe tile increases your multiplier. Cash out anytime to secure your winnings, or keep revealing for higher rewards.
                </TooltipValue>
              </TooltipRow>
            </Tooltip>

            <GridContainer $size={gridSizeNum}>
              {Array.from({ length: activeGridSize }, (_, index) => {
                const state = getTileState(index);
                const isPending = pendingTiles.has(index);
                const multiplierValue = state === 'safe' ? getTileMultiplier(index) : null;

                return (
                  <Tile
                    key={index}
                    $state={state}
                    $pending={isPending}
                    onClick={() => handleTileClick(index)}
                  >
                    {state === 'safe' && multiplierValue && `${multiplierValue}x`}
                    {(state === 'mine' || state === 'mine_revealed') && '💣'}
                  </Tile>
                );
              })}
            </GridContainer>

            {/* Result Overlay */}
            {gameResult && (
              <ResultOverlay>
                <ResultText $won={gameResult.won}>
                  {gameResult.won ? 'YOU WON!' : 'MINE HIT!'}
                </ResultText>
                <ResultAmount>
                  {gameResult.won ? `+${gameResult.payout} MON` : `-${betAmount} MON`}
                </ResultAmount>
                <PlayAgainButton onClick={onCloseResult}>
                  Play Again
                </PlayAgainButton>
              </ResultOverlay>
            )}
          </div>

          {/* Final Seed Display - only shown after game completion for verification */}
          {finalSeed && gameResult && (
            <SeedDisplay>
              <SeedLabel>Verification Seed:</SeedLabel>
              <SeedValue>{finalSeed.slice(0, 10)}...{finalSeed.slice(-8)}</SeedValue>
            </SeedDisplay>
          )}

          {/* Bottom Stats Bar - under the grid */}
          <StatsBar>
            <StatItem>
              <StatLabel>Multiplier</StatLabel>
              <StatValue $color="#6930c3">{currentMultiplier.toFixed(2)}x</StatValue>
            </StatItem>
            <StatItem>
              <StatLabel>Tiles Revealed</StatLabel>
              <StatValue $color="#22c55e">{revealedTiles.size}</StatValue>
            </StatItem>
            <StatItem>
              <StatLabel>Next Multiplier</StatLabel>
              <StatValue $color="#6930c3">{getNextMultiplier().toFixed(2)}x</StatValue>
            </StatItem>
            <StatItem>
              <StatLabel>Payout</StatLabel>
              <StatValue $color="#22c55e">{getExpectedPayout()} MON</StatValue>
            </StatItem>
            <StatItem>
              <StatLabel>Max Payout</StatLabel>
              <StatValue $color="#f59e0b">{getMaxPayout()} MON</StatValue>
            </StatItem>
          </StatsBar>

          {/* Mobile Cashout Button - shown below grid on mobile */}
          {isInGame && !gameResult && (
            needsSession ? (
              <MobileCashoutButton
                onClick={onCreateSession}
                disabled={isLoading}
              >
                Sign In to Play
              </MobileCashoutButton>
            ) : (
              <MobileCashoutButton
                onClick={onCashOut}
                disabled={!canCashOutNow}
              >
                {getCashoutButtonText()}
              </MobileCashoutButton>
            )
          )}
        </RightPanel>
      </Container>
    </>
  );
};

export default MinesInterface;
