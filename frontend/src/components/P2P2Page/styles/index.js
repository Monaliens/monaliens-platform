import styled, { keyframes } from 'styled-components';

// Colors from RafflePage theme
export const COLORS = {
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
const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const cardSlideIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.95) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
`;

// Main RafflePage-style containers
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
    scroll-snap-type: none;
    margin-top: 0;
    padding-top: 0;
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
    padding: 40px 0;
    min-height: auto;
  }
`;

// Main Container (keeping for compatibility)
export const Container = styled.div`
  max-width: 1600px;
  margin: 0 auto;
  padding: 5px 85px 80px;
  animation: ${fadeInUp} 0.8s ease-out;
  min-height: 600px;
  
  @media (max-width: 1200px) {
    padding: 20px 60px 80px;
  }
  
  @media (max-width: 768px) {
    padding: 15px 25px 60px;
  }
`;

// Header Section
export const HeaderSection = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  position: relative;
  z-index: 1;

  @media (max-width: 768px) {
    margin-bottom: 16px;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
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

export const CreateOfferButton = styled.button`
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
    min-height: 44px;
  }
`;

export const YourOffersButton = styled.button`
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
    min-height: 44px;
  }
`;

export const MainTitle = styled.h1`
  font-size: 3rem;
  font-weight: 800;
  background: linear-gradient(90deg, #6930c3 0%, #8e44ad 50%, #6930c3 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0 0 16px 0;
  text-transform: uppercase;
  letter-spacing: 2px;
  animation: gradientShift 8s linear infinite;
  background-size: 200% auto;
  
  @media (max-width: 768px) {
    font-size: 2.5rem;
  }
  
  @media (max-width: 480px) {
    font-size: 2rem;
  }
  
  @keyframes gradientShift {
    0% { background-position: 0% center; }
    100% { background-position: 200% center; }
  }
`;

export const Subtitle = styled.p`
  font-size: 1.2rem;
  color: #64748b;
  margin: 0 0 40px 0;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.6;
  
  @media (max-width: 768px) {
    font-size: 1rem;
  }
`;

// Horizontal Scrolling Card Grid
export const ThreeCardGrid = styled.div`
  position: relative;
  max-width: 100%;
  margin: 0 auto;
  
  .grid-container {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    padding: 0;
    scroll-behavior: smooth;
    scrollbar-width: none;
    -ms-overflow-style: none;
    
    &::-webkit-scrollbar {
      display: none;
    }
    
    /* All cards uniform size */
    & > * {
      flex: 0 0 260px;
    }
  }
  
  @media (max-width: 1024px) {
    .grid-container {
      gap: 12px;
      padding: 0;
      
      & > * {
        flex: 0 0 240px;
      }
    }
  }
  
  @media (max-width: 768px) {
    .grid-container {
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 0;
      overflow-x: visible;
      
      & > * {
        flex: none !important;
        width: 100% !important;
        max-width: 350px !important;
      }
    }
  }
`;

// Navigation Arrows
export const NavigationArrow = styled.button`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #6b7280;
  z-index: 10;
  transition: all 0.2s ease;
  
  &:hover {
    background: #f9fafb;
    color: #374151;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: #f3f4f6;
  }
  
  &.left {
    left: 10px;
  }
  
  &.right {
    right: 10px;
  }
  
  @media (max-width: 768px) {
    display: none;
  }
`;

// Large Offer Card - Modern Glass Morphism
export const LargeOfferCard = styled.div`
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(8px);
  border: 2px solid rgba(105, 48, 195, 0.1);
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(105, 48, 195, 0.05);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  animation: ${cardSlideIn} 0.5s ease-out;
  animation-delay: ${props => props.$index * 0.08}s;
  animation-fill-mode: both;
  display: flex;
  flex-direction: column;
  min-height: 620px;
  height: auto;
  position: relative;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(105, 48, 195, 0.1);
    border-color: rgba(105, 48, 195, 0.2);
    background: rgba(255, 255, 255, 0.65);
  }

  @media (max-width: 768px) {
    border-radius: 12px;
    min-height: auto;
  }
`;

// Card Header - Compact
export const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  position: relative;
  z-index: 2;
`;

export const OfferTypeBadge = styled.div`
  padding: 6px 12px;
  background: linear-gradient(135deg, #6930c3 0%, #8b5cf6 100%);
  color: white;
  border-radius: 16px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 3px 12px rgba(105, 48, 195, 0.3);
`;

export const CountdownContainer = styled.div`
  text-align: right;
  position: relative;
  z-index: 2;
`;

export const CountdownLabel = styled.div`
  font-size: 0.7rem;
  color: #64748b;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 2px;
`;

export const CountdownValue = styled.div`
  font-size: 0.85rem;
  color: #ef4444;
  font-weight: 700;
  animation: ${pulse} 2s ease-in-out infinite;
`;

// Main Title - Compact
export const OfferTitle = styled.h2`
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 8px 0;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

// Main Visual Area - Better Image Display
export const MainVisualArea = styled.div`
  width: 100%;
  height: 280px;
  position: relative;
  overflow: hidden;
  background: #f3f4f6;
  flex-shrink: 0;

  /* Use aspect-ratio for better responsive images */
  @supports (aspect-ratio: 1 / 1) {
    height: auto;
    aspect-ratio: 1 / 1;
  }
`;

export const MainAssetImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

export const OfferTypeOverlay = styled.div`
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 3px 8px;
  background: ${props => {
    if (props.$type === 'NFT') return '#8b5cf6';
    if (props.$type === 'TOKEN') return '#3b82f6';
    return '#6366f1';
  }};
  color: white;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

// Content Area with better space management
export const CardContent = styled.div`
  padding: 12px 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
`;

// Timer Section - Compact Design
export const TimerSection = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 0.9rem;
  color: #6b7280;
  padding: 8px 16px;
  margin-bottom: 8px;
`;

export const TimerLabel = styled.span`
  font-family: var(--font-primary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  font-size: 0.8rem;
`;

export const TimerValue = styled.span`
  color: ${(props) =>
    (props.$timeString || '').toLowerCase() === 'accepted'
      ? '#047857'
      : '#ef4444'};
  font-family: var(--font-primary);
  font-weight: 700;
  letter-spacing: 0.5px;
  text-shadow: ${(props) =>
    (props.$timeString || '').toLowerCase() === 'accepted'
      ? '0 1px 2px rgba(16, 185, 129, 0.2)'
      : '0 1px 2px rgba(239, 68, 68, 0.2)'};
`;

// Central Visual Area - Compact (for swap visual)
export const VisualArea = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 16px 0;
  gap: 12px;
  position: relative;
`;

export const AssetVisual = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const AssetImage = styled.img`
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid rgba(0, 0, 0, 0.1);
`;

export const SwapArrow = styled.div`
  font-size: 1.2rem;
  color: #6b7280;
  font-weight: 500;
`;

// Asset Sections - Minimal
export const AssetSection = styled.div`
  margin-bottom: 12px;
`;

export const SectionTitle = styled.h3`
  font-size: 1.1rem;
  font-weight: 800;
  background: linear-gradient(90deg, #6930c3 0%, #a855f7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin: 0 0 14px 0;
  display: flex;
  align-items: center;
  gap: 6px;
  text-shadow: 0 2px 4px rgba(105, 48, 195, 0.3);
`;

export const SectionIcon = styled.span`
  font-size: 1rem;
  opacity: 0.8;
`;

export const AssetList = styled.div`
  background: transparent;
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 6px;
  padding: 4px;
  position: relative;
`;

export const AssetItem = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 6px 0;
  
  &:not(:last-child) {
    border-bottom: none;
  }
`;

export const AssetIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 6px;
  background: #e5e7eb;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: 600;
  flex-shrink: 0;
`;

export const AssetInfo = styled.div`
  flex: 1;
`;

export const AssetName = styled.div`
  font-size: 1.1rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 3px;
`;

export const AssetDetails = styled.div`
  font-size: 0.9rem;
  color: #64748b;
  font-weight: 500;
`;

// Carousel Components
export const AssetCarousel = styled.div`
  position: relative;
  overflow: hidden;
  height: 50px;
`;

export const AssetCarouselWrapper = styled.div`
  display: flex;
  flex-direction: column;
  transform: translateY(${props => props.$offset}px);
  transition: transform 0.5s ease-in-out;
`;

export const AssetCounter = styled.div`
  position: absolute;
  top: 8px;
  right: 12px;
  background: linear-gradient(135deg, #6930c3 0%, #8b5cf6 100%);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  z-index: 3;
`;

// Card Footer - Enhanced
export const CardFooter = styled.div`
  margin-top: auto;
  padding: 8px 16px 12px;
  position: relative;
`;

export const MakerInfo = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: var(--font-primary);
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #6b7280;
  position: relative;
`;

export const MakerAddress = styled.span`
  color: #4b5563;
  font-weight: 700;
  font-family: var(--font-primary);
  text-transform: none;
  letter-spacing: 0.3px;
  transition: all 0.3s ease;
  cursor: pointer;
  background: linear-gradient(135deg, #4b5563 0%, #6930c3 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  
  &:hover {
    background: linear-gradient(135deg, #6930c3 0%, #8b5cf6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-shadow: 0 1px 3px rgba(105, 48, 195, 0.3);
  }
`;

// Loading and Error States
export const LoadingState = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: ${props => props.$compact ? '80px' : '200px'};
  flex-direction: column;
  gap: 12px;
  color: #64748b;
  font-size: ${props => props.$compact ? '0.9rem' : '1.1rem'};
  font-weight: 600;
  padding: ${props => props.$compact ? '16px' : '40px 20px'};
`;

export const LoadingSpinner = styled.div`
  width: ${props => props.$compact ? '24px' : '48px'};
  height: ${props => props.$compact ? '24px' : '48px'};
  border: ${props => props.$compact ? '3px' : '4px'} solid #f3f4f6;
  border-top: ${props => props.$compact ? '3px' : '4px'} solid #6930c3;
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

export const ErrorState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: ${props => props.$compact ? '120px' : '400px'};
  text-align: center;
  padding: ${props => props.$compact ? '20px' : '40px 20px'};

  h3 {
    margin: 0 0 12px 0;
    color: #ef4444;
    font-size: ${props => props.$compact ? '1.2rem' : '1.5rem'};
    font-weight: 700;
  }

  p {
    margin: 0 0 24px 0;
    color: #64748b;
    font-size: ${props => props.$compact ? '0.9rem' : '1rem'};
    max-width: 400px;
  }
`;

export const RetryButton = styled.button`
  padding: 12px 24px;
  background: linear-gradient(135deg, ${COLORS.primary} 0%, #8b5cf6 100%);
  color: white;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(105, 48, 195, 0.3);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

// Fixed Action Buttons (RafflePage pattern)
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
  animation: bounce 2s infinite;
  
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
    bottom: 70px;
    width: 48px;
    height: 48px;
    font-size: 18px;
  }
`;

// Scroll Indicator Component
export const ScrollIndicatorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 40px 0;
  animation: ${fadeInUp} 0.8s ease 0.3s both;
`;

// Load More Trigger Styling
export const LoadMoreTrigger = styled.div`
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 20px;
  min-height: 80px;
  gap: 12px;

  .load-more-text {
    color: ${COLORS.text.secondary};
    font-size: 0.9rem;
    font-weight: 500;
    opacity: 0.8;
    font-family: var(--font-primary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    animation: ${pulse} 2s ease-in-out infinite;
  }
`;

export const ScrollArrow = styled.div`
  width: 3px;
  height: 40px;
  background: ${COLORS.text.primary};
  margin-bottom: 20px;
  animation: bounce 2s infinite;
  border-radius: 2px;
  opacity: 0.7;
`;

const bounce = keyframes`
  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-10px); }
  60% { transform: translateY(-5px); }
`;

const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
`;

export const LoadingSkeleton = styled.div`
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 37%, #f0f0f0 63%);
  background-size: 400px 100%;
  animation: ${shimmer} 1.5s ease-in-out infinite;
  border-radius: 8px;
  height: ${props => props.$height || '20px'};
  margin-bottom: 8px;
`;

// Responsive Grid Layout (RafflePage pattern)
export const OffersGrid = styled.div`
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

// Hover Preview Tooltip
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const OfferPreviewTooltip = styled.div`
  position: relative;
  width: 320px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(105, 48, 195, 0.15);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(105, 48, 195, 0.2);
  padding: 16px;
  z-index: 1000;
  animation: ${fadeIn} 0.2s ease;
  pointer-events: none;

  @media (max-width: 768px) {
    width: 280px;
  }
`;

export const TooltipHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(105, 48, 195, 0.1);
`;

export const OfferIdBadge = styled.span`
  font-size: 14px;
  font-weight: 700;
  color: ${COLORS.primary};
  font-family: var(--font-primary);
`;

export const TimeRemaining = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${COLORS.text.secondary};
  display: flex;
  align-items: center;
  gap: 4px;
`;

export const TooltipSection = styled.div`
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
`;

export const SectionLabel = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: ${COLORS.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
`;

export const AssetPreviewList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

export const AssetPreviewItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px;
  background: rgba(105, 48, 195, 0.03);
  border-radius: 8px;
  transition: background 0.2s ease;
`;

export const AssetPreviewImage = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid rgba(105, 48, 195, 0.1);
`;

export const AssetPreviewIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: linear-gradient(135deg, ${COLORS.primary} 0%, #8b5cf6 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: white;
`;

export const AssetPreviewInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

export const AssetPreviewName = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${COLORS.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const AssetPreviewDetails = styled.div`
  font-size: 11px;
  color: ${COLORS.text.secondary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const MoreItemsBadge = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: ${COLORS.primary};
  text-align: center;
  padding: 6px;
  background: rgba(105, 48, 195, 0.08);
  border-radius: 6px;
  margin-top: 4px;
`;

export const TooltipLoadingSkeleton = styled.div`
  padding: 16px;
`;

export const TooltipSkeletonLine = styled.div`
  height: ${props => props.$height || '12px'};
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 37%, #f0f0f0 63%);
  background-size: 400px 100%;
  animation: ${shimmer} 1.5s ease-in-out infinite;
  border-radius: 6px;
  margin-bottom: 8px;
`;
