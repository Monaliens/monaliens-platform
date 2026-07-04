import styled, { keyframes, css } from 'styled-components';

// Animations
export const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

export const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
  20%, 40%, 60%, 80% { transform: translateX(8px); }
`;

export const popIn = keyframes`
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
`;

export const pulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.95); }
`;

export const glow = keyframes`
  0%, 100% { box-shadow: 0 0 5px rgba(105, 48, 195, 0.5); }
  50% { box-shadow: 0 0 20px rgba(105, 48, 195, 0.8), 0 0 30px rgba(105, 48, 195, 0.4); }
`;

export const drawReveal = keyframes`
  0% { transform: scale(1.5); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
`;

// Main Layout
export const Container = styled.div`
  display: flex;
  gap: 3rem;
  animation: ${fadeIn} 0.6s ease-out;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  justify-content: center;

  @media (max-width: 1200px) {
    gap: 2rem;
  }

  @media (max-width: 900px) {
    flex-direction: column;
    gap: 1.5rem;
  }
`;

// Left Panel - Controls
export const LeftPanel = styled.div`
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  @media (max-width: 900px) {
    width: 100%;
    max-width: 400px;
    margin: 0 auto;
  }
`;

export const ControlSection = styled.div`
  background: var(--bg-card);
  border: 2px solid var(--border-light);
  border-radius: 16px;
  padding: 1.25rem;
`;

export const InputLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
`;

export const LabelIcon = styled.img`
  width: 18px;
  height: 18px;
  border-radius: 50%;
`;

export const LabelHint = styled.div`
  font-size: 0.7rem;
  color: var(--text-secondary);
  font-weight: 500;
  margin-left: auto;
  text-align: right;
  line-height: 1.4;
`;

export const HouseEdge = styled.span`
  font-size: 0.75rem;
  color: var(--accent-red);
  font-weight: 600;
`;

export const Input = styled.input`
  width: 100%;
  padding: 0.875rem 1rem;
  border: 2px solid var(--input-border);
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  background: ${props => props.disabled ? 'var(--bg-secondary)' : 'var(--input-bg)'};
  transition: all 0.2s ease;
  animation: ${props => props.$shake ? shake : 'none'} 0.5s ease;

  &:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px var(--shadow-color);
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
    cursor: not-allowed;
    color: var(--text-secondary);
  }
`;

export const BalanceRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
`;

export const BalanceValue = styled.span`
  color: var(--accent-primary);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

export const BalanceIcon = styled.img`
  width: 14px;
  height: 14px;
  border-radius: 50%;
`;

export const SectionTitle = styled.div`
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
`;

export const PicksLabel = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
`;

export const PicksTitle = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
`;

export const PicksValue = styled.span`
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent-primary);
`;

export const QuickPickButtons = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
`;

export const QuickPickButton = styled.button`
  padding: 0.4rem 0.7rem;
  border: 2px solid var(--border-light);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-weight: 600;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
  white-space: nowrap;

  &:hover:not(:disabled) {
    border-color: var(--accent-primary);
    background: var(--table-header-bg);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const ClearButton = styled(QuickPickButton)`
  background: var(--accent-red);
  color: var(--text-light);
  border-color: var(--accent-red);

  &:hover:not(:disabled) {
    background: var(--accent-red);
    border-color: var(--accent-red);
    opacity: 0.9;
  }
`;

// Risk Level Selector
export const RiskSelector = styled.div`
  display: flex;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid var(--border-light);
  background: var(--bg-card);
`;

export const RiskOption = styled.button`
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: none;
  background: ${props => props.$active ? 'linear-gradient(135deg, #6930c3 0%, #5b21b6 100%)' : 'transparent'};
  color: ${props => props.$active ? 'white' : 'var(--text-primary)'};
  font-weight: 600;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: capitalize;

  &:hover:not(:disabled) {
    background: ${props => props.$active ? 'linear-gradient(135deg, #6930c3 0%, #5b21b6 100%)' : 'var(--table-header-bg)'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// New Action Buttons (Auto Pick / Clear Table)
export const ActionButtonsRow = styled.div`
  display: flex;
  gap: 8px;
`;

export const AutoPickButton = styled.button`
  flex: 1;
  padding: 0.6rem 1rem;
  border: 2px solid var(--border-light);
  border-radius: 8px;
  background: linear-gradient(135deg, #3d3d5c 0%, #2d2d4a 100%);
  color: var(--text-light);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #4d4d6c 0%, #3d3d5a 100%);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const ClearTableButton = styled.button`
  flex: 1;
  padding: 0.6rem 1rem;
  border: 2px solid var(--border-light);
  border-radius: 8px;
  background: linear-gradient(135deg, #3d3d5c 0%, #2d2d4a 100%);
  color: var(--text-light);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #4d4d6c 0%, #3d3d5a 100%);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const ActionButton = styled.button`
  width: 100%;
  padding: 1rem;
  background: ${props => {
    if (props.disabled) return 'var(--bg-secondary)';
    return 'linear-gradient(135deg, #6930c3 0%, #5b21b6 100%)';
  }};
  border: none;
  border-radius: 12px;
  color: ${props => props.disabled ? 'var(--text-tertiary)' : 'var(--text-light)'};
  font-weight: 700;
  font-size: 0.95rem;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px var(--shadow-color);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
`;

export const FeeText = styled.div`
  text-align: center;
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 0.5rem;
`;

// Right Panel - Grid
export const RightPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: visible;
`;

export const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 90px);
  gap: 14px;
  padding: 45px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16162a 100%);
  border-radius: 24px;
  border: 2px solid var(--border-color);
  justify-content: center;
  width: fit-content;
  margin: 0 auto;

  @media (max-width: 900px) {
    grid-template-columns: repeat(8, 1fr);
    gap: 8px;
    padding: 20px;
    width: 100%;
    max-width: 100%;
  }

  @media (max-width: 500px) {
    gap: 5px;
    padding: 12px;
  }
`;

export const NumberTile = styled.button`
  aspect-ratio: 1;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 26px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-light);
  position: relative;
  width: 100%;

  @media (max-width: 900px) {
    font-size: 16px;
    border-radius: 8px;
  }

  @media (max-width: 500px) {
    font-size: 13px;
    border-radius: 6px;
  }

  ${props => props.$state === 'default' && css`
    background: linear-gradient(135deg, #3d3d5c 0%, #2d2d4a 100%);
    border: 2px solid rgba(105, 48, 195, 0.3);

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, #4d4d6c 0%, #3d3d5a 100%);
      transform: scale(1.05);
      border-color: rgba(105, 48, 195, 0.6);
    }

    &:active:not(:disabled) {
      transform: scale(0.95);
    }
  `}

  ${props => props.$state === 'selected' && css`
    background: linear-gradient(135deg, #6930c3 0%, #5b21b6 100%);
    border: 2px solid #8b5cf6;
    animation: ${popIn} 0.2s ease-out;
    box-shadow: 0 0 10px rgba(105, 48, 195, 0.5);

    &:hover:not(:disabled) {
      transform: scale(1.05);
    }
  `}

  ${props => props.$state === 'drawn' && css`
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    border: 2px solid #fbbf24;
    animation: ${drawReveal} 0.5s ease-out;
    cursor: default;
  `}

  ${props => props.$state === 'hit' && css`
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    border: 2px solid #4ade80;
    animation: ${drawReveal} 0.5s ease-out, ${glow} 1s ease-in-out infinite;
    cursor: default;
  `}

  ${props => props.$state === 'miss' && css`
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    border: 2px solid #f87171;
    opacity: 0.6;
    cursor: default;
  `}

  &:disabled {
    cursor: not-allowed;
  }
`;

export const DrawOrder = styled.span`
  position: absolute;
  top: -8px;
  right: -8px;
  background: #f59e0b;
  color: var(--text-light);
  font-size: 10px;
  font-weight: 700;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #1a1a2e;
`;

// Stats Bar
export const StatsBar = styled.div`
  display: flex;
  justify-content: space-around;
  padding: 1rem 1.75rem;
  background: var(--bg-card);
  border: 2px solid var(--border-light);
  border-radius: 12px;
  margin-top: 0.75rem;
  width: 100%;
  max-width: 600px;

  @media (max-width: 600px) {
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.875rem;
  }
`;

export const StatItem = styled.div`
  text-align: center;
  flex: 1;

  @media (max-width: 600px) {
    flex: 0 0 48%;
  }
`;

export const StatLabel = styled.div`
  font-size: 0.65rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.2rem;
`;

export const StatValue = styled.div`
  font-size: 0.95rem;
  font-weight: 700;
  color: ${props => props.$color || 'var(--text-primary)'};
`;

// Result Overlay
export const ResultOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: var(--overlay-bg);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  animation: ${fadeIn} 0.3s ease-out;
  z-index: 100;
`;

export const ResultText = styled.div`
  font-size: 2.5rem;
  font-weight: 800;
  color: ${props => props.$won ? 'var(--accent-green)' : 'var(--accent-red)'};
  margin-bottom: 0.5rem;
`;

export const ResultAmount = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-light);
  margin-bottom: 0.5rem;
`;

export const ResultHits = styled.div`
  font-size: 1rem;
  color: var(--text-tertiary);
  margin-bottom: 1.5rem;
`;

export const PlayAgainButton = styled.button`
  padding: 0.875rem 2.5rem;
  background: linear-gradient(135deg, #6930c3 0%, #5b21b6 100%);
  border: none;
  border-radius: 12px;
  color: var(--text-light);
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.2s;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 15px var(--shadow-color);
  }
`;

// Multiplier Preview
export const MultiplierPreview = styled.div`
  background: var(--table-header-bg);
  border: 2px solid var(--border-light);
  border-radius: 12px;
  padding: 1rem;
  margin-top: 0.5rem;
`;

export const MultiplierTitle = styled.div`
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
  text-align: center;
`;

export const MultiplierGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
`;

export const MultiplierItem = styled.div`
  background: ${props => props.$highlight ? 'linear-gradient(135deg, #6930c3 0%, #5b21b6 100%)' : 'var(--bg-card)'};
  color: ${props => props.$highlight ? 'white' : 'var(--text-primary)'};
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid ${props => props.$highlight ? 'transparent' : 'var(--border-light)'};
`;

// Info Tooltip
export const InfoButton = styled.button`
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bg-glass);
  border: 2px solid var(--border-light);
  color: var(--accent-primary);
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 10;

  &:hover {
    background: var(--bg-card);
    border-color: var(--accent-primary);
    transform: scale(1.1);
  }

  @media (max-width: 900px) {
    top: 8px;
    right: 8px;
    width: 22px;
    height: 22px;
    font-size: 0.7rem;
  }
`;

export const Tooltip = styled.div`
  position: absolute;
  top: 45px;
  right: 0;
  background: var(--bg-card);
  border: 2px solid var(--border-light);
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  box-shadow: 0 8px 25px var(--shadow-color);
  min-width: 240px;
  z-index: 1000;
  opacity: ${props => props.$show ? '1' : '0'};
  visibility: ${props => props.$show ? 'visible' : 'hidden'};
  transform: ${props => props.$show ? 'translateY(0)' : 'translateY(-10px)'};
  transition: all 0.2s ease;
`;

export const TooltipTitle = styled.h3`
  font-size: 0.9rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  color: var(--text-primary);
`;

export const TooltipRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--border-light);
  font-size: 0.85rem;

  &:last-child {
    border-bottom: none;
  }
`;

export const TooltipLabel = styled.span`
  color: var(--text-secondary);
`;

export const TooltipValue = styled.span`
  font-weight: 600;
  color: var(--text-primary);
`;

// Drawing Animation Container
export const DrawingContainer = styled.div`
  position: absolute;
  inset: 0;
  background: var(--overlay-bg);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 50;
`;

export const DrawingText = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-light);
  margin-bottom: 1rem;
`;

export const DrawingNumber = styled.div`
  font-size: 4rem;
  font-weight: 800;
  color: var(--accent-orange);
  animation: ${pulse} 0.5s ease-in-out;
`;

// Payout Bar (Stake style - white transparent theme)
export const PayoutBar = styled.div`
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  align-items: center;
  gap: 6px;
  padding: 0.6rem 1rem;
  background: var(--bg-glass);
  border-radius: 10px;
  border: 2px solid var(--border-light);
  margin-top: 10px;
  overflow: visible;
  position: relative;
  min-height: 72px;

  @media (max-width: 650px) {
    gap: 4px;
    padding: 0.5rem;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    min-height: 68px;
  }
`;

export const PayoutItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 10px;
  background: ${props => {
    if (props.$isHit) return 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
    if (props.$isActive) return 'var(--table-header-bg)';
    return 'var(--bg-secondary)';
  }};
  border-radius: 6px;
  min-width: 50px;
  border: 1px solid ${props => {
    if (props.$isHit) return '#4ade80';
    if (props.$isActive) return 'var(--border-color)';
    return 'var(--border-light)';
  }};
  transition: all 0.2s ease;
  flex-shrink: 0;
  cursor: pointer;
  position: relative;

  &:hover {
    background: ${props => {
      if (props.$isHit) return 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
      return 'var(--table-header-bg)';
    }};
    transform: translateY(-2px);
  }

  @media (max-width: 650px) {
    min-width: 45px;
    padding: 4px 6px;
  }
`;

export const PayoutTooltip = styled.div`
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--text-primary);
  color: var(--text-light);
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 0.8rem;
  white-space: nowrap;
  z-index: 9999;
  opacity: 0;
  visibility: hidden;
  transition: all 0.15s ease;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
  pointer-events: none;

  ${PayoutItem}:hover & {
    opacity: 1;
    visibility: visible;
  }

  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 7px solid transparent;
    border-top-color: var(--text-primary);
  }
`;

export const TooltipRow2 = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;

  &:not(:last-child) {
    margin-bottom: 4px;
  }
`;

export const TooltipLabel2 = styled.span`
  color: var(--text-tertiary);
`;

export const TooltipValue2 = styled.span`
  font-weight: 600;
  color: ${props => props.$color || 'white'};
`;

export const PayoutHits = styled.div`
  font-size: 0.6rem;
  color: ${props => props.$isHit ? 'white' : 'var(--text-secondary)'};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.2px;
  white-space: nowrap;
`;

export const PayoutMultiplier = styled.div`
  font-size: 0.8rem;
  font-weight: 700;
  color: ${props => {
    if (props.$isHit) return 'white';
    if (props.$mult > 0) return 'var(--accent-primary)';
    return 'var(--text-tertiary)';
  }};
  margin-top: 2px;

  @media (max-width: 650px) {
    font-size: 0.7rem;
  }
`;

export const PayoutAmount = styled.div`
  font-size: 0.55rem;
  color: ${props => props.$isHit ? 'rgba(255,255,255,0.9)' : 'var(--accent-green)'};
  font-weight: 600;
  margin-top: 2px;
  white-space: nowrap;

  @media (max-width: 600px) {
    font-size: 0.55rem;
  }
`;

export const PayoutPlaceholder = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0.5rem 0;
  color: var(--text-tertiary);
  font-size: 0.85rem;
  font-weight: 500;
`;
