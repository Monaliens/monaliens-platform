import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
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

export const CreateContainer = styled.div`
  min-height: 100vh;
  background: transparent;
  font-family: var(--font-primary);
  position: relative;
  opacity: 0;
  animation: ${fadeIn} 0.8s ease-out forwards;
  animation-delay: 0.1s;
  
  @media (max-width: 768px) {
    position: relative;
    min-height: 100vh;
    overflow: hidden; /* Prevent body scroll when we have our own scroll container */
  }
`;

export const ScrollContainer = styled.div`
  height: 100vh;
  overflow-y: scroll;
  scroll-behavior: smooth;
  margin-top: -100px;
  padding-top: 100px;
  
  @media (max-width: 768px) {
    height: 100vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
  }
`;

export const ContentWrapper = styled.div`
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 85px 40px;
  
  @media (max-width: 768px) {
    padding: 0 25px 100px; /* Increased bottom padding for fixed submit section */
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
  margin-bottom: 40px;
  transition: all 0.2s ease;
  font-family: var(--font-primary);
  
  &:hover {
    color: ${COLORS.primary};
  }
`;

export const StepsContainer = styled.div`
  display: flex;
  align-items: stretch;
  width: 100%;
  height: 480px;
  gap: 32px;
  margin-bottom: 40px;
  
  @media (max-width: 1200px) {
    flex-direction: column;
    min-height: auto;
    gap: 30px;
  }
  
  @media (max-width: 768px) {
    flex-direction: column;
    height: auto;
    gap: 20px;
    margin-bottom: 20px; /* Reduced margin since we have padding on ContentWrapper */
  }
`;

export const StepPanel = styled.div`
  flex: 1;
  flex-grow: 0;
  flex-shrink: 0;
  flex-basis: calc((100% - 96px) / 4);
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 24px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: 0;
  height: 480px;
  min-height: 480px;
  max-height: 480px;
  overflow: visible;
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
  opacity: ${props => props.$isActive ? '1' : '0.7'};
  transform: ${props => props.$isActive ? 'scale(1)' : 'scale(0.98)'};
  transition: all 0.3s ease;
  
  &::before {
    content: '${props => props.$stepNumber}';
    position: absolute;
    top: 24px;
    right: 24px;
    width: 32px;
    height: 32px;
    background: ${props => props.$isActive ? COLORS.primary : '#e2e8f0'};
    color: ${props => props.$isActive ? 'white' : '#64748b'};
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    transition: all 0.3s ease;
  }
  
  @media (max-width: 1200px) {
    flex: 1;
    padding: 24px;
    
    &::before {
      top: 16px;
      right: 16px;
      width: 28px;
      height: 28px;
      font-size: 12px;
    }
  }
  
  @media (max-width: 768px) {
    flex-basis: 100%;
    width: 100%;
    height: auto;
    min-height: auto;
    max-height: none;
    padding: 20px;
    border-radius: 16px;
    
    &::before {
      top: 12px;
      right: 12px;
      width: 26px;
      height: 26px;
      font-size: 12px;
    }
  }
`;

export const StepTitle = styled.h3`
  font-family: var(--font-primary);
  color: #3B82F6;
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 20px 0;
  padding-right: 50px;
  
  @media (max-width: 768px) {
    font-size: 16px;
  }
`;

export const StepContent = styled.div`
  font-family: var(--font-primary);
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  overflow: visible;
  position: relative;
  opacity: ${props => props.$isActive ? '1' : '0.6'};
  transform: ${props => props.$isActive ? 'translateY(0)' : 'translateY(10px)'};
  transition: all 0.4s ease 0.1s;
`;

export const SubmitSection = styled.div`
  padding: 40px;
  display: flex;
  justify-content: center;
  gap: 24px;
  
  @media (max-width: 768px) {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid rgba(105, 48, 195, 0.1);
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
    padding: 16px 20px;
    padding-bottom: calc(16px + env(safe-area-inset-bottom)); /* Safe area for iPhone */
    flex-direction: row;
    gap: 12px;
    z-index: 1000; /* Increased z-index */
    opacity: 1;
    animation: none;
    width: 100%;
    max-width: 100%;
    margin: 0;
  }
`;

export const ActionButton = styled.button`
  font-family: var(--font-primary);
  padding: 18px 40px;
  border: none;
  border-radius: 24px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-width: 180px;
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
  }
  
  @media (max-width: 768px) {
    width: 100%;
    padding: 14px 24px;
  }
`;

export const PrimaryButton = styled(ActionButton)`
  background: transparent;
  border: 2px solid ${COLORS.blue};
  color: ${COLORS.blue};
  padding: 18px 40px;
  border-radius: 24px;
  font-size: 18px;
  font-weight: 600;
  box-shadow: none;

  &:hover:not(:disabled) {
    transform: scale(1.02);
  }

  &:active {
    transform: scale(0.98);
  }

  @media (max-width: 768px) {
    flex: 1;
    padding: 14px 20px;
    font-size: 16px;
    border-radius: 12px;
    min-height: 48px;
  }
`;

export const SecondaryButton = styled(ActionButton)`
  background: white;
  color: ${COLORS.text.primary};
  border: 1px solid rgba(0, 0, 0, 0.1);
  padding: 18px 40px;
  border-radius: 24px;
  font-size: 18px;
  font-weight: 600;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  @media (max-width: 768px) {
    flex: 1;
    padding: 14px 20px;
    font-size: 16px;
    border-radius: 12px;
    min-height: 48px;
  }
`;

export const StatusMessage = styled.div`
  font-family: var(--font-primary);
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 24px;
  font-weight: 600;
  text-align: center;
  
  &.error {
    background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
    border: 2px solid #fecaca;
    color: #dc2626;
  }
  
  &.success {
    background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
    border: 2px solid #bbf7d0;
    color: #16a34a;
  }
`;

// Global input style overrides for child components
export const GlobalInputStyles = styled.div`
  overflow: visible !important;
  /* Override all input fields in child components */
  input[type="text"],
  input[type="number"],
  input[type="email"],
  input:not([type="checkbox"]):not([type="radio"]),
  select,
  textarea {
    height: 42px !important;
    padding: 10px 14px !important;
    font-size: 15px !important;
    border-radius: 10px !important;
    border: 1px solid rgba(0, 0, 0, 0.1) !important;
    background: white !important;
    
    &:focus {
      outline: none !important;
      border-color: #3B82F6 !important;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
    }
    
    @media (max-width: 768px) {
      height: 48px !important;
      padding: 12px 16px !important;
      font-size: 16px !important; /* Prevents iOS zoom */
      border-radius: 12px !important;
    }
  }
  
  /* Labels */
  label {
    font-size: 13px !important;
    font-weight: 500 !important;
    margin-bottom: 4px !important;
    display: block;
    
    @media (max-width: 768px) {
      font-size: 14px !important;
      margin-bottom: 6px !important;
    }
  }
  
  /* Select dropdowns specific */
  select {
    appearance: none;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 10px center;
    background-size: 18px;
    padding-right: 35px !important;
    
    @media (max-width: 768px) {
      background-size: 20px;
      background-position: right 12px center;
      padding-right: 40px !important;
    }
  }
  
  /* Type selector buttons */
  button[type="button"]:not(.unit-button) {
    min-height: 56px !important;
    font-size: 15px !important;
    border-radius: 14px !important;
    
    @media (max-width: 768px) {
      min-height: 48px !important;
      font-size: 15px !important;
    }
  }
  
  /* Keep regular buttons unchanged */
  
  /* Help text */
  small, .help-text {
    font-size: 11px !important;
    color: #6b7280 !important;
    
    @media (max-width: 768px) {
      font-size: 12px !important;
    }
  }
`;