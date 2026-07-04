import styled, { keyframes, css } from 'styled-components';

// ═══════════════════════════════════════════════════════════════
// ANIMATIONS
// ═══════════════════════════════════════════════════════════════

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
  50% { opacity: 0.7; transform: scale(0.98); }
`;

// ═══════════════════════════════════════════════════════════════
// MAIN LAYOUT - Two Columns
// ═══════════════════════════════════════════════════════════════

export const Container = styled.div`
  display: flex;
  gap: 3rem;
  animation: ${fadeIn} 0.6s ease-out;
  width: 100%;
  max-width: 1150px;
  margin: 0 auto;
  justify-content: center;
  opacity: ${props => props.$initializing ? 0 : 1};
  transition: opacity 0.2s ease;

  @media (max-width: 900px) {
    flex-direction: column;
    gap: 1.5rem;
  }
`;

// ═══════════════════════════════════════════════════════════════
// LEFT PANEL - Controls
// ═══════════════════════════════════════════════════════════════

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
  background: var(--input-bg);
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
    opacity: 0.7;
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

export const GridSelector = styled.div`
  display: flex;
  gap: 8px;
`;

export const GridOption = styled.button`
  flex: 1;
  padding: 0.625rem;
  border: 2px solid ${props => props.$selected ? 'var(--accent-primary)' : 'var(--border-light)'};
  border-radius: 10px;
  background: ${props => props.$selected ? 'var(--accent-primary)' : 'var(--bg-card)'};
  color: ${props => props.$selected ? 'white' : 'var(--text-primary)'};
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    border-color: var(--accent-primary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const MinesLabel = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
`;

export const MinesTitle = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
`;

export const MinesValue = styled.span`
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent-primary);
`;

export const Slider = styled.input`
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(to right, var(--accent-primary) ${props => props.$percent}%, var(--border-light) ${props => props.$percent}%);
  outline: none;
  -webkit-appearance: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent-primary);
    cursor: pointer;
    box-shadow: 0 2px 6px var(--shadow-color);
    transition: transform 0.15s;
  }

  &::-webkit-slider-thumb:hover {
    transform: scale(1.1);
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
    if (props.disabled) return 'var(--border-light)';
    if (props.$cashout) return 'linear-gradient(135deg, var(--accent-green) 0%, #16a34a 100%)';
    return 'linear-gradient(135deg, var(--accent-primary) 0%, #5b21b6 100%)';
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

  /* Hide cashout button on mobile - will show MobileCashoutButton instead */
  @media (max-width: 900px) {
    ${props => props.$cashout && css`
      display: none;
    `}
  }
`;

export const MobileCashoutButton = styled.button`
  display: none;
  width: 100%;
  padding: 1rem;
  background: ${props => props.disabled ? 'var(--border-light)' : 'linear-gradient(135deg, var(--accent-green) 0%, #16a34a 100%)'};
  border: none;
  border-radius: 12px;
  color: ${props => props.disabled ? 'var(--text-tertiary)' : 'var(--text-light)'};
  font-weight: 700;
  font-size: 0.95rem;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 0.75rem;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px var(--shadow-color);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  @media (max-width: 900px) {
    display: block;
  }
`;

export const FeeText = styled.div`
  text-align: center;
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 0.5rem;
`;

// ═══════════════════════════════════════════════════════════════
// RIGHT PANEL - Grid
// ═══════════════════════════════════════════════════════════════

export const RightPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

export const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(${props => props.$size}, 1fr);
  gap: 18px;
  padding: 40px;
  background: var(--game-grid-bg, linear-gradient(135deg, #1a1a2e 0%, #16162a 100%));
  border-radius: 24px;
  border: 2px solid var(--border-color);
  aspect-ratio: 1;
  width: 100%;
  min-width: 650px;
  max-width: 780px;

  @media (max-width: 1300px) {
    min-width: 580px;
    max-width: 680px;
  }

  @media (max-width: 1100px) {
    min-width: 500px;
    max-width: 580px;
  }

  @media (max-width: 900px) {
    min-width: unset;
    max-width: 100%;
  }

  @media (max-width: 600px) {
    gap: 8px;
    padding: 16px;
  }
`;

export const Tile = styled.button`
  aspect-ratio: 1;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-light);

  ${props => props.$state === 'hidden' && !props.$pending && css`
    background: linear-gradient(135deg, #3d3d5c 0%, #2d2d4a 100%);
    border: 2px solid var(--border-color);

    &:hover {
      background: linear-gradient(135deg, #4d4d6c 0%, #3d3d5a 100%);
      transform: scale(1.03);
      border-color: var(--accent-primary);
    }

    &:active {
      transform: scale(0.97);
    }
  `}

  ${props => props.$pending && css`
    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%) !important;
    border: 2px solid #fb923c !important;
    animation: ${pulse} 0.8s ease-in-out infinite;
    cursor: wait;

    &:hover {
      transform: none;
    }
  `}

  ${props => props.$state === 'safe' && css`
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    border: 2px solid #4ade80;
    animation: ${popIn} 0.2s ease-out;
    font-size: 13px;
    cursor: default;
  `}

  ${props => props.$state === 'mine' && css`
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    border: 2px solid #f87171;
    animation: ${shake} 0.4s ease-in-out;
    cursor: default;
  `}

  ${props => props.$state === 'mine_revealed' && css`
    background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%);
    border: 2px solid #facc15;
    opacity: 0.8;
    cursor: default;
  `}

  @media (max-width: 600px) {
    font-size: 11px;
    border-radius: 8px;
  }
`;

export const SeedDisplay = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
  margin-bottom: -10px;
  padding: 5px 12px;
  background: var(--table-header-bg);
  border-radius: 8px;
  font-size: 11px;
`;

export const SeedLabel = styled.span`
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

export const SeedValue = styled.span`
  font-family: monospace;
  color: var(--accent-primary);
  font-weight: 600;
`;

// ═══════════════════════════════════════════════════════════════
// BOTTOM STATS BAR
// ═══════════════════════════════════════════════════════════════

export const StatsBar = styled.div`
  display: flex;
  justify-content: space-around;
  padding: 1rem 1.75rem;
  background: var(--bg-card);
  border: 2px solid var(--border-light);
  border-radius: 12px;
  margin-top: 0.5rem;
  width: 100%;
  max-width: 780px;

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

// ═══════════════════════════════════════════════════════════════
// RESULT OVERLAY
// ═══════════════════════════════════════════════════════════════

export const ResultOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: var(--overlay-bg-heavy);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  animation: ${fadeIn} 0.3s ease-out;
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
  margin-bottom: 1.5rem;
`;

export const PlayAgainButton = styled.button`
  padding: 0.875rem 2.5rem;
  background: linear-gradient(135deg, var(--accent-primary) 0%, #5b21b6 100%);
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

// ═══════════════════════════════════════════════════════════════
// INFO TOOLTIP
// ═══════════════════════════════════════════════════════════════

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
`;

export const VerifyButton = styled.button`
  position: absolute;
  top: 0.75rem;
  right: 2.75rem;
  height: 28px;
  padding: 0 12px;
  border-radius: 14px;
  background: var(--bg-glass);
  border: 2px solid var(--border-light);
  color: var(--accent-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.2s;
  z-index: 10;
  font-family: 'Lexend', system-ui, sans-serif;

  &:hover {
    background: var(--bg-card);
    border-color: var(--accent-primary);
    transform: scale(1.05);
  }

  svg {
    width: 14px;
    height: 14px;
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

// ═══════════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════════

export const LeaderboardWrapper = styled.div`
  position: absolute;
  top: 0.75rem;
  right: 3rem;
  z-index: 10;
`;

export const LeaderboardButton = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${props => props.$active ? 'var(--border-light)' : 'var(--bg-glass)'};
  border: 2px solid ${props => props.$active ? 'var(--accent-primary)' : 'var(--border-light)'};
  color: var(--accent-primary);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

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

export const GameArea = styled.div`
  position: relative;
`;
