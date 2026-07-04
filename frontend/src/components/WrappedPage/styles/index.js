import styled, { keyframes, css } from 'styled-components';

// Colors - Now using CSS variables for dark mode support
const COLORS = {
  bg: {
    primary: 'var(--bg-secondary)',
    secondary: 'var(--bg-card)',
    gradient: 'linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-glass) 50%, var(--bg-secondary) 100%)',
  },
  accent: {
    primary: 'var(--accent-primary)', // Monaliens purple
    secondary: '#8e44ad',
    orange: '#ea580c',
    green: '#16a34a',
    red: '#dc2626',
    yellow: '#eab308',
    pink: '#ec4899',
  },
  text: {
    primary: 'var(--text-primary)',
    secondary: 'var(--text-secondary)',
    muted: 'var(--text-tertiary)',
  }
};

// Animations
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const scaleIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

const countUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

// Full Screen Container - Transparent to show GlobalBackground
export const FullScreenContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: transparent;
  overflow: hidden;
  z-index: 10;
  font-family: var(--font-primary);
`;

// Slide Wrapper
export const SlideWrapper = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 80px; // Leave space for navigation
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 60px 80px;
  opacity: ${props => props.$active ? 1 : 0};
  transform: ${props => props.$active ? 'translateX(0)' : props.$direction === 'next' ? 'translateX(100px)' : 'translateX(-100px)'};
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: ${props => props.$active ? 'auto' : 'none'};
  overflow-y: auto;

  @media (max-width: 768px) {
    padding: 40px 24px;
    bottom: 70px;
  }
`;

// Navigation Footer
export const NavigationFooter = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  background: linear-gradient(to top, var(--bg-glass) 0%, transparent 100%);
  padding: 0 40px;
  z-index: 1001;

  @media (max-width: 768px) {
    height: 70px;
    gap: 16px;
    padding: 0 20px;
  }
`;

export const NavButton = styled.button`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid var(--border-light);
  background: var(--bg-glass);
  color: ${COLORS.accent.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(8px);

  &:hover:not(:disabled) {
    background: var(--bg-card);
    border-color: ${COLORS.accent.primary};
    transform: scale(1.05);
    box-shadow: 0 4px 15px var(--shadow-color);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    width: 40px;
    height: 40px;
  }
`;

export const ProgressDots = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;

  @media (max-width: 768px) {
    gap: 6px;
  }
`;

export const ProgressDot = styled.button`
  width: ${props => props.$active ? '24px' : '8px'};
  height: 8px;
  border-radius: 4px;
  border: none;
  background: ${props => props.$active ? COLORS.accent.primary : 'var(--border-light)'};
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 0;

  &:hover {
    background: ${props => props.$active ? COLORS.accent.primary : 'var(--border-color)'};
  }
`;

// Typography
export const HeroText = styled.h1`
  font-size: ${props => props.$size || '72px'};
  font-weight: 700;
  color: ${props => props.$color || COLORS.text.primary};
  line-height: 1.1;
  margin: 0;
  animation: ${fadeIn} 0.8s ease forwards;
  animation-delay: ${props => props.$delay || '0s'};
  opacity: 0;

  @media (max-width: 1200px) {
    font-size: ${props => props.$sizeLg || '56px'};
  }

  @media (max-width: 768px) {
    font-size: ${props => props.$sizeMd || '36px'};
  }
`;

export const SubText = styled.p`
  font-size: ${props => props.$size || '24px'};
  font-weight: ${props => props.$weight || 400};
  color: ${props => props.$color || COLORS.text.secondary};
  line-height: 1.5;
  margin: 0;
  max-width: 600px;
  animation: ${fadeIn} 0.8s ease forwards;
  animation-delay: ${props => props.$delay || '0.2s'};
  opacity: 0;

  @media (max-width: 768px) {
    font-size: ${props => props.$sizeMd || '16px'};
  }
`;

export const BigNumber = styled.div`
  font-size: ${props => props.$size || '120px'};
  font-weight: 800;
  color: ${props => props.$color || COLORS.text.primary};
  line-height: 1;
  margin: 0;
  animation: ${countUp} 0.8s ease forwards;
  animation-delay: ${props => props.$delay || '0.3s'};
  opacity: 0;
  letter-spacing: -2px;

  @media (max-width: 1200px) {
    font-size: ${props => props.$sizeLg || '80px'};
  }

  @media (max-width: 768px) {
    font-size: ${props => props.$sizeMd || '48px'};
  }
`;

export const Label = styled.div`
  font-size: ${props => props.$size || '14px'};
  font-weight: 600;
  color: ${props => props.$color || COLORS.text.muted};
  text-transform: uppercase;
  letter-spacing: 2px;
  margin: ${props => props.$margin || '0'};
  animation: ${fadeIn} 0.8s ease forwards;
  animation-delay: ${props => props.$delay || '0.1s'};
  opacity: 0;

  @media (max-width: 768px) {
    font-size: 12px;
    letter-spacing: 1.5px;
  }
`;

export const GradientText = styled.span`
  background: linear-gradient(135deg, ${COLORS.accent.primary} 0%, ${COLORS.accent.secondary} 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

// Stats Grid
export const StatsRow = styled.div`
  display: flex;
  gap: 60px;
  margin-top: ${props => props.$marginTop || '40px'};
  animation: ${fadeIn} 0.8s ease forwards;
  animation-delay: ${props => props.$delay || '0.4s'};
  opacity: 0;
  flex-wrap: wrap;
  justify-content: center;

  @media (max-width: 768px) {
    gap: 30px;
  }
`;

export const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const StatValue = styled.div`
  font-size: ${props => props.$size || '32px'};
  font-weight: 700;
  color: ${props => props.$color || COLORS.text.primary};

  @media (max-width: 768px) {
    font-size: ${props => props.$sizeMd || '24px'};
  }
`;

export const StatLabel = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: ${COLORS.text.muted};
  text-transform: uppercase;
  letter-spacing: 1px;
`;

// Calendar Heatmap (Full year - 4x3 grid)
export const CalendarContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
  margin-top: 30px;
  animation: ${fadeIn} 0.8s ease forwards;
  animation-delay: ${props => props.$delay || '0.5s'};
  opacity: 0;
  width: 100%;
  max-width: 700px;

  @media (max-width: 900px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (max-width: 600px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
  }
`;

export const CalendarMonthRow = styled.div`
  display: contents;
`;

export const CalendarMonth = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  background: transparent;
  border: none;
`;

export const CalendarMonthLabel = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: ${COLORS.text.primary};
  margin-bottom: 4px;
  text-align: center;

  @media (max-width: 768px) {
    font-size: 9px;
    margin-bottom: 2px;
  }
`;

export const CalendarWeekRow = styled.div`
  display: flex;
  gap: 3px;
  justify-content: center;

  @media (max-width: 768px) {
    gap: 1px;
  }
`;

export const CalendarDayWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const rippleExpand = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(25);
    opacity: 0;
  }
`;

const lineAppear = keyframes`
  0% {
    opacity: 0;
    transform: scaleY(0);
  }
  100% {
    opacity: 1;
    transform: scaleY(1);
  }
`;

export const MainnetLine = styled.div`
  position: absolute;
  left: -3px;
  top: -2px;
  bottom: -2px;
  width: 3px;
  background: linear-gradient(180deg, #8b5cf6 0%, #6930c3 100%);
  border-radius: 2px;
  box-shadow: 0 0 10px rgba(105, 48, 195, 0.6);
  pointer-events: none;
  opacity: 0;
  transform-origin: center bottom;
  animation: ${props => props.$active ? lineAppear : 'none'} 0.4s ease-out 2s forwards;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 10px;
    height: 10px;
    background: rgba(139, 92, 246, 0.6);
    border-radius: 50%;
    transform: translate(-50%, -50%) scale(1);
    opacity: 0;
    pointer-events: none;
    animation: ${props => props.$active ? rippleExpand : 'none'} 1.2s ease-out 2.4s forwards;
  }

  &::after {
    animation-delay: ${props => props.$active ? '2.7s' : '0s'};
    background: rgba(105, 48, 195, 0.4);
  }
`;

const popIn = keyframes`
  0% {
    opacity: 0;
    transform: scale(0);
  }
  70% {
    transform: scale(1.2);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
`;

export const CalendarDayDot = styled.div`
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: ${props => {
    if (!props.$intensity) return 'var(--border-light)';
    if (props.$intensity > 0.7) return COLORS.accent.orange;
    if (props.$intensity > 0.4) return COLORS.accent.primary;
    return 'var(--border-color)';
  }};
  transition: all 0.2s ease;
  cursor: ${props => props.$hasData ? 'pointer' : 'default'};
  position: relative;
  z-index: 2;
  opacity: ${props => props.$active ? 0 : 1};
  animation: ${props => props.$active ? popIn : 'none'} 0.25s ease forwards;
  animation-delay: ${props => props.$animDelay || '0s'};

  &:hover {
    transform: ${props => props.$hasData ? 'scale(1.2)' : 'none'};
    box-shadow: ${props => props.$hasData ? '0 2px 8px var(--shadow-color)' : 'none'};
  }

  @media (max-width: 768px) {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
`;

// Calendar Legend
export const CalendarLegend = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-top: 20px;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    gap: 16px;
  }
`;

export const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: ${COLORS.text.secondary};
`;

export const LegendDot = styled.div`
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: ${props => props.$color || 'var(--border-light)'};
`;

// Bar grow animation
const barGrow = keyframes`
  0% {
    height: 0%;
    opacity: 0;
  }
  100% {
    height: var(--bar-height);
    opacity: 1;
  }
`;

// Peak stat cards
export const PeakStatsContainer = styled.div`
  display: flex;
  gap: 24px;
  margin-top: 40px;
  animation: ${fadeIn} 0.8s ease forwards;
  animation-delay: ${props => props.$delay || '0.2s'};
  opacity: 0;
  flex-wrap: nowrap;
  justify-content: center;
  width: 100%;
  max-width: 100%;

  @media (max-width: 768px) {
    gap: 6px;
    margin-top: 24px;
    padding: 0 8px;
    box-sizing: border-box;
  }
`;

export const PeakStatCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 32px;
  background: var(--bg-glass);
  border: 2px solid var(--border-light);
  border-radius: 16px;
  backdrop-filter: blur(10px);
  min-width: 140px;
  opacity: 0;
  animation: ${scaleIn} 0.5s ease forwards;
  animation-delay: ${props => props.$animDelay || '0.3s'};
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    border-color: var(--border-color);
    box-shadow: 0 8px 24px var(--shadow-color);
  }

  @media (max-width: 768px) {
    padding: 10px 8px;
    min-width: 0;
    flex: 1;
    border-radius: 10px;
  }
`;

export const PeakStatIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--border-light) 0%, var(--border-color) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  color: ${COLORS.accent.primary};
  font-size: 20px;

  @media (max-width: 768px) {
    width: 28px;
    height: 28px;
    font-size: 14px;
    margin-bottom: 8px;
    border-radius: 8px;
  }
`;

export const PeakStatLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: ${COLORS.accent.primary};
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 6px;

  @media (max-width: 768px) {
    font-size: 8px;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
`;

export const PeakStatValue = styled.div`
  font-size: 36px;
  font-weight: 800;
  color: ${COLORS.text.primary};
  line-height: 1;

  @media (max-width: 768px) {
    font-size: 16px;
  }
`;

// Bar Chart
export const BarChartContainer = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 6px;
  height: ${props => props.$height || '200px'};
  margin-top: 40px;
  animation: ${fadeIn} 0.8s ease forwards;
  animation-delay: ${props => props.$delay || '0.5s'};
  opacity: 0;
  padding: 24px;
  position: relative;
  width: 100%;
  max-width: 800px;
  background: var(--bg-glass);
  border-radius: 16px;
  border: 1px solid var(--border-light);

  @media (max-width: 768px) {
    height: 150px;
    gap: 3px;
    padding: 16px;
  }
`;

export const BarItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  max-width: 60px;
  height: 100%;
  justify-content: flex-end;
`;

export const Bar = styled.div`
  width: 100%;
  --bar-height: ${props => props.$height || '0%'};
  height: 0%;
  background: ${props => props.$highlight
    ? 'linear-gradient(180deg, #f97316 0%, #ea580c 100%)'
    : 'linear-gradient(180deg, var(--accent-secondary) 0%, var(--accent-primary) 100%)'
  };
  border-radius: 6px 6px 0 0;
  min-height: ${props => props.$height !== '0%' ? '8px' : '4px'};
  opacity: 0;
  animation: ${props => props.$animate ? barGrow : 'none'} 0.6s ease forwards;
  animation-delay: ${props => props.$animDelay || '0s'};
  box-shadow: ${props => props.$highlight
    ? '0 -4px 16px rgba(249, 115, 22, 0.4)'
    : '0 -2px 8px var(--shadow-color)'
  };
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  position: relative;

  &:hover {
    transform: scaleX(1.1);
    box-shadow: ${props => props.$highlight
      ? '0 -4px 20px rgba(249, 115, 22, 0.5)'
      : '0 -4px 16px var(--shadow-color)'
    };
  }

  ${props => props.$highlight && css`
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 8px;
      height: 8px;
      background: #f97316;
      border-radius: 50%;
      box-shadow: 0 0 12px rgba(249, 115, 22, 0.8);
    }
  `}
`;

export const BarLabel = styled.div`
  font-size: 11px;
  color: ${props => props.$highlight ? COLORS.accent.orange : COLORS.text.secondary};
  margin-top: 10px;
  text-align: center;
  font-weight: ${props => props.$highlight ? 700 : 500};
  transition: all 0.2s ease;

  @media (max-width: 768px) {
    font-size: 8px;
    margin-top: 6px;
  }
`;

export const BarValue = styled.div`
  font-size: 10px;
  color: ${props => props.$highlight ? COLORS.accent.orange : COLORS.text.secondary};
  margin-bottom: 6px;
  min-height: 14px;
  font-weight: 700;
  opacity: 0;
  animation: ${props => props.$animate && props.$visible ? fadeIn : 'none'} 0.3s ease forwards;
  animation-delay: ${props => props.$animDelay || '0s'};

  @media (max-width: 768px) {
    font-size: 8px;
  }
`;

// Game List
export const GameListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 40px;
  animation: ${fadeIn} 0.8s ease forwards;
  animation-delay: ${props => props.$delay || '0.4s'};
  opacity: 0;
  width: 100%;
  max-width: 500px;
  text-align: left;

  @media (max-width: 768px) {
    gap: 6px;
    margin-top: 16px;
  }
`;

export const GameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 24px;
  background: var(--bg-glass);
  border-radius: 14px;
  border: none;
  transition: all 0.3s ease;
  opacity: 0;
  transform: translateX(-20px);
  animation: ${fadeIn} 0.5s ease forwards;
  animation-delay: ${props => props.$animDelay || '0s'};

  &:hover {
    background: var(--bg-card);
    transform: translateX(4px);
    box-shadow: 0 4px 20px var(--shadow-color);
  }

  @media (max-width: 768px) {
    padding: 10px 14px;
    gap: 10px;
    border-radius: 10px;
  }
`;

export const GameIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: linear-gradient(135deg, ${COLORS.accent.primary}, ${COLORS.accent.secondary});
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-light);
`;

export const GameInfo = styled.div`
  flex: 1;
`;

export const GameName = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: ${COLORS.text.primary};
  margin-bottom: 2px;

  @media (max-width: 768px) {
    font-size: 14px;
  }
`;

export const GameMeta = styled.div`
  font-size: 13px;
  color: ${COLORS.text.secondary};

  @media (max-width: 768px) {
    font-size: 11px;
  }
`;

export const GameProfit = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: ${props => props.$positive ? COLORS.accent.green : COLORS.accent.red};

  @media (max-width: 768px) {
    font-size: 14px;
  }
`;

// Achievement Card
export const AchievementCard = styled.div`
  display: flex;
  flex-direction: column;
  padding: 40px 48px;
  background: var(--bg-glass);
  border: none;
  border-radius: 24px;
  margin-top: 48px;
  animation: ${scaleIn} 0.6s ease forwards;
  animation-delay: ${props => props.$delay || '0.4s'};
  opacity: 0;
  max-width: 480px;
  backdrop-filter: blur(10px);
  box-shadow: none;
  transition: all 0.3s ease;

  &:hover {
    background: var(--bg-card);
  }
`;

export const AchievementLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: ${COLORS.accent.primary};
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-bottom: 8px;
`;

export const AchievementValue = styled.div`
  font-size: 48px;
  font-weight: 800;
  color: ${COLORS.text.primary};
  line-height: 1;

  @media (max-width: 768px) {
    font-size: 36px;
  }
`;

export const AchievementMeta = styled.div`
  font-size: 14px;
  color: ${COLORS.text.muted};
  margin-top: 8px;
`;

// Share Button
export const ShareButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 16px 32px;
  background: ${COLORS.accent.primary};
  border: none;
  border-radius: 12px;
  color: var(--text-light);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 40px;
  transition: all 0.3s ease;
  animation: ${fadeIn} 0.8s ease forwards;
  animation-delay: 0.6s;
  opacity: 0;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px var(--shadow-color);
  }

  @media (max-width: 768px) {
    padding: 12px 20px;
    font-size: 14px;
    margin-top: 20px;
    gap: 6px;
    border-radius: 10px;
  }
`;

// Address Input Screen
export const InputScreenContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
  background: transparent;
  overflow: hidden;
  z-index: 10;
`;

export const InputCard = styled.div`
  width: 100%;
  max-width: 520px;
  padding: 0;
  background: transparent;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: -80px;
`;

export const InputTitle = styled.h1`
  font-size: 48px;
  font-weight: 800;
  color: ${COLORS.accent.primary};
  margin: 0 0 8px 0;
  text-align: center;
  letter-spacing: -1px;
`;

export const InputSubtitle = styled.div`
  font-size: 72px;
  font-weight: 800;
  background: linear-gradient(135deg, ${COLORS.accent.primary} 0%, ${COLORS.accent.secondary} 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-align: center;
  margin-bottom: 16px;
  letter-spacing: -2px;

  @media (max-width: 768px) {
    font-size: 48px;
  }
`;

export const InputDescription = styled.p`
  font-size: 18px;
  color: ${COLORS.text.secondary};
  text-align: center;
  margin-bottom: 40px;
  font-weight: 500;
`;

export const AddressInput = styled.input`
  width: 100%;
  padding: 20px 24px;
  background: var(--input-bg);
  border: 2px solid var(--input-border);
  border-radius: 16px;
  color: ${COLORS.text.primary};
  font-size: 16px;
  font-family: var(--font-primary);
  outline: none;
  transition: all 0.3s ease;
  text-align: center;

  &::placeholder {
    color: ${COLORS.text.muted};
  }

  &:focus {
    border-color: ${COLORS.accent.primary};
    background: var(--bg-card);
    box-shadow: 0 0 0 4px var(--shadow-color);
  }
`;

export const SubmitButton = styled.button`
  width: 100%;
  padding: 20px;
  margin-top: 20px;
  background: ${COLORS.accent.primary};
  border: none;
  border-radius: 16px;
  color: var(--text-light);
  font-size: 18px;
  font-weight: 700;
  font-family: var(--font-primary);
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover:not(:disabled) {
    background: var(--accent-hover);
    transform: translateY(-2px);
    box-shadow: 0 12px 32px var(--shadow-color);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// Loading
export const LoadingScreen = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: transparent;
  gap: 24px;
`;

export const LoadingSpinner = styled.div`
  width: 48px;
  height: 48px;
  border: 3px solid var(--border-light);
  border-top-color: ${COLORS.accent.primary};
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

export const LoadingText = styled.div`
  font-size: 18px;
  color: ${COLORS.text.primary};
  font-weight: 500;
`;

// Error Screen
export const ErrorScreen = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: transparent;
  padding: 40px;
  text-align: center;
`;

export const ErrorTitle = styled.h1`
  font-size: 32px;
  font-weight: 700;
  color: ${COLORS.text.primary};
  margin: 0 0 16px 0;
`;

export const ErrorMessage = styled.p`
  font-size: 16px;
  color: ${COLORS.text.secondary};
  margin: 0 0 32px 0;
`;

export const RetryButton = styled.button`
  padding: 14px 28px;
  background: transparent;
  border: 2px solid ${COLORS.accent.primary};
  border-radius: 12px;
  color: ${COLORS.accent.primary};
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: ${COLORS.accent.primary};
    color: var(--text-light);
  }
`;

// Summary Card
export const SummaryCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 40px;
  background: var(--bg-glass);
  border: 2px solid var(--border-light);
  border-radius: 24px;
  max-width: 400px;
  animation: ${scaleIn} 0.6s ease forwards;
  animation-delay: 0.3s;
  opacity: 0;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px var(--shadow-color);
`;

export const SummaryRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const SummaryLabel = styled.div`
  font-size: 14px;
  color: ${COLORS.text.muted};
`;

export const SummaryValue = styled.div`
  font-size: 18px;
  font-weight: 700;
  color: ${props => props.$color || COLORS.text.primary};
`;

// NFT Card for Biggest Win
export const NFTCard = styled.div`
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 32px 48px;
  background: var(--bg-glass);
  border: none;
  border-radius: 24px;
  backdrop-filter: blur(10px);
  margin-top: 40px;
  animation: ${scaleIn} 0.5s ease forwards;
  animation-delay: ${props => props.$delay || '0.5s'};
  opacity: 0;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    background: var(--bg-card);
    box-shadow: 0 12px 32px var(--shadow-color);
  }

  @media (max-width: 768px) {
    padding: 24px 28px;
    gap: 24px;
  }
`;

export const NFTImage = styled.img`
  width: 140px;
  height: 140px;
  border-radius: 20px;
  object-fit: cover;
  box-shadow: 0 12px 32px var(--shadow-color);

  @media (max-width: 768px) {
    width: 100px;
    height: 100px;
    border-radius: 14px;
  }
`;

export const NFTInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export const NFTName = styled.div`
  font-size: 36px;
  font-weight: 800;
  color: ${COLORS.text.primary};

  @media (max-width: 768px) {
    font-size: 26px;
  }
`;

export const NFTMeta = styled.div`
  font-size: 18px;
  color: ${COLORS.text.secondary};
  font-weight: 500;

  @media (max-width: 768px) {
    font-size: 15px;
  }
`;

// Highlight Box
export const HighlightBox = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--border-light);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: ${COLORS.accent.primary};
  font-size: 14px;
  font-weight: 600;
  margin-top: 16px;
  animation: ${fadeIn} 0.8s ease forwards;
  animation-delay: 0.5s;
  opacity: 0;
`;

// Close Button
export const CloseButton = styled.button`
  position: fixed;
  top: 24px;
  right: 24px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid var(--border-light);
  background: var(--bg-glass);
  color: ${COLORS.text.secondary};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 1002;
  backdrop-filter: blur(8px);

  &:hover {
    background: var(--bg-card);
    border-color: ${COLORS.accent.primary};
    color: ${COLORS.accent.primary};
    box-shadow: 0 4px 15px var(--shadow-color);
  }
`;
