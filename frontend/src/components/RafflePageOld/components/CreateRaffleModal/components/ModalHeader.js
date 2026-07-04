import React from 'react';
import styled from 'styled-components';
import { COLOR_CONFIG, BUTTON_CONFIG, MODAL_CONFIG } from '../data/modalConfig';

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${MODAL_CONFIG.spacing.large}px;
  border-bottom: 1px solid ${COLOR_CONFIG.border.default};
  position: sticky;
  top: 0;
  background: ${COLOR_CONFIG.background.white};
  z-index: 10;
`;

const Title = styled.h2`
  font-family: 'Lexend', sans-serif;
  margin: 0;
  color: ${COLOR_CONFIG.text.primary};
  font-size: 24px;
  font-weight: 700;
`;

const CloseButton = styled.button`
  width: ${BUTTON_CONFIG.closeButton.size}px;
  height: ${BUTTON_CONFIG.closeButton.size}px;
  border: none;
  border-radius: 50%;
  background: ${BUTTON_CONFIG.closeButton.background};
  color: ${COLOR_CONFIG.text.white};
  font-size: ${BUTTON_CONFIG.closeButton.fontSize}px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    background: ${BUTTON_CONFIG.closeButton.hoverBackground};
    transform: scale(1.05);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

/**
 * Modal header component with title and close button
 * @param {Object} props - Component props
 * @param {string} props.title - Modal title
 * @param {Function} props.onClose - Close handler
 * @param {boolean} props.disabled - Whether close is disabled
 * @returns {JSX.Element} Modal header
 */
export const ModalHeader = ({ 
  title = "Create Raffle",
  onClose,
  disabled = false
}) => {
  return (
    <Header>
      <Title>{title}</Title>
      <CloseButton 
        onClick={onClose} 
        disabled={disabled}
        aria-label="Close modal"
      >
        ×
      </CloseButton>
    </Header>
  );
};

export default ModalHeader; 