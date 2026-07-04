import styled, { keyframes } from 'styled-components';
import { COLOR_CONFIG, MODAL_CONFIG, BUTTON_CONFIG, ANIMATION_CONFIG } from '../data/modalConfig';

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

export const slideUp = keyframes`
  from {
    transform: translateY(${ANIMATION_CONFIG.modal.slideDistance});
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

export const slideDown = keyframes`
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(${ANIMATION_CONFIG.modal.slideDistance});
    opacity: 0;
  }
`;

export const pulse = keyframes`
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
`;

export const rotate = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

// Overlay
export const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${MODAL_CONFIG.overlay.background};
  backdrop-filter: ${MODAL_CONFIG.overlay.backdropFilter};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: ${MODAL_CONFIG.zIndex};
  padding: ${MODAL_CONFIG.spacing.large}px;
  animation: ${props => props.$isClosing ? fadeOut : fadeIn} ${ANIMATION_CONFIG.overlay.duration} ease-out;
  
  @media (max-width: 768px) {
    padding: ${MODAL_CONFIG.spacing.medium}px;
    align-items: flex-end;
  }
`;

// Modal Container
export const ModalContainer = styled.div`
  background: ${COLOR_CONFIG.background.white};
  border-radius: ${MODAL_CONFIG.borderRadius.modal}px;
  max-width: ${MODAL_CONFIG.maxWidth}px;
  width: 100%;
  max-height: ${MODAL_CONFIG.maxHeight}vh;
  overflow: hidden;
  box-shadow: ${MODAL_CONFIG.shadow};
  animation: ${props => props.$isClosing ? slideDown : slideUp} ${ANIMATION_CONFIG.modal.duration} ${ANIMATION_CONFIG.modal.easing};
  
  @media (max-width: 768px) {
    max-height: 90vh;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
`;

// Modal Content
export const ModalContent = styled.div`
  max-height: calc(${MODAL_CONFIG.maxHeight}vh - 140px);
  overflow-y: auto;
  padding: ${MODAL_CONFIG.spacing.large}px;
  
  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: ${COLOR_CONFIG.background.muted};
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${COLOR_CONFIG.border.default};
    border-radius: 3px;
    
    &:hover {
      background: ${COLOR_CONFIG.text.muted};
    }
  }
  
  @media (max-width: 768px) {
    padding: ${MODAL_CONFIG.spacing.medium}px;
    max-height: calc(90vh - 140px);
  }
`;

// Form Container
export const FormContainer = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${MODAL_CONFIG.spacing.section}px;
`;

// Bottom Actions
export const ModalFooter = styled.div`
  padding: ${MODAL_CONFIG.spacing.large}px;
  border-top: 1px solid ${COLOR_CONFIG.border.default};
  background: ${COLOR_CONFIG.background.white};
  position: sticky;
  bottom: 0;
  
  @media (max-width: 768px) {
    padding: ${MODAL_CONFIG.spacing.medium}px;
  }
`;

export const ActionButtons = styled.div`
  display: flex;
  gap: ${MODAL_CONFIG.spacing.medium}px;
  justify-content: flex-end;
  
  @media (max-width: 768px) {
    flex-direction: column-reverse;
    gap: ${MODAL_CONFIG.spacing.small}px;
  }
`;

// Primary Button
export const PrimaryButton = styled.button`
  font-family: 'Lexend', sans-serif;
  padding: ${BUTTON_CONFIG.primary.padding};
  min-height: ${BUTTON_CONFIG.primary.minHeight};
  background: ${props => 
    props.disabled 
      ? COLOR_CONFIG.background.muted 
      : props.$loading 
        ? COLOR_CONFIG.primary 
        : COLOR_CONFIG.primaryGradient
  };
  color: ${COLOR_CONFIG.text.white};
  border: none;
  border-radius: ${MODAL_CONFIG.borderRadius.button}px;
  font-size: ${BUTTON_CONFIG.primary.fontSize}px;
  font-weight: ${BUTTON_CONFIG.primary.fontWeight};
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: ${BUTTON_CONFIG.primary.minWidth}px;
  
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(105, 48, 195, 0.3);
  }
  
  &:active:not(:disabled) {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.6;
  }
  
  @media (max-width: 768px) {
    min-height: 48px;
    font-size: 16px;
  }
`;

// Secondary Button
export const SecondaryButton = styled.button`
  font-family: 'Lexend', sans-serif;
  padding: ${BUTTON_CONFIG.secondary.padding};
  min-height: ${BUTTON_CONFIG.secondary.minHeight};
  background: ${COLOR_CONFIG.background.white};
  color: ${COLOR_CONFIG.text.primary};
  border: ${BUTTON_CONFIG.secondary.borderWidth}px solid ${COLOR_CONFIG.border.default};
  border-radius: ${MODAL_CONFIG.borderRadius.button}px;
  font-size: ${BUTTON_CONFIG.secondary.fontSize}px;
  font-weight: ${BUTTON_CONFIG.secondary.fontWeight};
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: ${BUTTON_CONFIG.secondary.minWidth}px;
  
  &:hover:not(:disabled) {
    background: ${COLOR_CONFIG.background.muted};
    border-color: ${COLOR_CONFIG.border.focus};
    transform: translateY(-1px);
  }
  
  &:active:not(:disabled) {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.6;
  }
  
  @media (max-width: 768px) {
    min-height: 48px;
    font-size: 16px;
  }
`;

// Loading Spinner
export const LoadingSpinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: ${rotate} 1s linear infinite;
`;

// Progress Indicator
export const ProgressContainer = styled.div`
  margin-bottom: ${MODAL_CONFIG.spacing.medium}px;
`;

export const ProgressBar = styled.div`
  width: 100%;
  height: 4px;
  background: ${COLOR_CONFIG.background.muted};
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
`;

export const ProgressFill = styled.div`
  height: 100%;
  background: ${COLOR_CONFIG.primaryGradient};
  width: ${props => props.$percentage || 0}%;
  transition: width 0.3s ease;
  border-radius: 2px;
`;

export const ProgressText = styled.div`
  font-family: 'Lexend', sans-serif;
  font-size: 12px;
  color: ${COLOR_CONFIG.text.muted};
  text-align: center;
`;

// Status Messages
export const StatusMessage = styled.div`
  font-family: 'Lexend', sans-serif;
  padding: ${MODAL_CONFIG.spacing.medium}px;
  border-radius: ${MODAL_CONFIG.borderRadius.button}px;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: ${MODAL_CONFIG.spacing.medium}px;
  
  &.success {
    background: rgba(34, 197, 94, 0.1);
    color: #059669;
    border: 1px solid rgba(34, 197, 94, 0.2);
  }
  
  &.error {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
    border: 1px solid rgba(239, 68, 68, 0.2);
  }
  
  &.warning {
    background: rgba(245, 158, 11, 0.1);
    color: #d97706;
    border: 1px solid rgba(245, 158, 11, 0.2);
  }
  
  &.info {
    background: rgba(59, 130, 246, 0.1);
    color: #2563eb;
    border: 1px solid rgba(59, 130, 246, 0.2);
  }
`;

// Validation Error Highlight
export const ValidationErrorHighlight = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border: 2px solid ${COLOR_CONFIG.status.error};
  border-radius: ${MODAL_CONFIG.borderRadius.input}px;
  pointer-events: none;
  animation: ${pulse} 0.5s ease-in-out;
  background: rgba(239, 68, 68, 0.05);
`;

// Mobile Responsive Adjustments
export const MobileOnly = styled.div`
  @media (min-width: 769px) {
    display: none;
  }
`;

export const DesktopOnly = styled.div`
  @media (max-width: 768px) {
    display: none;
  }
`;

// Toast Notification (for mobile)
export const ToastNotification = styled.div`
  font-family: 'Lexend', sans-serif;
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: ${props => 
    props.type === 'success' 
      ? '#059669' 
      : props.type === 'error' 
        ? '#dc2626' 
        : COLOR_CONFIG.primary
  };
  color: white;
  padding: 12px 20px;
  border-radius: ${MODAL_CONFIG.borderRadius.button}px;
  font-size: 14px;
  font-weight: 500;
  z-index: ${MODAL_CONFIG.zIndex + 1};
  animation: ${slideUp} 0.3s ease-out;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-width: 90vw;
  text-align: center;
`;

// Preview Section (if asset is selected)
export const PreviewSection = styled.div`
  background: ${COLOR_CONFIG.background.card};
  border: 1px solid ${COLOR_CONFIG.border.default};
  border-radius: ${MODAL_CONFIG.borderRadius.card}px;
  padding: ${MODAL_CONFIG.spacing.medium}px;
  margin-bottom: ${MODAL_CONFIG.spacing.section}px;
`;

export const PreviewTitle = styled.h4`
  font-family: 'Lexend', sans-serif;
  margin: 0 0 12px 0;
  color: ${COLOR_CONFIG.text.primary};
  font-size: 16px;
  font-weight: 600;
`;

export const PreviewContent = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  
  img {
    width: 60px;
    height: 60px;
    border-radius: ${MODAL_CONFIG.borderRadius.button}px;
    object-fit: cover;
  }
`;

export const PreviewInfo = styled.div`
  font-family: 'Lexend', sans-serif;
  flex: 1;
  
  .name {
    font-weight: 600;
    color: ${COLOR_CONFIG.text.primary};
    margin-bottom: 4px;
  }
  
  .details {
    font-size: 12px;
    color: ${COLOR_CONFIG.text.muted};
  }
`;

// Form Validation Summary
export const ValidationSummary = styled.div`
  background: ${COLOR_CONFIG.background.card};
  border: 1px solid ${COLOR_CONFIG.border.default};
  border-radius: ${MODAL_CONFIG.borderRadius.button}px;
  padding: ${MODAL_CONFIG.spacing.medium}px;
  margin-bottom: ${MODAL_CONFIG.spacing.medium}px;
`;

export const ValidationTitle = styled.h5`
  font-family: 'Lexend', sans-serif;
  margin: 0 0 8px 0;
  color: ${COLOR_CONFIG.text.primary};
  font-size: 14px;
  font-weight: 600;
`;

export const ValidationList = styled.ul`
  font-family: 'Lexend', sans-serif;
  margin: 0;
  padding-left: 16px;
  color: ${COLOR_CONFIG.text.error};
  font-size: 12px;
  
  li {
    margin-bottom: 4px;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
`;

// Step Indicator (for submission process)
export const StepIndicator = styled.div`
  font-family: 'Lexend', sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: ${MODAL_CONFIG.spacing.medium}px;
  font-size: 14px;
  color: ${COLOR_CONFIG.text.muted};
  
  .step-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: ${COLOR_CONFIG.primary};
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
    animation: ${pulse} 2s infinite;
  }
`; 