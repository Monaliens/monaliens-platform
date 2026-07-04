import styled, { keyframes } from 'styled-components';
import { 
  ANIMATION_CONFIG, 
  MODAL_CONFIG, 
  HEADER_CONFIG, 
  BUTTON_CONFIG, 
  INPUT_CONFIG, 
  GRID_CONFIG, 
  COLOR_CONFIG 
} from '../data/modalConfig';
import { STATUS_STYLES, BADGE_CONFIG } from '../data/statusConfig';

// Animations
export const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

export const fadeOut = keyframes`
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
`;

export const slideInFromRight = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

export const slideOutToRight = keyframes`
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
`;

export const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

// Modal Container Components
export const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, ${MODAL_CONFIG.backdrop.opacity});
  backdrop-filter: blur(${MODAL_CONFIG.backdrop.blur}px);
  display: flex;
  align-items: stretch;
  justify-content: flex-end;
  z-index: ${MODAL_CONFIG.zIndex.modal};
  animation: ${props => props.$isClosing ? fadeOut : fadeIn} ${ANIMATION_CONFIG.fadeInDuration}s ease-out;
`;

export const ModalContainer = styled.div`
  background: ${COLOR_CONFIG.background.white};
  border-radius: ${MODAL_CONFIG.borderRadius.desktop};
  padding: 0;
  width: 100%;
  max-width: ${MODAL_CONFIG.maxWidth}px;
  height: 100vh;
  overflow-y: auto;
  position: relative;
  box-shadow: -10px 0 50px rgba(0, 0, 0, 0.3);
  animation: ${props => props.$isClosing ? slideOutToRight : slideInFromRight} ${ANIMATION_CONFIG.slideInDuration}s ${ANIMATION_CONFIG.slideInCubicBezier};
  
  @media (max-width: 768px) {
    max-width: 100vw;
    border-radius: ${MODAL_CONFIG.borderRadius.mobile};
  }
`;

export const CloseButton = styled.button`
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  width: ${BUTTON_CONFIG.closeButton.size}px;
  height: ${BUTTON_CONFIG.closeButton.size}px;
  font-size: ${BUTTON_CONFIG.closeButton.fontSize}px;
  cursor: pointer;
  color: #666;
  z-index: ${MODAL_CONFIG.zIndex.closeButton};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${COLOR_CONFIG.background.white};
    color: #333;
    transform: scale(${ANIMATION_CONFIG.hoverScale});
  }
`;

// Header Components
export const ModalHeader = styled.div`
  position: relative;
  height: ${props => props.$hasImage ? HEADER_CONFIG.height.withImage : HEADER_CONFIG.height.withoutImage}px;
  background: ${props => props.$hasImage 
    ? `url(${props.$backgroundImage})` 
    : HEADER_CONFIG.gradient.default
  };
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  border-radius: ${MODAL_CONFIG.borderRadius.container}px 0 0 0;
  display: flex;
  align-items: ${props => props.$hasImage ? 'flex-end' : 'center'};
  justify-content: ${props => props.$hasImage ? 'flex-start' : 'center'};
  color: white;
  overflow: hidden;
  
  ${props => props.$hasImage && `
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: ${HEADER_CONFIG.gradient.overlay};
      z-index: ${MODAL_CONFIG.zIndex.headerOverlay};
    }
  `}
  
  @media (max-width: 768px) {
    border-radius: ${MODAL_CONFIG.borderRadius.mobile};
    height: ${props => props.$hasImage ? HEADER_CONFIG.height.mobileWithImage : HEADER_CONFIG.height.mobileWithoutImage}px;
  }
`;

export const HeaderContent = styled.div`
  position: relative;
  z-index: ${MODAL_CONFIG.zIndex.headerContent};
  padding: ${props => props.$hasImage ? `0 ${MODAL_CONFIG.spacing.content}px ${MODAL_CONFIG.spacing.content}px ${MODAL_CONFIG.spacing.content}px` : '0'};
  text-align: ${props => props.$hasImage ? 'left' : 'center'};
  width: 100%;
  
  h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    text-shadow: ${props => props.$hasImage ? '0 2px 8px rgba(0,0,0,0.5)' : 'none'};
    
    @media (max-width: 768px) {
      font-size: 20px;
    }
  }
`;

export const FallbackImageContainer = styled.div`
  width: 100%;
  height: ${HEADER_CONFIG.height.fallback}px;
  background: ${HEADER_CONFIG.gradient.default};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.2rem;
  font-weight: 600;
  text-align: center;
  margin-bottom: 20px;
  border-radius: ${MODAL_CONFIG.borderRadius.content}px;
`;

// Token Prize Header Components
export const TokenPrizeHeader = styled.div`
  background: linear-gradient(135deg, ${COLOR_CONFIG.primary} 0%, #8b5cf6 100%);
  padding: 40px 32px;
  text-align: center;
  color: white;
  position: relative;
  border-radius: 0;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(45deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(255,255,255,0.1) 100%);
    pointer-events: none;
  }
  
  @media (max-width: 768px) {
    padding: 32px 24px;
  }
`;

export const MinimalTitle = styled.div`
  font-size: 13px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: 12px;
  opacity: 0.85;
`;

export const TokenAmount = styled.div`
  font-size: 3rem;
  font-weight: 900;
  line-height: 1;
  margin-bottom: 4px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  position: relative;
  
  @media (max-width: 768px) {
    font-size: 2.5rem;
  }
`;

export const TokenSymbol = styled.div`
  font-size: 1.1rem;
  font-weight: 600;
  opacity: 0.9;
  letter-spacing: 0.1em;
`;

// Content Components
export const ModalContent = styled.div`
  padding: 24px 20px;
  
  @media (max-width: 768px) {
    padding: 20px 16px;
  }
`;

export const PrizeTitle = styled.h1`
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 12px 0;
  color: ${COLOR_CONFIG.text.primary};
  line-height: 1.3;
  letter-spacing: -0.025em;
`;

// Status and Badge Components
export const StatusContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
`;

export const StatusBadge = styled.span`
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  
  ${props => {
    const styles = STATUS_STYLES[props.$status] || STATUS_STYLES.default;
    return `background: ${styles.background}; color: ${styles.color};`;
  }}
`;

export const PrizeTypeBadge = styled.span`
  padding: 6px 12px;
  background: ${COLOR_CONFIG.primary};
  color: white;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

// Text Components
export const Description = styled.p`
  color: #64748b;
  line-height: 1.6;
  margin-bottom: 32px;
  font-size: 15px;
  font-weight: 400;
`;

// Section Components
export const DetailsSection = styled.div`
  margin-bottom: 20px;
`;

export const SectionTitle = styled.h3`
  font-size: 18px;
  font-weight: 700;
  color: ${COLOR_CONFIG.text.primary};
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  
  &::before {
    content: '';
    width: 3px;
    height: 18px;
    background: ${COLOR_CONFIG.primary};
    border-radius: 2px;
  }
`;

// Grid Components
export const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
`;

export const InfoCard = styled.div`
  background: ${COLOR_CONFIG.background.white};
  padding: 16px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  transition: all 0.2s ease;
  position: relative;
  
  &:hover {
    border-color: #cbd5e1;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

export const InfoLabel = styled.div`
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.025em;
`;

export const InfoValue = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: ${COLOR_CONFIG.text.primary};
  line-height: 1.4;
`;

// Progress Components
export const ProgressSection = styled.div`
  background: ${COLOR_CONFIG.background.white};
  padding: 24px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  margin-bottom: 24px;
`;

export const ProgressBar = styled.div`
  background: #f1f5f9;
  border-radius: 8px;
  height: 8px;
  margin: 16px 0;
  overflow: hidden;
`;

export const ProgressFill = styled.div`
  background: linear-gradient(90deg, ${COLOR_CONFIG.primary} 0%, #8b5cf6 100%);
  height: 100%;
  width: ${props => Math.min(props.$percentage, 100)}%;
  transition: width 0.3s ease;
  border-radius: 8px;
`;

export const ProgressText = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #64748b;
  margin-top: 12px;
  
  span:last-child {
    font-weight: 600;
    color: ${COLOR_CONFIG.primary};
  }
`;

// Participation Components
export const ParticipationSection = styled.div`
  background: ${COLOR_CONFIG.background.white};
  padding: 24px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
`;

export const TicketControls = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
`;

export const QuantityLabel = styled.span`
  font-size: 14px;
  color: #475569;
  font-weight: 500;
  min-width: 70px;
`;

export const QuantityButton = styled.button`
  background: ${COLOR_CONFIG.background.white};
  border: 2px solid ${COLOR_CONFIG.border.default};
  border-radius: ${MODAL_CONFIG.borderRadius.button}px;
  width: ${BUTTON_CONFIG.quantityButton.size}px;
  height: ${BUTTON_CONFIG.quantityButton.size}px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: ${BUTTON_CONFIG.quantityButton.fontSize}px;
  font-weight: 600;
  color: #475569;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    border-color: ${COLOR_CONFIG.border.focus};
    color: ${COLOR_CONFIG.border.focus};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const QuantityInput = styled.input`
  flex: 1;
  padding: ${INPUT_CONFIG.quantity.padding};
  border: 2px solid ${COLOR_CONFIG.border.default};
  border-radius: ${MODAL_CONFIG.borderRadius.input}px;
  font-size: ${INPUT_CONFIG.quantity.fontSize}px;
  text-align: center;
  font-weight: 600;
  color: ${COLOR_CONFIG.text.primary};
  
  &:focus {
    outline: none;
    border-color: ${COLOR_CONFIG.border.focus};
    box-shadow: 0 0 0 3px rgba(105, 48, 195, 0.1);
  }
`;

export const CostSummary = styled.div`
  background: #f8fafc;
  padding: 16px;
  border-radius: ${MODAL_CONFIG.borderRadius.input}px;
  margin-bottom: 16px;
  border: 1px solid #e2e8f0;
`;

export const CostRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
  color: ${COLOR_CONFIG.text.primary};
  
  ${props => props.$isPlatformFee && `
    color: #6b7280;
    font-size: 13px;
  `}
  
  &:last-child {
    margin-bottom: 0;
    padding-top: 8px;
    border-top: 1px solid #e2e8f0;
    font-weight: 600;
    font-size: 16px;
    color: ${COLOR_CONFIG.primary};
  }
`;

export const ParticipateButton = styled.button`
  width: 100%;
  padding: 12px 20px;
  background: ${COLOR_CONFIG.primary};
  color: white;
  border: none;
  border-radius: ${MODAL_CONFIG.borderRadius.button}px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  &:hover:not(:disabled) {
    background: #5a21b6;
    box-shadow: 0 4px 12px rgba(105, 48, 195, 0.3);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

export const LoadingSpinner = styled.div`
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid #ffffff;
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
  margin-right: 8px;
  flex-shrink: 0;
`;

// End State Components
export const EndedSection = styled.div`
  text-align: center;
  padding: ${MODAL_CONFIG.spacing.section}px;
  background: linear-gradient(135deg, ${COLOR_CONFIG.background.card} 0%, ${COLOR_CONFIG.background.muted} 100%);
  border-radius: ${GRID_CONFIG.info.gap}px;
  border: 1px solid ${COLOR_CONFIG.border.default};
`;

export const WinnerInfo = styled.div`
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  padding: ${MODAL_CONFIG.spacing.card}px;
  border-radius: ${MODAL_CONFIG.borderRadius.content}px;
  margin-top: ${GRID_CONFIG.info.gap}px;
`;

// Attributes Components
export const AttributesTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
`;

export const AttributeTag = styled.span`
  background: #f1f5f9;
  color: #475569;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid #e2e8f0;
  transition: all 0.2s ease;
  
  &:hover {
    background: #e2e8f0;
    border-color: #cbd5e1;
  }
`;

// Time Display Components
export const TimeInfo = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(${GRID_CONFIG.time.minWidth}px, 1fr));
  gap: ${GRID_CONFIG.time.gap}px;
  margin-bottom: 20px;
`;

export const TimeCard = styled.div`
  text-align: center;
  padding: ${GRID_CONFIG.info.gap}px;
  background: ${COLOR_CONFIG.background.white};
  border-radius: ${MODAL_CONFIG.borderRadius.input}px;
  border: 1px solid ${COLOR_CONFIG.border.default};
`;

export const TimeValue = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: ${COLOR_CONFIG.primary};
  margin-bottom: 4px;
`;

export const TimeLabel = styled.div`
  font-size: 12px;
  color: ${COLOR_CONFIG.text.muted};
  text-transform: uppercase;
  font-weight: 600;
`; 