import styled, { keyframes } from 'styled-components';

// Colors from P2P2Page theme
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

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
`;

// Main Container - P2P2 style
export const PageContainer = styled.div`
  min-height: 100vh;
  background: transparent;
  font-family: var(--font-primary);
  position: relative;
`;

export const ContentWrapper = styled.div`
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 85px 40px;
  animation: ${fadeInUp} 0.8s ease-out;

  @media (max-width: 1200px) {
    padding: 0 60px 40px;
  }

  @media (max-width: 768px) {
    padding: 0 25px 30px;
  }
`;

// Header
export const PageHeader = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 24px;
  position: relative;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
  }
`;

export const PageTitle = styled.h1`
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-family: var(--font-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: opacity 0.2s ease;
  position: absolute;
  left: 0;

  &:hover {
    opacity: 0.8;
  }

  @media (max-width: 768px) {
    font-size: 1.25rem;
    position: static;
  }

  @media (max-width: 480px) {
    font-size: 1.1rem;
  }
`;

export const BackButton = styled.button`
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
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    transform: translateX(-4px);
  }

  &:active {
    transform: translateX(0);
  }

  @media (max-width: 768px) {
    padding: 10px 20px;
    font-size: 14px;
  }
`;

// Tabs - P2P2 Detail style
export const TabContainer = styled.div`
  display: inline-flex;
  padding: 6px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.12), 0 18px 25px rgba(99, 102, 241, 0.2);
  gap: 6px;
`;

export const TabButton = styled.button`
  min-width: 180px;
  padding: 10px 20px;
  background: ${props => props.$active
    ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 60%, #c084fc 100%)'
    : 'transparent'
  };
  color: ${props => props.$active ? 'white' : '#6b7280'};
  border: none;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: var(--font-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &:hover:not(:disabled) {
    background: ${props => !props.$active
      ? 'rgba(99, 102, 241, 0.08)'
      : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 60%, #c084fc 100%)'
    };
    transform: ${props => props.$active ? 'scale(1.02)' : 'none'};
  }

  &:active {
    transform: scale(0.98);
  }

  @media (max-width: 768px) {
    min-width: 140px;
    padding: 8px 16px;
    font-size: 13px;
  }
`;

export const TabCount = styled.span`
  background: ${props => props.$active
    ? 'rgba(255, 255, 255, 0.3)'
    : 'rgba(105, 48, 195, 0.2)'
  };
  color: ${props => props.$active ? 'white' : COLORS.primary};
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  margin-left: 8px;
  font-weight: 700;
`;

// Offers Grid - P2P2 style
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

// Offer Card
export const OfferCard = styled.div`
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(105, 48, 195, 0.02) 100%);
  border: 2px solid rgba(105, 48, 195, 0.1);
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(105, 48, 195, 0.05);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 20px;
  position: relative;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(105, 48, 195, 0.15);
    border-color: rgba(105, 48, 195, 0.2);
  }
`;

export const StatusBadge = styled.div`
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 6px 12px;
  background: ${props => {
    switch(props.$status) {
      case 'ACTIVE': return 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)';
      case 'ACCEPTED': return 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)';
      case 'EXPIRED': return 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)';
      case 'CANCELLED': return 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';
      default: return 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)';
    }
  }};
  color: white;
  border-radius: 16px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
`;

export const CardHeader = styled.div`
  margin-bottom: 20px;
`;

export const OfferTitle = styled.h3`
  font-size: 18px;
  font-weight: 700;
  color: ${COLORS.text.primary};
  margin: 0 0 8px 0;
  font-family: var(--font-primary);
`;

export const OfferType = styled.div`
  font-size: 14px;
  color: ${COLORS.primary};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

export const AssetsSection = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 20px 0;
  position: relative;
`;

export const AssetBox = styled.div`
  flex: 1;
  text-align: ${props => props.$align || 'left'};
`;

export const AssetLabel = styled.div`
  font-size: 12px;
  color: ${COLORS.text.secondary};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
`;

export const AssetInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: ${props => props.$justify || 'flex-start'};
`;

export const AssetImage = styled.img`
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
  border: 2px solid rgba(105, 48, 195, 0.1);
`;

export const AssetDetails = styled.div`
  text-align: left;
`;

export const AssetName = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: ${COLORS.text.primary};
  margin-bottom: 2px;
`;

export const AssetAmount = styled.div`
  font-size: 13px;
  color: ${COLORS.text.secondary};
  font-weight: 600;
`;

export const SwapArrow = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, ${COLORS.primary} 0%, #8b5cf6 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
  box-shadow: 0 4px 12px rgba(105, 48, 195, 0.3);
  z-index: 1;
`;

export const CardFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(105, 48, 195, 0.1);
`;

export const TimeLeft = styled.div`
  font-size: 13px;
  color: ${props => props.$urgent ? '#ef4444' : COLORS.text.secondary};
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  animation: ${props => props.$urgent ? pulse : 'none'} 2s ease-in-out infinite;
`;

export const OfferDate = styled.div`
  font-size: 12px;
  color: ${COLORS.text.secondary};
  font-weight: 500;
`;

// Empty State
export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
`;

export const EmptyIcon = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(105, 48, 195, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  font-size: 32px;
`;

export const EmptyTitle = styled.h3`
  font-size: 20px;
  font-weight: 700;
  color: ${COLORS.text.primary};
  margin: 0 0 8px 0;
`;

export const EmptyText = styled.p`
  font-size: 14px;
  color: ${COLORS.text.secondary};
  margin: 0 0 24px 0;
  max-width: 400px;
`;

export const CreateOfferButton = styled.button`
  background: linear-gradient(135deg, ${COLORS.primary} 0%, #8b5cf6 100%);
  color: white;
  border: none;
  padding: 14px 32px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: var(--font-primary);
  box-shadow: 0 4px 15px rgba(105, 48, 195, 0.3);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(105, 48, 195, 0.4);
  }

  &:active {
    transform: translateY(0);
  }
`;

// Loading State
export const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
`;

export const LoadingSpinner = styled.div`
  width: 48px;
  height: 48px;
  border: 4px solid #f3f4f6;
  border-top: 4px solid ${COLORS.primary};
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Error State
export const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
`;

export const ErrorTitle = styled.h3`
  font-size: 20px;
  font-weight: 700;
  color: #dc2626;
  margin: 0 0 8px 0;
`;

export const ErrorText = styled.p`
  font-size: 14px;
  color: ${COLORS.text.secondary};
  margin: 0 0 24px 0;
`;

export const RetryButton = styled.button`
  background: linear-gradient(135deg, ${COLORS.primary} 0%, #8b5cf6 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(105, 48, 195, 0.4);
  }
`;