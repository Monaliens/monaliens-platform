import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { CARD_NAMES, getRandomSuit } from '../utils/constants';

const flipAnimation = keyframes`
  0% { transform: rotateY(0deg); }
  50% { transform: rotateY(90deg); }
  100% { transform: rotateY(0deg); }
`;

const shakeAnimation = keyframes`
  0%, 100% { transform: rotateY(180deg) translateX(0) scale(1); }
  25% { transform: rotateY(180deg) translateX(-4px) scale(1.02); }
  75% { transform: rotateY(180deg) translateX(4px) scale(1.02); }
`;

const revealAnimation = keyframes`
  0% { transform: rotateY(180deg); }
  100% { transform: rotateY(0deg); }
`;

const CardContainer = styled.div`
  perspective: 1000px;
  width: 200px;
  height: 280px;

  @media (max-width: 768px) {
    width: 140px;
    height: 196px;
  }
`;

const CardInner = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.6s ease;

  ${props => props.$isFlipping && !props.$faceDown && css`
    animation: ${flipAnimation} 0.5s ease infinite;
  `}

  ${props => props.$isFlipping && props.$faceDown && css`
    animation: ${shakeAnimation} 1.2s ease-in-out infinite;
  `}

  ${props => props.$isRevealing && css`
    animation: ${revealAnimation} 0.6s ease forwards;
  `}

  ${props => props.$faceDown && !props.$isFlipping && !props.$isRevealing && css`
    transform: rotateY(180deg);
  `}
`;

const CardFace = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  box-shadow: 0 4px 12px var(--shadow-color);
  font-family: 'Georgia', serif;
`;

const CardFront = styled(CardFace)`
  background: var(--bg-card);
  border: 2px solid var(--border-color);
`;

const CardBack = styled(CardFace)`
  background: linear-gradient(145deg, var(--accent-primary) 0%, #5a21b6 100%);
  transform: rotateY(180deg);

  &::before {
    content: '';
    position: absolute;
    width: 80%;
    height: 85%;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
  }
`;

const CardValue = styled.div`
  font-size: 4.5rem;
  font-weight: bold;
  color: ${props => props.$isRed ? 'var(--accent-red)' : 'var(--text-primary)'};
  line-height: 1;

  @media (max-width: 768px) {
    font-size: 3rem;
  }
`;

const CardSuit = styled.div`
  font-size: 3.5rem;
  color: ${props => props.$isRed ? 'var(--accent-red)' : 'var(--text-primary)'};
  margin-top: 0.25rem;

  @media (max-width: 768px) {
    font-size: 2.5rem;
  }
`;

const CardCorner = styled.div`
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 1.3rem;
  color: ${props => props.$isRed ? 'var(--accent-red)' : 'var(--text-primary)'};
  line-height: 1.1;

  ${props => props.$position === 'top' && css`
    top: 12px;
    left: 12px;
  `}

  ${props => props.$position === 'bottom' && css`
    bottom: 12px;
    right: 12px;
    transform: rotate(180deg);
  `}

  @media (max-width: 768px) {
    font-size: 1rem;
  }
`;

const Card = ({ value, suit, faceDown = false, isFlipping = false }) => {
  const [isRevealing, setIsRevealing] = useState(false);
  const prevFaceDownRef = useRef(faceDown);

  const cardName = CARD_NAMES[value] || '?';
  const displaySuit = suit || getRandomSuit();
  const isRed = displaySuit === '♥' || displaySuit === '♦';

  // Detect when card transitions from faceDown to revealed
  useEffect(() => {
    if (prevFaceDownRef.current === true && faceDown === false) {
      // Card was hidden, now revealed - trigger reveal animation
      setIsRevealing(true);
      const timer = setTimeout(() => {
        setIsRevealing(false);
      }, 600); // Match animation duration
      return () => clearTimeout(timer);
    }
    prevFaceDownRef.current = faceDown;
  }, [faceDown]);

  return (
    <CardContainer>
      <CardInner $faceDown={faceDown} $isFlipping={isFlipping} $isRevealing={isRevealing}>
        <CardFront>
          <CardCorner $position="top" $isRed={isRed}>
            <span>{cardName}</span>
            <span>{displaySuit}</span>
          </CardCorner>
          <CardValue $isRed={isRed}>{cardName}</CardValue>
          <CardSuit $isRed={isRed}>{displaySuit}</CardSuit>
          <CardCorner $position="bottom" $isRed={isRed}>
            <span>{cardName}</span>
            <span>{displaySuit}</span>
          </CardCorner>
        </CardFront>
        <CardBack />
      </CardInner>
    </CardContainer>
  );
};

export default Card;
