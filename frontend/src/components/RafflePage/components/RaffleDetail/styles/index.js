import styled, { keyframes } from 'styled-components';

// Keyframe animations
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
`;

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
`;

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

const scaleIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

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

export const DetailContainer = styled.div`
  min-height: 100vh;
  background: transparent;
  font-family: var(--font-primary);
  position: relative;
`;

export const ScrollContainer = styled.div`
  height: 100vh;
  overflow-y: scroll;
  scroll-behavior: smooth;
  margin-top: -100px;
  padding-top: 100px;
`;

export const ContentWrapper = styled.div`
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 85px 40px;
  
  @media (max-width: 768px) {
    padding: 0 25px 40px;
  }
`;

export const BackButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  color: #000000;
  font-size: 32px;
  font-weight: 700;
  cursor: pointer;
  margin-bottom: 20px;
  transition: all 0.2s ease;
  font-family: var(--font-primary);
  
  &:hover {
    color: ${COLORS.primary};
  }
`;

export const DetailLayout = styled.div`
  display: flex;
  flex-direction: column;
  gap: 30px;
  
  @media (max-width: 768px) {
    gap: 20px;
  }
`;

// New Layout Components
export const TopSection = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 30px;
  align-items: start;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 20px;
  }
`;

export const BottomSection = styled.div`
  display: grid;
  grid-template-columns: auto 3fr 1fr;
  gap: 32px;
  align-items: start;
  
  @media (max-width: 1200px) {
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 16px;
  }
`;

export const NFTImage = styled.img`
  width: 400px;
  height: 400px;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 12px;
  background: transparent;
  
  @media (max-width: 768px) {
    width: 100%;
    max-width: 100%;
    height: auto;
    aspect-ratio: 1 / 1;
  }
`;

export const TraitsSection = styled.div`
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(105, 48, 195, 0.02) 100%);
  border: 2px solid rgba(105, 48, 195, 0.1);
  border-radius: 12px;
  padding: 20px;
  min-width: 400px;
  
  @media (max-width: 768px) {
    min-width: unset;
    width: 100%;
    padding: 16px;
  }
  
  h3 {
    font-size: 18px;
    font-weight: 700;
    color: ${COLORS.text.primary};
    margin-bottom: 16px;
    margin-top: 0;
    
    @media (max-width: 768px) {
      font-size: 16px;
    }
  }
`;

export const TraitsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 20px;
`;

export const TraitItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(105, 48, 195, 0.05);
  
  &:last-child {
    border-bottom: none;
  }
  
  .trait-name {
    color: ${COLORS.text.primary};
    font-weight: 500;
  }
  
  .trait-value {
    color: ${COLORS.text.primary};
    font-weight: 600;
  }
`;

export const CreatorInfo = styled.div`
  font-size: 14px;
  color: ${COLORS.text.secondary};
  font-weight: 500;
  padding-top: 16px;
  border-top: 2px solid rgba(105, 48, 195, 0.1);
  margin-top: 4px;
`;

export const RaffleInfoSection = styled.div`
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(105, 48, 195, 0.02) 100%);
  border: 2px solid rgba(105, 48, 195, 0.1);
  border-radius: 12px;
  padding: 45px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: relative;
  height: fit-content;
  
  .price-info {
    font-size: 14px;
    color: ${COLORS.text.secondary};
    font-weight: 500;
  }
  
  @media (max-width: 768px) {
    padding: 20px;
    gap: 16px;
  }
`;

export const NFTTitle = styled.h1`
  font-size: 40px;
  font-weight: 700;
  color: ${COLORS.text.primary};
  margin: 0;
  line-height: 1.2;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: none;
  flex: 1;
  
  @media (max-width: 768px) {
    font-size: 24px;
  }
`;

export const TitleRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
`;

export const StatusBadgeDetail = styled.div`
  color: ${props => 
    props.$claimed ? '#FFC107' : 
    props.$refunded ? '#dc2626' :
    props.$active ? '#16a34a' : '#dc2626'
  };
  background: ${props => 
    props.$claimed || props.$refunded ? 'transparent' : 
    props.$active ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)'
  };
  border: ${props => 
    props.$claimed ? '2px solid #FFC107' : 
    props.$refunded ? '2px solid #dc2626' : 'none'
  };
  padding: ${props => 
    (props.$claimed || props.$refunded) ? '6px 14px' : '8px 16px'
  };
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
`;

export const PriceInfo = styled.div`
  display: flex;
  gap: 24px;
  font-size: 16px;
  color: ${COLORS.text.secondary};
  
  span {
    font-weight: 500;
  }
  
  .value {
    color: ${COLORS.text.primary};
    font-weight: 600;
  }
  
  .change {
    color: ${COLORS.green};
    font-weight: 600;
  }
`;

export const InfoBoxes = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
`;

export const InfoBox = styled.div`
  background: rgba(105, 48, 195, 0.05);
  border: 2px solid rgba(105, 48, 195, 0.15);
  border-radius: 8px;
  padding: 20px 24px;
  text-align: center;
  font-size: 20px;
  font-weight: 600;
  color: ${COLORS.primary};
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  @media (max-width: 768px) {
    padding: 16px;
    font-size: 16px;
    min-height: 50px;
  }
`;

// Remove these old components as they're replaced by new ones

export const AmountSelector = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 30px;
  margin: 20px 0;
`;

export const AmountButton = styled.button`
  background: rgba(105, 48, 195, 0.1);
  border: 2px solid rgba(105, 48, 195, 0.3);
  color: ${COLORS.primary};
  width: 55px;
  height: 55px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 28px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(105, 48, 195, 0.2);
    border-color: rgba(105, 48, 195, 0.5);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    width: 48px;
    height: 48px;
    font-size: 24px;
  }
`;

export const AmountDisplay = styled.span`
  color: ${COLORS.text.primary};
  font-size: 36px;
  font-weight: 700;
  min-width: 80px;
  text-align: center;
  
  @media (max-width: 768px) {
    font-size: 28px;
    min-width: 60px;
  }
`;

export const BuyButton = styled.button`
  background: linear-gradient(135deg, ${COLORS.primary}, ${COLORS.blue});
  border: none;
  color: white;
  padding: 28px 24px;
  border-radius: 12px;
  font-size: 26px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: var(--font-primary);
  width: 95%;
  margin: 0 auto;
  display: block;
  text-transform: uppercase;
  letter-spacing: 2px;
  box-shadow: 0 4px 15px rgba(105, 48, 195, 0.3);
  min-height: 80px;
  
  .buy-text {
    color: inherit;
  }
  
  .price-text {
    color: white;
    opacity: 0.9;
    font-size: 16px;
  }
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(105, 48, 195, 0.4);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:disabled {
    background: #cccccc;
    cursor: not-allowed;
    box-shadow: none;
  }
  
  @media (max-width: 768px) {
    padding: 18px 16px;
    font-size: 18px;
    min-height: 56px;
    letter-spacing: 1px;
    width: 100%;
    
    .price-text {
      font-size: 14px;
    }
  }
`;

export const ParticipantsSection = styled.div`
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(105, 48, 195, 0.02) 100%);
  border: 2px solid rgba(105, 48, 195, 0.1);
  border-radius: 12px;
  padding: 20px;
  height: 100%;
  max-height: 400px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  
  @media (max-width: 768px) {
    max-height: 300px;
    padding: 16px;
  }
`;

export const ParticipantsTitle = styled.h3`
  font-size: 18px;
  font-weight: 700;
  color: ${COLORS.text.primary};
  margin-bottom: 16px;
  margin-top: 0;
  
  @media (max-width: 768px) {
    font-size: 16px;
  }
`;

export const ParticipantsTable = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex: 1;
  max-height: 280px;
  padding-right: 8px;
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(105, 48, 195, 0.1);
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(105, 48, 195, 0.4);
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(105, 48, 195, 0.6);
  }
`;

export const TableHeader = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 2px solid rgba(105, 48, 195, 0.1);
  font-weight: 600;
  font-size: 14px;
  color: ${COLORS.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  @media (max-width: 768px) {
    font-size: 12px;
    padding: 10px 0;
    gap: 8px;
  }
`;

export const TableRow = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(105, 48, 195, 0.05);
  
  &:last-child {
    border-bottom: none;
  }
`;

export const TableCell = styled.div`
  font-size: 14px;
  color: ${COLORS.text.primary};
  font-weight: 500;
  
  ${TableHeader} & {
    color: ${COLORS.text.secondary};
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
`;

// Results Section (renamed from WinnerResultsSection)
export const ResultsSection = styled.div`
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(105, 48, 195, 0.02) 100%);
  border: 2px solid rgba(105, 48, 195, 0.1);
  border-radius: 12px;
  padding: 20px;
  height: 100%;
  max-height: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

// Keep old name for backward compatibility
export const WinnerResultsSection = ResultsSection;

export const CountdownTimer = styled.div`
  text-align: center;
  
  .countdown-label {
    font-size: 16px;
    color: ${COLORS.text.secondary};
    font-weight: 500;
    margin-bottom: 16px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .countdown-time {
    font-size: 56px;
    font-weight: 700;
    color: ${COLORS.primary};
    letter-spacing: 3px;
    line-height: 1;
  }
`;

export const WinnerResultsTitle = styled.h3`
  font-size: 18px;
  font-weight: 700;
  color: ${COLORS.text.primary};
  margin-bottom: 16px;
  margin-top: 0;
`;

export const WinnerInfoContainer = styled.div`
  margin-bottom: 16px;
`;

export const WinnerLabel = styled.div`
  font-size: 14px;
  color: ${COLORS.text.secondary};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
`;

export const WinnerAddress = styled.a`
  color: ${COLORS.text.primary};
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: color 0.2s ease;
  
  &:hover {
    color: ${COLORS.primary};
  }
`;

export const TransactionContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const TransactionLabel = styled.div`
  font-size: 14px;
  color: ${COLORS.text.secondary};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
`;

export const TransactionLink = styled.a`
  color: ${COLORS.text.primary};
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: color 0.2s ease;
  margin-bottom: 6px;
  
  &:hover {
    color: ${COLORS.primary};
  }
  
  &:last-child {
    margin-bottom: 0;
  }
`;

// Skeleton Loader Components
export const SkeletonContainer = styled.div`
  opacity: 0;
  animation: ${fadeIn} 0.3s ease-out forwards;
`;

export const SkeletonBox = styled.div`
  background: linear-gradient(
    90deg,
    rgba(105, 48, 195, 0.05) 0%,
    rgba(105, 48, 195, 0.1) 50%,
    rgba(105, 48, 195, 0.05) 100%
  );
  background-size: 2000px 100%;
  animation: ${shimmer} 2s infinite linear;
  border-radius: ${props => props.$radius || '8px'};
  width: ${props => props.$width || '100%'};
  height: ${props => props.$height || '20px'};
  margin: ${props => props.$margin || '0'};
`;

export const SkeletonImage = styled(SkeletonBox)`
  width: 400px;
  height: 400px;
  border-radius: 12px;
  animation: ${shimmer} 2s infinite linear, ${pulse} 1.5s ease-in-out infinite;
  
  @media (max-width: 768px) {
    width: 100%;
    height: auto;
    aspect-ratio: 1;
  }
`;

export const SkeletonLayout = styled.div`
  display: flex;
  flex-direction: column;
  gap: 30px;
  
  @media (max-width: 768px) {
    gap: 20px;
  }
`;

export const SkeletonTopSection = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 30px;
  align-items: start;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 20px;
  }
`;

export const SkeletonInfoSection = styled.div`
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(105, 48, 195, 0.02) 100%);
  border: 2px solid rgba(105, 48, 195, 0.1);
  border-radius: 12px;
  padding: 45px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  animation: ${pulse} 1.5s ease-in-out infinite;
`;

export const SkeletonBottomSection = styled.div`
  display: grid;
  grid-template-columns: auto 3fr 1fr;
  gap: 32px;
  align-items: start;
  
  @media (max-width: 1200px) {
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 20px;
  }
`;

export const SkeletonPanel = styled.div`
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(105, 48, 195, 0.02) 100%);
  border: 2px solid rgba(105, 48, 195, 0.1);
  border-radius: 12px;
  padding: 20px;
  min-height: ${props => props.$minHeight || '400px'};
  animation: ${pulse} 1.5s ease-in-out infinite;
  animation-delay: ${props => props.$delay || '0s'};
`;

// Transition wrapper for smooth loading-to-content transition
export const ContentTransition = styled.div`
  opacity: ${props => props.$show ? '1' : '0'};
  visibility: ${props => props.$show ? 'visible' : 'hidden'};
  transition: opacity 0.5s ease-out, visibility 0.5s ease-out;
  position: ${props => props.$loading ? 'absolute' : 'relative'};
  width: 100%;
`;

// Animated content wrapper (only used after loading)
export const AnimatedContent = styled.div`
  & ${BackButton} {
    opacity: 0;
    animation: ${slideIn} 0.6s ease-out forwards;
    animation-delay: 0.1s;
  }
  
  & ${NFTImage} {
    opacity: 0;
    animation: ${scaleIn} 0.8s ease-out forwards;
    animation-delay: 0.3s;
  }
  
  & ${TraitsSection} {
    opacity: 0;
    animation: ${slideIn} 0.8s ease-out forwards;
    animation-delay: 0.4s;
  }
  
  & ${TitleRow} {
    opacity: 0;
    animation: ${fadeIn} 0.6s ease-out forwards;
    animation-delay: 0.4s;
  }
  
  & ${InfoBoxes} {
    opacity: 0;
    animation: ${fadeIn} 0.6s ease-out forwards;
    animation-delay: 0.5s;
  }
  
  /* Error and Progress displays */
  & ${RaffleInfoSection} > div:not(${TitleRow}):not(${InfoBoxes}):not(${AmountSelector}) {
    opacity: 0;
    animation: ${fadeIn} 0.6s ease-out forwards;
    animation-delay: 0.55s;
  }
  
  & ${AmountSelector} {
    opacity: 0;
    animation: ${fadeIn} 0.6s ease-out forwards;
    animation-delay: 0.6s;
  }
  
  & ${BuyButton} {
    opacity: 0;
    animation: ${scaleIn} 0.6s ease-out forwards;
    animation-delay: 0.7s;
  }
  
  & ${ParticipantsSection} {
    opacity: 0;
    animation: ${slideIn} 0.8s ease-out forwards;
    animation-delay: 0.5s;
  }
  
  & ${ResultsSection} {
    opacity: 0;
    animation: ${slideIn} 0.8s ease-out forwards;
    animation-delay: 0.6s;
  }
`;

// Wallet Search Components
export const WalletSearchContainer = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 8px;

  @media (max-width: 768px) {
    position: relative;
    top: 0;
    right: 0;
    margin-bottom: 20px;
  }
`;

export const WalletSearchForm = styled.form`
  display: flex;
  gap: 8px;

  @media (max-width: 768px) {
    width: 100%;
  }
`;

export const WalletSearchInput = styled.input`
  padding: 8px 12px;
  border: 2px solid rgba(105, 48, 195, 0.2);
  border-radius: 8px;
  font-size: 14px;
  width: 300px;
  background: rgba(255, 255, 255, 0.98);
  transition: all 0.3s ease;
  font-family: 'Lexend', sans-serif;

  &:focus {
    outline: none;
    border-color: rgba(105, 48, 195, 0.5);
    box-shadow: 0 0 0 3px rgba(105, 48, 195, 0.1);
  }

  &::placeholder {
    color: #9ca3af;
  }

  @media (max-width: 768px) {
    width: 100%;
    flex: 1;
  }
`;

export const WalletSearchButton = styled.button`
  padding: 8px 16px;
  background: linear-gradient(135deg, #6930c3 0%, #8e44ad 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Lexend', sans-serif;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(105, 48, 195, 0.3);
  }

  &:active {
    transform: translateY(0);
  }
`;

export const WalletSearchResult = styled.div`
  padding: 12px;
  background: ${props => props.$found ? 
    'linear-gradient(135deg, rgba(22, 163, 74, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)' : 
    props.$error ? 
    'linear-gradient(135deg, rgba(220, 38, 38, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)' :
    'linear-gradient(135deg, rgba(107, 114, 128, 0.1) 0%, rgba(156, 163, 175, 0.05) 100%)'
  };
  border: 2px solid ${props => props.$found ? 
    'rgba(22, 163, 74, 0.3)' : 
    props.$error ?
    'rgba(220, 38, 38, 0.3)' :
    'rgba(107, 114, 128, 0.3)'
  };
  border-radius: 8px;
  font-size: 14px;
  color: ${props => props.$found ? '#16a34a' : props.$error ? '#dc2626' : '#6b7280'};
  font-weight: 600;
  animation: ${slideIn} 0.3s ease-out;
`;