import React, { useState, useRef, useEffect } from 'react';
import { KENO_API_URL, RISK_LEVELS, DEFAULT_RISK } from '../utils/constants';
import monadImage from '../../../assets/images/monad.png';
import KenoGrid from './KenoGrid';
import EntropyFeeDisplay from '../../common/EntropyFeeDisplay';
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
  PicksLabel,
  PicksTitle,
  PicksValue,
  ActionButton,
  RightPanel,
  ResultOverlay,
  ResultText,
  ResultAmount,
  ResultHits,
  PlayAgainButton,
  InfoButton,
  Tooltip,
  TooltipTitle,
  TooltipRow,
  TooltipLabel,
  DrawingContainer,
  DrawingText,
  DrawingNumber,
  PayoutBar,
  PayoutItem,
  PayoutHits,
  PayoutMultiplier,
  PayoutTooltip,
  PayoutPlaceholder,
  TooltipRow2,
  TooltipLabel2,
  TooltipValue2,
  RiskSelector,
  RiskOption,
  ActionButtonsRow,
  AutoPickButton,
  ClearTableButton
} from '../styles/KenoStyles';


const KenoInterface = ({
  betAmount,
  setBetAmount,
  selectedNumbers,
  drawnNumbers,
  currentDrawIndex,
  onNumberClick,
  onAutoPick,
  onClearSelection,
  onStartGame,
  onCloseResult,
  getNumberState,
  getDrawOrder,
  txState,
  gameResult,
  minBet,
  maxBet,
  entropyFee,
  monBalance,
  contractBalance,
  riskLevel,
  setRiskLevel,
  isConnected = true,
  multipliers,
  multipliersLoading
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [inputShake, setInputShake] = useState(false);
  const [stats, setStats] = useState(null);
  const tooltipRef = useRef(null);
  const buttonRef = useRef(null);

  // Fetch stats with AbortController for cleanup
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    
    const fetchStats = async () => {
      try {
        const response = await fetch(`${KENO_API_URL}/stats`, {
          signal: controller.signal
        });
        if (response.ok && isMounted) {
          const data = await response.json();
          if (data.success && isMounted) {
            setStats(data.stats);
          }
        }
      } catch (err) {
        // Silent - including AbortError
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    
    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  // Format large numbers
  const formatVolume = (value) => {
    if (!value) return '0';
    const num = parseFloat(value) / 1e18;
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  };

  const pickCount = selectedNumbers.size;
  const isLoading = txState === 'starting' || txState === 'confirming';
  const isGameActive = txState === 'waiting_vrf' || txState === 'drawing' || txState === 'completed';
  const isDrawing = txState === 'drawing';

  // Current hits count
  const currentHits = gameResult
    ? gameResult.hits
    : drawnNumbers.filter(n => selectedNumbers.has(n)).length;

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

  const getButtonText = () => {
    if (!isConnected) return 'Connect Wallet';
    if (txState === 'starting') return 'Starting...';
    if (txState === 'confirming') return 'Confirming...';
    if (txState === 'waiting_vrf') return 'Drawing Numbers...';
    if (pickCount === 0) return 'Select Numbers';
    if (!betAmount || parseFloat(betAmount) <= 0) return 'Enter Bet Amount';
    return `Play Keno (${pickCount} picks)`;
  };

  const isStartDisabled = () => {
    if (!isConnected) return true;
    if (isLoading || isGameActive) return true;
    if (pickCount === 0) return true;
    if (!betAmount || parseFloat(betAmount) <= 0) return true;
    const minBetNum = parseFloat(minBet || '0.1');
    if (parseFloat(betAmount) < minBetNum) return true;
    if (!multipliers || multipliersLoading) return true;
    return false;
  };

  // Get payout for specific hit count (using selected risk level and multipliers from backend)
  const getPayoutForHits = (hits) => {
    if (!betAmount || pickCount === 0 || !multipliers) return 0;
    const currentRisk = riskLevel || DEFAULT_RISK;
    const mult = multipliers[currentRisk]?.[pickCount]?.[hits] || 0;
    return (parseFloat(betAmount) * mult * 0.975).toFixed(2);
  };

  // Calculate hit probability using Keno math
  // p(h) = C(k,h) * C(40-k, 10-h) / C(40,10)
  const factorial = (n) => {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  };

  const binomial = (n, k) => {
    if (k > n || k < 0) return 0;
    if (k === 0 || k === n) return 1;
    return factorial(n) / (factorial(k) * factorial(n - k));
  };

  const getHitProbability = (picks, hits) => {
    const numerator = binomial(picks, hits) * binomial(40 - picks, 10 - hits);
    const denominator = binomial(40, 10);
    return numerator / denominator;
  };

  // Generate payout items for current pick count (using selected risk level and multipliers from backend)
  const getPayoutItems = () => {
    if (pickCount === 0 || !multipliers) return [];
    const currentRisk = riskLevel || DEFAULT_RISK;
    const items = [];
    for (let i = 0; i <= pickCount; i++) {
      const mult = multipliers[currentRisk]?.[pickCount]?.[i] || 0;
      const chance = getHitProbability(pickCount, i) * 100;
      items.push({
        hits: i,
        multiplier: mult,
        payout: getPayoutForHits(i),
        chance: chance
      });
    }
    return items;
  };

  return (
    <Container>
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
            value={betAmount}
            onChange={(e) => handleBetAmountChange(e.target.value)}
            min="0"
            step="0.1"
            $shake={inputShake}
            disabled={isGameActive || isLoading}
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

        {/* Risk Level */}
        <ControlSection>
          <PicksLabel>
            <PicksTitle>Risk Level</PicksTitle>
          </PicksLabel>
          <RiskSelector>
            {RISK_LEVELS.map(risk => (
              <RiskOption
                key={risk}
                $active={riskLevel === risk}
                onClick={() => setRiskLevel(risk)}
                disabled={isGameActive || isLoading}
              >
                {risk}
              </RiskOption>
            ))}
          </RiskSelector>
        </ControlSection>

        {/* Number Selection */}
        <ControlSection>
          <PicksLabel>
            <PicksTitle>Selected Numbers</PicksTitle>
            <PicksValue>{pickCount} / 10</PicksValue>
          </PicksLabel>
          <ActionButtonsRow>
            <AutoPickButton
              onClick={() => onAutoPick(10)}
              disabled={isGameActive || isLoading}
            >
              Auto Pick
            </AutoPickButton>
            <ClearTableButton
              onClick={onClearSelection}
              disabled={isGameActive || isLoading || pickCount === 0}
            >
              Clear Table
            </ClearTableButton>
          </ActionButtonsRow>
        </ControlSection>

        {/* Action Button */}
        {!gameResult && (
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
      <RightPanel>
        <div style={{ position: 'relative' }}>
          <InfoButton ref={buttonRef} onClick={() => setShowTooltip(!showTooltip)}>i</InfoButton>
          <Tooltip ref={tooltipRef} $show={showTooltip}>
            <TooltipTitle>Statistics</TooltipTitle>
            <TooltipRow>
              <TooltipLabel>Contract Balance</TooltipLabel>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {contractBalance ? parseFloat(contractBalance).toFixed(2) : '0'}
                <img src={monadImage} alt="MON" style={{ width: 14, height: 14, borderRadius: '50%' }} />
              </span>
            </TooltipRow>
            <TooltipRow>
              <TooltipLabel>Total Volume</TooltipLabel>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {formatVolume(stats?.total_volume)}
                <img src={monadImage} alt="MON" style={{ width: 14, height: 14, borderRadius: '50%' }} />
              </span>
            </TooltipRow>
            <TooltipRow>
              <TooltipLabel>Total Games</TooltipLabel>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{stats?.total_games || 0}</span>
            </TooltipRow>
            <TooltipRow style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
              <TooltipLabel>Rules</TooltipLabel>
              <span style={{ fontSize: '0.85rem', fontWeight: '500', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                Select 1 to 10 numbers from the grid. 10 numbers will be randomly drawn. The more matches you get, the higher your payout. Different risk levels offer different payout structures.
              </span>
            </TooltipRow>
          </Tooltip>

          <KenoGrid
            onNumberClick={onNumberClick}
            getNumberState={getNumberState}
            getDrawOrder={getDrawOrder}
            disabled={isGameActive || isLoading}
          />

          {/* Drawing Animation Overlay */}
          {isDrawing && drawnNumbers.length > 0 && drawnNumbers.length <= 10 && (
            <DrawingContainer>
              <DrawingText>Drawing number {drawnNumbers.length}/10</DrawingText>
              <DrawingNumber>
                {drawnNumbers[drawnNumbers.length - 1]}
              </DrawingNumber>
            </DrawingContainer>
          )}

          {/* Result Overlay */}
          {gameResult && (
            <ResultOverlay>
              <ResultText $won={gameResult.won}>
                {gameResult.won ? 'YOU WON!' : 'NO WIN'}
              </ResultText>
              <ResultAmount>
                {gameResult.won ? `+${gameResult.payout} MON` : `-${betAmount} MON`}
              </ResultAmount>
              <ResultHits>
                {gameResult.hits} out of {pickCount} numbers hit ({gameResult.multiplier}x)
              </ResultHits>
              <PlayAgainButton onClick={onCloseResult}>
                Play Again
              </PlayAgainButton>
            </ResultOverlay>
          )}
        </div>

        {/* Payout Bar - Stake Style with Tooltip */}
        <PayoutBar>
          {pickCount > 0 ? (
            getPayoutItems().map(({ hits, multiplier, payout, chance }) => (
              <PayoutItem
                key={hits}
                $isHit={gameResult && currentHits === hits && multiplier > 0}
                $isActive={!gameResult && currentHits === hits}
              >
                <PayoutTooltip>
                  <TooltipRow2>
                    <TooltipLabel2>Payout:</TooltipLabel2>
                    <TooltipValue2 $color="#22c55e">{payout} MON</TooltipValue2>
                  </TooltipRow2>
                  <TooltipRow2>
                    <TooltipLabel2>Chance:</TooltipLabel2>
                    <TooltipValue2>{chance < 0.01 ? '<0.01' : chance.toFixed(2)}%</TooltipValue2>
                  </TooltipRow2>
                </PayoutTooltip>
                <PayoutHits $isHit={gameResult && currentHits === hits && multiplier > 0}>
                  {hits} hit{hits !== 1 ? 's' : ''}
                </PayoutHits>
                <PayoutMultiplier
                  $mult={multiplier}
                  $isHit={gameResult && currentHits === hits && multiplier > 0}
                >
                  {multiplier > 0 ? `${multiplier}x` : '0x'}
                </PayoutMultiplier>
              </PayoutItem>
            ))
          ) : (
            <PayoutPlaceholder>Select 1-10 tiles to see payouts</PayoutPlaceholder>
          )}
        </PayoutBar>
      </RightPanel>
    </Container>
  );
};

export default KenoInterface;
