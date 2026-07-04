import React, { memo } from 'react';
import styled, { keyframes } from 'styled-components';

// Animations
const slideInRight = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const fadeOut = keyframes`
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
`;

// Toast Container
const ToastContainer = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  pointer-events: none; /* Allow clicks to pass through container */
  
  /* Ensure it's not contained by any parent */
  transform: translateZ(0);
`;

// Toast Component
const Toast = styled.div`
  background-color: ${props => 
    props.$type === 'error' ? '#b91c1c' : 
    props.$type === 'success' ? '#16a34a' : 
    '#333'
  };
  color: white;
  padding: 12px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-width: 350px;
  min-width: 250px;
  animation: ${slideInRight} 0.3s ease-out, ${fadeOut} 0.3s ease-in forwards;
  animation-delay: 0s, 4.7s;
  display: flex;
  align-items: center;
  font-family: 'Lexend', sans-serif;
  font-size: 14px;
  font-weight: 500;
  pointer-events: auto; /* Re-enable pointer events for individual toasts */
  
`;

/**
 * RaffleToast Component
 * Single Responsibility: Display toast notifications for raffle operations
 * 
 * @param {Array} toasts - Array of toast objects {id, message, type}
 * @returns {JSX.Element} Rendered toast notifications
 */
const RaffleToast = memo(({ toasts }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <ToastContainer>
      {toasts.map(toast => (
        <Toast 
          key={toast.id} 
          $type={toast.type}
        >
          {toast.message}
        </Toast>
      ))}
    </ToastContainer>
  );
});

RaffleToast.displayName = 'RaffleToast';

export default RaffleToast;