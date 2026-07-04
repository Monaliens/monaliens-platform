import React from 'react';
import styled, { keyframes, css } from 'styled-components';

// Animations
const dealOutAnimation = keyframes`
  0% {
    transform: translateX(0) translateY(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateX(-150px) translateY(50px) rotate(-10deg);
    opacity: 0;
  }
`;

const pulseAnimation = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
`;

// Styled Components
const DeckContainer = styled.div`
  position: relative;
  width: 90px;
  height: 126px;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 768px) {
    width: 70px;
    height: 98px;
  }
`;

const DeckStack = styled.div`
  position: relative;
  width: 80px;
  height: 112px;
  ${props => props.$dealing && css`animation: ${pulseAnimation} 0.3s ease;`}

  @media (max-width: 768px) {
    width: 65px;
    height: 91px;
  }
`;

// PERFORMANCE FIX: Use attrs for frequently changing transform values
const DeckCard = styled.div.attrs(props => ({
  style: {
    transform: `translateX(${props.$offset * 1}px) translateY(${props.$offset * -1}px)`
  }
}))`
  position: absolute;
  width: 100%;
  height: 100%;
  background: linear-gradient(145deg, #6930c3 0%, #5e2db8 50%, #4a1fa8 100%);
  border: 2px solid #5e2db8;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);

  /* Pattern */
  display: flex;
  align-items: center;
  justify-content: center;

  &::after {
    content: '';
    width: 70%;
    height: 80%;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 5px,
      rgba(255, 255, 255, 0.1) 5px,
      rgba(255, 255, 255, 0.1) 10px
    );
  }

  @media (max-width: 768px) {
    border-radius: 6px;
  }
`;

const DealingCard = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  background: linear-gradient(145deg, #6930c3 0%, #5e2db8 50%, #4a1fa8 100%);
  border: 2px solid #5e2db8;
  border-radius: 8px;
  animation: ${dealOutAnimation} 0.4s ease-out forwards;
  z-index: 10;

  &::after {
    content: '';
    position: absolute;
    top: 10%;
    left: 15%;
    width: 70%;
    height: 80%;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 5px,
      rgba(255, 255, 255, 0.1) 5px,
      rgba(255, 255, 255, 0.1) 10px
    );
  }
`;

const DeckLabel = styled.div`
  position: absolute;
  bottom: -25px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: #9ca3af;
  white-space: nowrap;
  font-weight: 500;

  @media (max-width: 768px) {
    font-size: 10px;
    bottom: -20px;
  }
`;

const Deck = ({ dealing = false, cardsDealt = 0 }) => {
  // Stack of cards (visual representation)
  const stackSize = Math.max(3, 6 - Math.floor(cardsDealt / 4));

  return (
    <DeckContainer>
      <DeckStack $dealing={dealing}>
        {[...Array(stackSize)].map((_, i) => (
          <DeckCard key={i} $offset={stackSize - 1 - i} />
        ))}
        {dealing && <DealingCard />}
      </DeckStack>
      <DeckLabel>DECK</DeckLabel>
    </DeckContainer>
  );
};

export default Deck;
