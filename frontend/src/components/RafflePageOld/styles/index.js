import styled, { keyframes } from 'styled-components';

// Animation keyframes
export const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

export const slideUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(40px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

// Main containers
export const RafflePageContainer = styled.div`
  width: 100%;
  min-height: 100vh;
  padding: 3rem 1rem;
  position: relative;
  overflow: visible;
  opacity: 0;
  animation: ${fadeIn} 0.8s ease-out forwards;
  animation-delay: 0.1s;
  
  @media (min-width: 768px) {
    padding: 4rem 2rem;
  }
  
  @media (min-width: 1200px) {
    padding: 5rem 3rem;
  }
`;

export const ContentWrapper = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  opacity: 0;
  animation: ${slideUp} 0.8s ease-out forwards;
  animation-delay: 0.5s;
`;

// Header section
export const RaffleHeader = styled.div`
  text-align: center;
  margin-bottom: 4rem;
  position: relative;
  z-index: 1;
  
  h2 {
    font-size: 2.2rem;
    font-weight: 800;
    margin-bottom: 1.5rem;
    background: linear-gradient(90deg, #6930c3 0%, #8e44ad 50%, #6930c3 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-transform: uppercase;
    letter-spacing: 2px;
    animation: gradientShift 8s linear infinite;
    background-size: 200% auto;
    text-shadow: 0 5px 15px rgba(105, 48, 195, 0.2);
    
    @media (min-width: 768px) {
      font-size: 3rem;
    }
    
    @keyframes gradientShift {
      0% { background-position: 0% center; }
      100% { background-position: 200% center; }
    }
  }
  
  p {
    font-size: 1.1rem;
    color: #666;
    margin-bottom: 2rem;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
    line-height: 1.6;
  }
`;

// Action buttons
export const ActionButtons = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 3rem;
  flex-wrap: wrap;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: center;
  }
`;

export const ActionButton = styled.button`
  background: linear-gradient(135deg, #6930c3 0%, #8e44ad 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 30px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: opacity 0.2s ease;
  box-shadow: 0 4px 15px rgba(105, 48, 195, 0.3);
  
  &:hover:not(:disabled) {
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

// Warning components
export const WalletWarning = styled.div`
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 2px solid #e2e8f0;
  color: #475569;
  padding: 1.5rem;
  border-radius: 16px;
  margin-bottom: 2rem;
  text-align: center;
  font-weight: 500;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #6930c3 0%, #8b5cf6 100%);
  }
  
  p {
    margin-bottom: 1rem;
    font-size: 1.1rem;
    line-height: 1.5;
  }
  
  @media (max-width: 768px) {
    padding: 1.25rem;
    margin-bottom: 1.5rem;
    
    p {
      font-size: 1rem;
    }
  }
`;

// Loading states
export const LoadingContainer = styled.div`
  text-align: center;
  padding: 4rem 0;
  
  h2 {
    color: #666;
    font-size: 1.5rem;
  }
`;

// Page transition animations
const slideInFromRight = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const slideOutToRight = keyframes`
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
`;

const slideInFromLeft = keyframes`
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const slideOutToLeft = keyframes`
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(-100%);
    opacity: 0;
  }
`;

// Page transition container
export const PageTransition = styled.div`
  width: 100%;
  animation: ${props => {
    if (props.$slideDirection === 'enter-right') return slideInFromRight;
    if (props.$slideDirection === 'exit-right') return slideOutToRight;
    if (props.$slideDirection === 'enter-left') return slideInFromLeft;
    if (props.$slideDirection === 'exit-left') return slideOutToLeft;
    return slideInFromRight;
  }} 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
`; 