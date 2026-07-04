import React from 'react';
import styled, { keyframes, css } from 'styled-components';
import { getCardDisplay, getCardSuit } from '../utils/constants';

// Animations - Card flies from deck to position
// Player cards: deck is top-right, cards go to bottom-center (come from top-right)
const dealAnimationPlayer = keyframes`
  0% {
    transform: translateX(320px) translateY(-180px) rotate(20deg) scale(0.85);
    opacity: 0.3;
  }
  15% {
    opacity: 1;
  }
  70% {
    transform: translateX(15px) translateY(-8px) rotate(2deg) scale(0.98);
  }
  100% {
    transform: translateX(0) translateY(0) rotate(0deg) scale(1);
    opacity: 1;
  }
`;

// Dealer cards: deck is to the right, cards go to top-center (come from right)
const dealAnimationDealer = keyframes`
  0% {
    transform: translateX(280px) translateY(30px) rotate(-15deg) scale(0.85);
    opacity: 0.3;
  }
  15% {
    opacity: 1;
  }
  70% {
    transform: translateX(15px) translateY(3px) rotate(-1deg) scale(0.98);
  }
  100% {
    transform: translateX(0) translateY(0) rotate(0deg) scale(1);
    opacity: 1;
  }
`;

const flipAnimation = keyframes`
  0% { transform: rotateY(180deg); }
  100% { transform: rotateY(0deg); }
`;

const shakeAnimation = keyframes`
  0%, 100% { transform: rotateY(180deg) translateX(0); }
  25% { transform: rotateY(180deg) translateX(-3px); }
  75% { transform: rotateY(180deg) translateX(3px); }
`;

const glowAnimation = keyframes`
  0%, 100% { box-shadow: 0 4px 15px var(--shadow-color); }
  50% { box-shadow: 0 4px 25px var(--border-color); }
`;

// Styled Components
const CardWrapper = styled.div`
  width: ${props => props.$size === 'small' ? '60px' : '80px'};
  height: ${props => props.$size === 'small' ? '84px' : '112px'};
  perspective: 1000px;
  margin: 0 -15px;
  z-index: ${props => props.$index || 0};
  ${props => props.$isNew && props.$isDealer && css`
    animation: ${dealAnimationDealer} 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  `}
  ${props => props.$isNew && !props.$isDealer && css`
    animation: ${dealAnimationPlayer} 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  `}

  @media (max-width: 768px) {
    width: ${props => props.$size === 'small' ? '50px' : '65px'};
    height: ${props => props.$size === 'small' ? '70px' : '91px'};
    margin: 0 -12px;
  }
`;

const CardInner = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.5s ease;
  transform: ${props => props.$faceDown ? 'rotateY(180deg)' : 'rotateY(0)'};
  ${props => props.$faceDown && props.$shake && css`animation: ${shakeAnimation} 1.5s ease-in-out infinite;`}
  ${props => props.$revealing && css`animation: ${flipAnimation} 0.5s ease-out forwards;`}
`;

const CardFace = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);

  @media (max-width: 768px) {
    border-radius: 6px;
  }
`;

const CardFront = styled(CardFace)`
  background: linear-gradient(145deg, var(--bg-card) 0%, var(--bg-secondary) 100%);
  border: 2px solid var(--border-color);
  padding: 4px;
  overflow: hidden;
  animation: ${props => props.$highlight ? css`${glowAnimation} 1.5s ease-in-out infinite` : 'none'};

  @media (max-width: 768px) {
    padding: 3px;
  }
`;

// Hidden front for face-down cards (placeholder for 3D flip)
const CardFrontHidden = styled(CardFace)`
  background: transparent;
  border: none;
`;

const CardBack = styled(CardFace)`
  background: linear-gradient(145deg, var(--accent-primary) 0%, #5e2db8 50%, #4a1fa8 100%);
  border: 2px solid #5e2db8;
  transform: rotateY(180deg);
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
`;

const Corner = styled.div`
  display: flex;
  flex-direction: column;
  align-items: ${props => props.$position === 'top' ? 'flex-start' : 'flex-end'};
  transform: ${props => props.$position === 'bottom' ? 'rotate(180deg)' : 'none'};
`;

const CardValue = styled.span`
  font-family: 'Georgia', serif;
  font-size: ${props => props.$size === 'small' ? '12px' : '14px'};
  font-weight: bold;
  color: ${props => props.$isRed ? 'var(--accent-red)' : 'var(--text-primary)'};
  line-height: 1;

  @media (max-width: 768px) {
    font-size: ${props => props.$size === 'small' ? '10px' : '12px'};
  }
`;

const CardSuitSmall = styled.span`
  font-size: ${props => props.$size === 'small' ? '10px' : '11px'};
  color: ${props => props.$isRed ? 'var(--accent-red)' : 'var(--text-primary)'};
  line-height: 1;

  @media (max-width: 768px) {
    font-size: ${props => props.$size === 'small' ? '8px' : '10px'};
  }
`;

const CenterSuit = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${props => props.$size === 'small' ? '24px' : '30px'};
  color: ${props => props.$isRed ? 'var(--accent-red)' : 'var(--text-primary)'};

  @media (max-width: 768px) {
    font-size: ${props => props.$size === 'small' ? '18px' : '24px'};
  }
`;

// Suit symbols
const getSuitSymbol = (suit) => {
  switch (suit) {
    case 'hearts': return '♥';
    case 'diamonds': return '♦';
    case 'clubs': return '♣';
    case 'spades':
    default: return '♠';
  }
};

const isRedSuit = (suit) => suit === 'hearts' || suit === 'diamonds';

const Card = ({
  value,
  suit,
  gameId,
  cardIndex,
  faceDown = false,
  isNew = false,
  revealing = false,
  shake = false,
  highlight = false,
  size = 'normal',
  index = 0,
  isDealer = false
}) => {
  // Determine suit from gameId and cardIndex if not provided
  const actualSuit = suit || (gameId && cardIndex !== undefined ? getCardSuit(gameId, cardIndex) : 'spades');
  const suitSymbol = getSuitSymbol(actualSuit);
  const isRed = isRedSuit(actualSuit);
  const displayValue = getCardDisplay(value);

  return (
    <CardWrapper $size={size} $isNew={isNew} $index={index} $isDealer={isDealer}>
      <CardInner $faceDown={faceDown} $shake={shake} $revealing={revealing}>
        {!faceDown && (
          <CardFront $highlight={highlight} $size={size}>
            <Corner $position="top">
              <CardValue $isRed={isRed} $size={size}>{displayValue}</CardValue>
              <CardSuitSmall $isRed={isRed} $size={size}>{suitSymbol}</CardSuitSmall>
            </Corner>
            <CenterSuit $isRed={isRed} $size={size}>{suitSymbol}</CenterSuit>
            <Corner $position="bottom">
              <CardValue $isRed={isRed} $size={size}>{displayValue}</CardValue>
              <CardSuitSmall $isRed={isRed} $size={size}>{suitSymbol}</CardSuitSmall>
            </Corner>
          </CardFront>
        )}
        {faceDown && <CardFrontHidden />}
        <CardBack />
      </CardInner>
    </CardWrapper>
  );
};

export default Card;
