import styled, { keyframes } from 'styled-components';
import { ANIMATION_CONFIG, GRID_BREAKPOINTS } from '../data/raffleConfig';
import { CARD_CONFIG } from '../data/cardConfig';

// Animations
export const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const pulse = keyframes`
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(${CARD_CONFIG.animation.hoverScale});
  }
`;

// Main container
export const GridContainer = styled.div`
  width: 100%;
  padding: 2rem 0;
`;

// Grid layout
export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
  margin: 0 auto;
  padding: 0 20px;
  
  @media (min-width: ${GRID_BREAKPOINTS.xxl.minWidth}px) {
    grid-template-columns: repeat(${GRID_BREAKPOINTS.xxl.columns}, 1fr);
    max-width: ${GRID_BREAKPOINTS.xxl.maxWidth}px;
  }
  
  @media (min-width: ${GRID_BREAKPOINTS.xl.minWidth}px) and (max-width: ${GRID_BREAKPOINTS.xl.maxWidth}px) {
    grid-template-columns: repeat(${GRID_BREAKPOINTS.xl.columns}, 1fr);
    max-width: ${GRID_BREAKPOINTS.xl.maxWidth}px;
  }
  
  @media (min-width: ${GRID_BREAKPOINTS.lg.minWidth}px) and (max-width: ${GRID_BREAKPOINTS.lg.maxWidth}px) {
    grid-template-columns: repeat(${GRID_BREAKPOINTS.lg.columns}, 1fr);
    max-width: ${GRID_BREAKPOINTS.lg.maxWidth}px;
  }
  
  @media (min-width: ${GRID_BREAKPOINTS.md.minWidth}px) and (max-width: ${GRID_BREAKPOINTS.md.maxWidth}px) {
    grid-template-columns: repeat(${GRID_BREAKPOINTS.md.columns}, 1fr);
    gap: 20px;
  }
  
  @media (max-width: ${GRID_BREAKPOINTS.sm.maxWidth}px) {
    grid-template-columns: ${GRID_BREAKPOINTS.sm.columns};
    gap: 16px;
    padding: 0 16px;
  }
`;

// Raffle card - Same style for both NFT and Token
export const RaffleCard = styled.div`
  background: linear-gradient(135deg, rgba(105, 48, 195, 0.02) 0%, rgba(105, 48, 195, 0.05) 100%);
  border-radius: ${CARD_CONFIG.borderRadius.card}px;
  padding: ${CARD_CONFIG.padding.card};
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  cursor: pointer;
  animation: ${fadeIn} ${ANIMATION_CONFIG.cardFadeInDuration}s ease-out forwards;
  animation-delay: ${props => props.$index * ANIMATION_CONFIG.cardStaggerDelay}s;
  opacity: 0;
  border: 2px solid rgba(105, 48, 195, 0.1);
  max-height: 600px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  
  &:hover {
    box-shadow: 0 15px 40px rgba(105, 48, 195, 0.2);
    border-color: #6930c3;
    opacity: 0.95;
    transform: translateY(-2px);
  }
  
  @media (max-width: 768px) {
    padding: ${CARD_CONFIG.padding.cardMobile};
    border-radius: ${CARD_CONFIG.borderRadius.image}px;
    max-height: 550px;
  }
`;

// Prize image
export const PrizeImage = styled.div`
  width: 100%;
  height: ${CARD_CONFIG.imageHeight}px;
  border-radius: ${CARD_CONFIG.borderRadius.image}px;
  background: ${props => props.$image 
    ? `url(${props.$image})` 
    : 'linear-gradient(135deg, #6930c3 0%, #8e44ad 100%)'
  };
  background-size: ${props => props.$isTokenRaffle ? 'contain' : 'cover'};
  background-position: center;
  background-repeat: no-repeat;
  margin-bottom: 1rem;
  position: relative;
  overflow: hidden;
  
  ${props => !props.$image && `
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.2rem;
    font-weight: 600;
  `}
`;

// Status badge
export const StatusBadge = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  padding: ${CARD_CONFIG.padding.badge};
  border-radius: ${CARD_CONFIG.borderRadius.badge}px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  background: ${props => props.$styleConfig?.background || 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'};
  color: ${props => props.$styleConfig?.color || 'white'};
`;

// Prize type badge
export const PrizeTypeBadge = styled.div`
  position: absolute;
  top: 10px;
  left: 10px;
  padding: ${CARD_CONFIG.padding.badge};
  border-radius: ${CARD_CONFIG.borderRadius.badge}px;
  font-size: 0.8rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  backdrop-filter: blur(10px);
`;

// Card content
export const CardContent = styled.div`
  padding: 0.5rem 0;
`;

// Raffle title and description
export const RaffleTitle = styled.h2`
  font-size: 1.4rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: #1f2937;
  line-height: 1.3;
  font-family: 'Lexend', sans-serif;
  
  @media (max-width: 768px) {
    font-size: 1.2rem;
  }
`;

export const RaffleDescription = styled.p`
  font-size: 0.9rem;
  color: #6b7280;
  margin-bottom: 1rem;
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-wrap: break-word;
  word-break: break-word;
  max-height: 2.8rem;
  font-family: 'Lexend', sans-serif;
`;

// Prize title - Same style for both NFT and Token
export const PrizeTitle = styled.h3`
  font-size: 1.6rem;
  font-weight: 800;
  margin-bottom: 0.75rem;
  color: #6930c3;
  line-height: 1.3;
  text-align: center;
  font-family: 'Lexend', sans-serif;
  
  background: linear-gradient(135deg, #6930c3 0%, #8e44ad 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 2px 4px rgba(105, 48, 195, 0.2);
  
  @media (max-width: 768px) {
    font-size: 1.4rem;
  }
`;

// Prize description
export const PrizeDescription = styled.p`
  font-size: 0.9rem;
  color: #6b7280;
  margin-bottom: 1rem;
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: ${props => props.$lineClamp || 2};
  -webkit-box-orient: vertical;
  word-wrap: break-word;
  word-break: break-word;
  max-height: ${props => props.$maxHeight || '2.8rem'};
`;

// Raffle info grid
export const RaffleInfo = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
`;

// Info item
export const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  
  label {
    font-size: 0.75rem;
    color: #6b7280;
    text-transform: uppercase;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }
  
  span {
    font-size: 0.9rem;
    font-weight: 600;
    color: #1f2937;
  }
`;

// Progress section
export const ProgressSection = styled.div`
  margin-bottom: 1rem;
`;

// Progress bar
export const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: ${CARD_CONFIG.borderRadius.progress}px;
  overflow: hidden;
  margin-bottom: 0.5rem;
`;

// Progress fill
export const ProgressFill = styled.div`
  height: 100%;
  background: linear-gradient(135deg, #6930c3 0%, #8e44ad 100%);
  border-radius: ${CARD_CONFIG.borderRadius.progress}px;
  width: ${props => props.$percentage || 0}%;
  transition: width 0.5s ease;
`;

// Progress text
export const ProgressText = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #6b7280;
`;

// Action button
export const ActionButton = styled.button`
  width: 100%;
  background: linear-gradient(135deg, #6930c3 0%, #8e44ad 100%);
  color: white;
  border: none;
  padding: ${CARD_CONFIG.padding.button};
  border-radius: ${CARD_CONFIG.borderRadius.button}px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover:not(:disabled) {
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

// Loading grid
export const LoadingGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1.5rem;
    padding: 0 1rem;
  }
`;

// Loading card
export const LoadingCard = styled.div`
  background: white;
  border-radius: ${CARD_CONFIG.borderRadius.card}px;
  padding: ${CARD_CONFIG.padding.card};
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  animation: ${pulse} ${ANIMATION_CONFIG.pulseInfiniteLoop}s infinite;
`;

// Loading skeleton
export const LoadingSkeleton = styled.div`
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 8px;
  height: ${props => props.height || '20px'};
  width: ${props => props.width || '100%'};
  margin-bottom: ${props => props.$marginBottom || '0.5rem'};
  
  @keyframes loading {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;

// Empty state
export const EmptyState = styled.div`
  text-align: center;
  padding: 4rem 2rem;
  color: #6b7280;
  
  h3 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: #374151;
  }
  
  p {
    font-size: 1rem;
    line-height: 1.6;
  }
`;

// Error state
export const ErrorState = styled.div`
  text-align: center;
  padding: 4rem 2rem;
  color: #ef4444;
  
  h3 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
  }
  
  p {
    font-size: 1rem;
    line-height: 1.6;
    margin-bottom: 2rem;
  }
`;

// Retry button
export const RetryButton = styled.button`
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: ${CARD_CONFIG.borderRadius.button}px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
  }
`; 