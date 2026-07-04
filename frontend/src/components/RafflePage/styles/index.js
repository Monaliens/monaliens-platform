import styled, { keyframes } from 'styled-components';

// Colors from project theme
const COLORS = {
  primary: '#6930c3',
  blue: '#2563eb',
  green: '#16a34a',
  background: '#f5f5f5',
  cardBackground: 'rgba(255, 255, 255, 0.95)',
  text: {
    primary: '#1f2937',
    secondary: '#6b7280'
  }
};

// Animations
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const bounce = keyframes`
  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-10px); }
  60% { transform: translateY(-5px); }
`;

const bounceUp = keyframes`
  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-8px); }
  60% { transform: translateY(-4px); }
`;

// Main containers
export const PageContainer = styled.div`
  min-height: 100vh;
  background: transparent;
  font-family: var(--font-primary);
  position: relative;
`;

export const ScrollContainer = styled.div`
  height: 100vh;
  overflow-y: scroll;
  scroll-behavior: smooth;
  scroll-snap-type: y mandatory;
  margin-top: -100px;
  padding-top: 100px;
  
  @media (max-width: 768px) {
    scroll-snap-type: none; /* Disable scroll-snap on mobile */
    margin-top: 0; /* Remove negative margin on mobile */
    padding-top: 0; /* Remove extra padding on mobile */
  }
`;

export const ContentWrapper = styled.div`
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 85px;
  
  @media (max-width: 768px) {
    padding: 0 25px;
  }
`;

export const Section = styled.div`
  min-height: 100vh;
  scroll-snap-align: start;
  padding: 100px 0;
  position: relative;
  
  @media (max-width: 768px) {
    padding: 40px 0; /* Reduced padding on mobile */
    min-height: auto; /* Allow natural height on mobile */
  }
`;

export const HeaderSection = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  animation: ${fadeIn} 0.6s ease;
  position: relative;
  z-index: 15;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
`;

export const PageTitle = styled.h1`
  font-size: 32px;
  font-weight: 700;
  color: ${COLORS.text.primary};
  margin: 0;
  font-family: var(--font-primary);
  
  @media (max-width: 768px) {
    font-size: 24px;
  }
`;

export const CreateRaffleButton = styled.button`
  background: transparent;
  color: ${COLORS.blue};
  border: 2px solid ${COLORS.blue};
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: var(--font-primary);
  
  &:hover {
    transform: scale(1.02);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  @media (max-width: 768px) {
    padding: 12px 20px;
    font-size: 15px;
    min-height: 44px; /* Touch target minimum */
  }
`;

// Landing Section Styles
export const LandingContainer = styled.div`
  margin-bottom: 60px;
`;

export const RaffleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 40px;
  
  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 12px;
  }
`;

// Raffle Card Styles
export const RaffleCardContainer = styled.div`
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(105, 48, 195, 0.02) 100%);
  border: 2px solid rgba(105, 48, 195, 0.1);
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(105, 48, 195, 0.3);
  padding: 16px;
  transition: all 0.3s ease;
  animation: ${fadeIn} 0.6s ease;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 30px rgba(105, 48, 195, 0.5);
    border-color: rgba(105, 48, 195, 0.3);
  }
`;

export const NFTImage = styled.img`
  width: calc(100% + 32px);
  margin: -16px -16px 12px -16px;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 8px 8px 0 0;
`;

export const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
`;

export const CountdownTimer = styled.div`
  color: ${COLORS.green};
  font-size: 14px;
  font-weight: 600;
  text-align: right;
  margin-bottom: 8px;
`;

export const NFTInfo = styled.div`
  margin: 8px 0;
`;

export const NFTName = styled.div`
  color: ${COLORS.text.primary};
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
  line-height: 1.3;
`;

export const CollectionName = styled.div`
  color: ${COLORS.text.secondary};
  font-size: 13px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 12px;
  background: rgba(105, 48, 195, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(105, 48, 195, 0.1);
`;

export const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  
  .label {
    font-size: 11px;
    color: ${COLORS.text.secondary};
    text-transform: uppercase;
    font-weight: 600;
    margin-bottom: 2px;
    letter-spacing: 0.5px;
  }
  
  .value {
    color: ${COLORS.green};
    font-size: 14px;
    font-weight: 600;
  }
`;

export const TicketPrice = styled.div`
  color: ${COLORS.primary};
  font-size: 26px;
  font-weight: 800;
  text-align: center;
  margin: 8px 0;
`;

export const QuickBuySection = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(105, 48, 195, 0.1);
  background: none;
`;

export const AmountSelector = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const AmountButton = styled.button`
  background: none;
  border: 1px solid ${COLORS.green};
  color: ${COLORS.green};
  width: 30px;
  height: 30px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 18px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${COLORS.green};
    color: white;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    width: 36px;
    height: 36px;
    font-size: 20px;
  }
`;

export const AmountDisplay = styled.span`
  color: ${COLORS.text.primary};
  font-size: 16px;
  font-weight: 600;
  min-width: 24px;
  text-align: center;
`;

export const MaxTicketsLabel = styled.div`
  position: absolute;
  top: -12px;
  right: 4px;
  font-family: 'Lexend', sans-serif;
  font-size: 10px;
  font-weight: 600;
  color: ${COLORS.text.secondary};
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid rgba(105, 48, 195, 0.15);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  line-height: 1;
  pointer-events: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  z-index: 10;
  
  &::before {
    content: '';
    position: absolute;
    left: 50%;
    bottom: -3px;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 3px solid transparent;
    border-right: 3px solid transparent;
    border-top: 3px solid rgba(105, 48, 195, 0.15);
  }
`;

export const QuickBuyButton = styled.button`
  background: transparent;
  color: ${COLORS.blue};
  border: 2px solid ${COLORS.blue};
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: var(--font-primary);
  
  &:hover {
    transform: scale(1.02);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  @media (max-width: 768px) {
    padding: 12px 16px;
    font-size: 15px;
    min-height: 44px; /* Touch target minimum */
  }
`;

// Scroll Indicator Styles
export const ScrollIndicatorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 40px 0;
  animation: ${fadeIn} 0.8s ease 0.3s both;
`;

export const ScrollArrow = styled.div`
  width: 3px;
  height: 40px;
  background: ${COLORS.text.primary};
  margin-bottom: 20px;
  animation: ${bounce} 2s infinite;
  border-radius: 2px;
  opacity: 0.7;
`;

export const HowItWorksButton = styled.button`
  background: rgba(255, 255, 255, 0.95);
  border: 2px solid rgba(105, 48, 195, 0.2);
  color: ${COLORS.text.primary};
  font-size: 16px;
  font-weight: 500;
  font-family: var(--font-primary);
  padding: 12px 24px;
  border-radius: 12px;
  position: fixed;
  right: 40px;
  bottom: 40px;
  z-index: 10;
  transition: all 0.3s ease;
  cursor: pointer;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 15px rgba(105, 48, 195, 0.1);
  
  &:hover {
    background: rgba(105, 48, 195, 0.05);
    border-color: rgba(105, 48, 195, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(105, 48, 195, 0.15);
  }
  
  &:active {
    transform: translateY(0px);
  }
  
  @media (max-width: 768px) {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    border-radius: 0;
    border-left: none;
    border-right: none;
    border-bottom: none;
    padding: 16px;
    min-height: 56px;
    font-size: 15px;
    margin-top: 0;
    box-shadow: 0 -2px 10px rgba(105, 48, 195, 0.15);
  }
`;

// All Raffles Section Styles
export const AllRafflesContainer = styled.div`
  margin-bottom: 60px;
`;

export const AllRafflesHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

export const FiltersContainer = styled.div`
  display: flex;
  align-items: center;
`;

export const AllRafflesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  
  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 12px;
  }
`;

// Scroll To Top Button
// New Card Components for updated design
export const StatusBadge = styled.div`
  position: absolute;
  bottom: 8px;
  left: 12px;
  color: ${props => {
    if (props.$status === 'CLAIMED' || props.$status === 'DRAWN') return '#FFC107';
    if (props.$status === 'REFUNDED') return '#dc2626';
    if (props.$active) return '#16a34a';
    return '#dc2626';
  }};
  background: transparent;
  border: 1.5px solid ${props => {
    if (props.$status === 'CLAIMED' || props.$status === 'DRAWN') return '#FFC107';
    if (props.$status === 'REFUNDED') return '#dc2626';
    if (props.$active) return '#16a34a';
    return '#dc2626';
  }};
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  z-index: 3;
`;

export const WinnerDisplay = styled.div`
  color: #6930c3;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  padding: 0;
  background: transparent;
`;

export const MaxTicketsLabelNew = styled.div`
  text-align: center;
  color: ${COLORS.text.secondary};
  font-size: 12px;
  font-weight: 500;
  margin-top: 8px;
`;

export const ScrollToTopButton = styled.button`
  position: fixed;
  left: 40px;
  bottom: 40px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  border: 2px solid rgba(105, 48, 195, 0.2);
  color: ${COLORS.primary};
  cursor: pointer;
  z-index: 10;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: bold;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 15px rgba(105, 48, 195, 0.15);
  animation: ${bounceUp} 2s infinite;
  
  &:hover {
    background: rgba(105, 48, 195, 0.1);
    border-color: rgba(105, 48, 195, 0.4);
    transform: translateY(-3px);
    box-shadow: 0 6px 20px rgba(105, 48, 195, 0.25);
  }
  
  &:active {
    transform: translateY(-1px);
  }
  
  @media (max-width: 768px) {
    left: 20px;
    bottom: 70px; /* Move up to avoid HowItWorks button */
    width: 48px;
    height: 48px;
    font-size: 18px;
  }
`;