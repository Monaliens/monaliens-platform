import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
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
  max-width: 1400px;
  margin: 0 auto;
`;

export const TournamentHeader = styled.div`
  text-align: center;
  margin-bottom: 24px;

  @media (min-width: 768px) {
    margin-bottom: 32px;
  }
`;

export const TournamentTitle = styled.h1`
  font-size: 32px;
  font-weight: 800;
  letter-spacing: 3px;
  text-transform: uppercase;
  margin: 0 0 12px 0;
  background: linear-gradient(135deg, #6930c3 0%, #8b5cf6 50%, #c084fc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 4px 30px rgba(105, 48, 195, 0.3);

  @media (min-width: 768px) {
    font-size: 52px;
    letter-spacing: 6px;
    margin-bottom: 16px;
  }
`;

export const PartnershipText = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 1px;
  margin-bottom: 6px;

  @media (min-width: 768px) {
    font-size: 15px;
    letter-spacing: 1.5px;
  }
`;

export const TournamentDate = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: var(--accent-primary);
  letter-spacing: 2px;
  margin-bottom: 16px;

  @media (min-width: 768px) {
    font-size: 16px;
    letter-spacing: 3px;
    margin-bottom: 20px;
  }
`;

export const CountdownContainer = styled.div`
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 24px 16px;
  background: linear-gradient(135deg, var(--accent-primary) 0%, #8b5cf6 100%);
  border-radius: 14px;
  box-shadow: 0 8px 32px var(--shadow-color);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E");
    opacity: 0.08;
    pointer-events: none;
  }

  @media (min-width: 768px) {
    gap: 10px;
    padding: 16px 32px 20px;
    border-radius: 16px;
  }
`;

export const CountdownEndsIn = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: 1.5px;

  @media (min-width: 768px) {
    font-size: 12px;
    letter-spacing: 2px;
  }
`;

export const CountdownRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;

  @media (min-width: 768px) {
    gap: 10px;
  }
`;

export const CountdownItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 44px;

  @media (min-width: 768px) {
    min-width: 56px;
  }
`;

export const CountdownValue = styled.span`
  font-size: 28px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.95);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);

  @media (min-width: 768px) {
    font-size: 40px;
  }
`;

export const CountdownLabel = styled.span`
  font-size: 9px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 4px;

  @media (min-width: 768px) {
    font-size: 10px;
    margin-top: 6px;
  }
`;

export const CountdownSeparator = styled.span`
  font-size: 28px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 14px;

  @media (min-width: 768px) {
    font-size: 40px;
    margin-bottom: 18px;
  }
`;

export const CountdownNote = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-top: 16px;
  letter-spacing: 0.3px;
  text-align: center;

  @media (min-width: 768px) {
    font-size: 13px;
    margin-top: 20px;
  }
`;

export const MainLeaderboard = styled.div`
  margin-bottom: 32px;
  height: 500px;

  @media (min-width: 768px) {
    height: 560px;
  }
`;

export const GamesGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px;
`;

export const GamePanelWrapper = styled.div`
  width: 100%;
  height: 380px;

  @media (min-width: 640px) {
    width: calc(50% - 10px);
  }

  @media (min-width: 1024px) {
    width: calc(33.333% - 14px);
  }

  @media (min-width: 1280px) {
    width: calc(25% - 15px);
  }
`;
