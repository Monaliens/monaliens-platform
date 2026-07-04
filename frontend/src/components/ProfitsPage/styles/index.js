import styled, { css, keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(var(--slide-from));
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

const rowUpPulse = keyframes`
  0% {
    background: rgba(22, 163, 74, 0.18);
    box-shadow: inset 3px 0 0 var(--accent-green);
  }
  100% {
    background: transparent;
    box-shadow: inset 0 0 0 transparent;
  }
`;

const rowDownPulse = keyframes`
  0% {
    background: rgba(220, 38, 38, 0.16);
    box-shadow: inset 3px 0 0 var(--accent-red);
  }
  100% {
    background: transparent;
    box-shadow: inset 0 0 0 transparent;
  }
`;

export const PageContainer = styled.div`
  width: 100%;
  min-height: 100vh;
  padding: 4px 1rem 3rem;
  animation: ${fadeIn} 0.4s ease-out;

  @media (min-width: 768px) {
    padding: 8px 2rem 4rem;
  }
`;

export const ContentWrapper = styled.div`
  max-width: 1120px;
  margin: 0 auto;
`;

export const Header = styled.header`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 18px;
  margin-bottom: 24px;
  text-align: center;

  @media (min-width: 768px) {
    margin-bottom: 30px;
  }
`;

export const Title = styled.h1`
  margin: 0;
  font-size: 34px;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
  background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 55%, var(--accent-green) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;

  @media (min-width: 768px) {
    font-size: 54px;
  }
`;

export const MonthSwitcher = styled.div`
  display: grid;
  grid-template-columns: minmax(84px, 1fr) auto minmax(84px, 1fr);
  align-items: center;
  gap: 18px;
  width: 100%;
  max-width: 100%;
  margin: 0 auto 2px;
`;

export const SwitchButton = styled.button`
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: ${({ $align }) => ($align === 'right' ? 'flex-end' : 'flex-start')};
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 800;
  text-transform: lowercase;
  cursor: pointer;
  transition: color 0.2s ease, transform 0.2s ease;

  &:hover:not(:disabled) {
    color: var(--accent-primary);
    transform: translateY(-1px);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  svg {
    width: 16px;
    height: 16px;
  flex: 0 0 auto;
  }
`;

export const MonthLabel = styled.div`
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0;
  color: var(--text-primary);
  font-weight: 900;

  @media (min-width: 768px) {
    min-height: 64px;
  }
`;

export const ActiveMonth = styled.span`
  color: var(--text-primary);
  font-size: 34px;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
  text-decoration: underline;
  text-decoration-color: var(--accent-primary);
  text-decoration-thickness: 3px;
  text-underline-offset: 8px;

  @media (min-width: 768px) {
    font-size: 52px;
  }
`;

export const ActiveYear = styled.span`
  align-self: flex-end;
  padding-bottom: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 800;

  @media (min-width: 768px) {
    padding-bottom: 10px;
    font-size: 15px;
  }
`;

export const RevenueScene = styled.section`
  position: relative;
  padding: 22px 0 0;
  border-top: 1px solid rgba(105, 48, 195, 0.22);
  border-bottom: 1px solid rgba(105, 48, 195, 0.14);
  background:
    linear-gradient(120deg, rgba(255, 255, 255, 0.18), rgba(22, 163, 74, 0.025) 62%, rgba(255, 255, 255, 0.08));
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    left: 20px;
    right: 20px;
    top: -1px;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent-primary), transparent);
    opacity: 0.35;
  }

  &::after {
    content: '';
    position: absolute;
    left: 20px;
    right: 20px;
    bottom: -1px;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent-primary), transparent);
    opacity: 0.2;
  }

  [data-theme="dark"] & {
    border-top-color: rgba(124, 58, 237, 0.22);
    border-bottom-color: rgba(124, 58, 237, 0.16);
    background:
      linear-gradient(180deg, rgba(124, 58, 237, 0.035), transparent 24%, transparent 76%, rgba(124, 58, 237, 0.026));
  }

  [data-theme="dark"] &::before {
    opacity: 0.42;
  }

  [data-theme="dark"] &::after {
    opacity: 0.28;
  }

  @media (min-width: 768px) {
    padding-top: 30px;
  }
`;

export const AnimatedContent = styled.div`
  --slide-from: ${({ $direction }) => ($direction > 0 ? '34px' : $direction < 0 ? '-34px' : '0')};
  animation: ${slideIn} 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform, opacity;
`;

export const RevenueTopline = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  align-items: center;
  gap: 16px;
  padding: 0 16px 22px;

  @media (min-width: 760px) {
    grid-template-columns: minmax(128px, 0.62fr) minmax(330px, 1.72fr) minmax(128px, 0.62fr);
    gap: 24px;
    padding: 0 28px 34px;
  }
`;

export const FlowMetric = styled.div`
  width: 100%;
  min-width: 0;
  text-align: ${({ $align }) => ($align === 'right' ? 'right' : 'left')};

  @media (min-width: 760px) {
    align-self: end;
    padding-top: 96px;
  }

  @media (max-width: 759px) {
    text-align: center;
  }
`;

export const FlowLabel = styled.div`
  margin-bottom: 7px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
`;

export const FlowValue = styled.div`
  color: var(--text-primary);
  font-size: clamp(22px, 3.2vw, 34px);
  font-weight: 900;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
`;

export const MainRevenue = styled.div`
  min-width: 0;
  text-align: center;
`;

export const RevenueLabel = styled.div`
  margin-bottom: 8px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
`;

export const RevenueValue = styled.div`
  max-width: 100%;
  color: var(--text-primary);
  font-size: clamp(58px, 10.6vw, 122px);
  font-weight: 900;
  line-height: 0.92;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
`;

export const RevenueUnit = styled.div`
  margin-top: 16px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
`;

export const RevenueDivider = styled.div`
  height: 1px;
  margin: 0 18px;
  background: linear-gradient(90deg, transparent, var(--border-color), transparent);
  opacity: 0.45;
`;

export const RevenueFooter = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;

  @media (min-width: 640px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

export const FooterMetric = styled.div`
  min-width: 0;
  padding: 14px 18px;
  text-align: center;

  & + & {
    border-top: 1px solid var(--border-light);
  }

  @media (min-width: 640px) {
    & + & {
      border-top: 0;
      border-left: 1px solid var(--border-light);
    }
  }
`;

export const FooterLabel = styled.div`
  margin-bottom: 6px;
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
`;

export const FooterValue = styled.div`
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 900;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
`;

export const BreakdownSection = styled.section`
  margin-top: 28px;
`;

export const BreakdownHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
  padding: 0 2px;

  @media (min-width: 720px) {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
`;

export const BreakdownTitle = styled.h2`
  margin: 0;
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 900;
`;

export const MetaText = styled.div`
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
`;

export const BreakdownList = styled.div`
  display: flex;
  flex-direction: column;
`;

export const GameRow = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  padding: 15px 2px;
  border-top: 1px solid var(--border-light);
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.2s ease, padding 0.2s ease;

  ${({ $trend }) => $trend === 'up' && css`
    animation: ${rowUpPulse} 0.9s ease-out;
  `}

  ${({ $trend }) => $trend === 'down' && css`
    animation: ${rowDownPulse} 0.9s ease-out;
  `}

  &:last-child {
    border-bottom: 1px solid var(--border-light);
  }

  &:hover {
    padding-left: 12px;
    padding-right: 12px;
    background: var(--table-row-hover);
  }

  @media (min-width: 820px) {
    grid-template-columns: minmax(140px, 0.62fr) minmax(200px, 0.95fr) minmax(360px, 1.16fr);
    align-items: center;
  }
`;

export const GameIdentity = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
`;

export const GameRank = styled.span`
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
`;

export const GameName = styled.div`
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 900;
`;

export const GameProfit = styled.div`
  min-width: 0;
  color: ${({ $tone }) => {
    if ($tone === 'loss') return 'var(--accent-red)';
    if ($tone === 'neutral') return 'var(--text-secondary)';
    return 'var(--accent-green)';
  }};
  font-size: 22px;
  font-weight: 900;

  > span {
    display: flex;
    margin-bottom: 8px;
  }
`;

export const BarTrack = styled.div`
  height: 6px;
  width: 100%;
  border-radius: 999px;
  background: var(--border-light);
  overflow: hidden;
`;

export const BarFill = styled.div`
  height: 100%;
  width: ${({ $width }) => `${$width}%`};
  min-width: ${({ $width }) => ($width > 0 ? '4px' : '0')};
  border-radius: inherit;
  background: ${({ $tone }) => {
    if ($tone === 'loss') return 'linear-gradient(90deg, #f97316, var(--accent-red))';
    if ($tone === 'neutral') return 'var(--text-tertiary)';
    return 'linear-gradient(90deg, var(--accent-primary), var(--accent-green))';
  }};
  transition: width 0.65s cubic-bezier(0.22, 1, 0.36, 1), background 0.25s ease;
`;

export const GameMetrics = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;

  @media (min-width: 560px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
`;

export const RowMetric = styled.div`
  min-width: 0;
`;

export const RowMetricLabel = styled.div`
  margin-bottom: 4px;
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
`;

export const RowMetricValue = styled.div`
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
`;

export const AmountGroup = styled.span`
  position: relative;
  display: ${({ $size }) => ($size === 'hero' ? 'inline-block' : 'inline-flex')};
  align-items: center;
  justify-content: ${({ $size }) => ($size === 'flowRight' ? 'flex-end' : 'inherit')};
  gap: ${({ $size }) => ($size === 'hero' ? '14px' : $size === 'flow' ? '10px' : '6px')};
  max-width: 100%;
  color: inherit;
  font: inherit;
  line-height: inherit;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
`;

export const AmountIcon = styled.img`
  ${({ $size }) => $size === 'hero' && `
    position: absolute;
    left: calc(100% + 16px);
    top: 50%;
    transform: translateY(-50%);
  `}
  width: ${({ $size }) => {
    if ($size === 'hero') return '38px';
    if ($size === 'flow') return '24px';
    if ($size === 'game') return '20px';
    if ($size === 'footer') return '16px';
    return '13px';
  }};
  height: ${({ $size }) => {
    if ($size === 'hero') return '38px';
    if ($size === 'flow') return '24px';
    if ($size === 'game') return '20px';
    if ($size === 'footer') return '16px';
    return '13px';
  }};
  flex: 0 0 auto;
  object-fit: contain;
  filter: drop-shadow(0 2px 5px rgba(105, 48, 195, 0.18));

  @media (max-width: 640px) {
    width: ${({ $size }) => ($size === 'hero' ? '30px' : $size === 'flow' ? '20px' : '13px')};
    height: ${({ $size }) => ($size === 'hero' ? '30px' : $size === 'flow' ? '20px' : '13px')};
    ${({ $size }) => $size === 'hero' && `
      left: calc(100% + 10px);
    `}
  }
`;

export const StateBox = styled.div`
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: var(--text-secondary);
  text-align: center;
`;

export const RetryButton = styled.button`
  padding: 10px 16px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--accent-primary);
  color: var(--text-light);
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
`;
