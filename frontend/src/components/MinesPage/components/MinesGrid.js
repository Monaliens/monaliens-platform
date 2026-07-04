import React from 'react';
import styled, { keyframes, css } from 'styled-components';

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
`;

const pop = keyframes`
  0% { transform: scale(0.8); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
`;

const glow = keyframes`
  0%, 100% { box-shadow: 0 0 5px rgba(76, 175, 80, 0.5); }
  50% { box-shadow: 0 0 20px rgba(76, 175, 80, 0.8); }
`;

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(${props => props.size}, 1fr);
  gap: 8px;
  max-width: 400px;
  margin: 0 auto;
  padding: 20px;
  background: var(--game-grid-bg, linear-gradient(135deg, rgba(30, 30, 40, 0.9), rgba(20, 20, 30, 0.95)));
  border-radius: 16px;
  border: 2px solid var(--border-color);

  @media (max-width: 480px) {
    gap: 6px;
    padding: 15px;
    max-width: 320px;
  }
`;

const Tile = styled.button`
  aspect-ratio: 1;
  border: none;
  border-radius: 8px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;

  ${props => props.state === 'hidden' && css`
    background: linear-gradient(135deg, #4a4a5a, #3a3a4a);
    border: 2px solid rgba(255, 255, 255, 0.1);

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, #5a5a6a, #4a4a5a);
      transform: scale(1.05);
      border-color: var(--accent-primary);
    }

    &:active:not(:disabled) {
      transform: scale(0.95);
    }
  `}

  ${props => props.state === 'safe' && css`
    background: linear-gradient(135deg, #4caf50, #388e3c);
    border: 2px solid #66bb6a;
    animation: ${pop} 0.3s ease-out, ${glow} 2s ease-in-out infinite;

    &::after {
      content: '💎';
      font-size: 20px;
    }
  `}

  ${props => props.state === 'mine' && css`
    background: linear-gradient(135deg, #f44336, #c62828);
    border: 2px solid #ef5350;
    animation: ${shake} 0.5s ease-in-out;

    &::after {
      content: '💣';
      font-size: 26px;
    }
  `}

  ${props => props.state === 'mine_revealed' && css`
    background: linear-gradient(135deg, #ffc107, #f9a825);
    border: 2px solid #ffca28;

    &::after {
      content: '💣';
      font-size: 24px;
      opacity: 0.8;
    }
  `}

  @media (max-width: 480px) {
    font-size: 18px;
    border-radius: 6px;

    &::after {
      font-size: 16px !important;
    }
  }
`;

const GridOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: var(--overlay-bg-heavy);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  z-index: 10;
`;

const OverlayText = styled.div`
  color: var(--text-light);
  font-size: 18px;
  font-weight: 600;
  text-align: center;
  padding: 20px;

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: var(--accent-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 15px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const GridWrapper = styled.div`
  position: relative;
`;

const MinesGrid = ({
  gridSize = 25,
  revealedTiles = new Set(),
  minePositions = [],
  onTileClick,
  disabled = false,
  isWaiting = false,
  gameResult = null
}) => {
  const size = Math.sqrt(gridSize);

  const getTileState = (index) => {
    // If game ended and this tile has a mine (and wasn't the hit tile)
    if (gameResult && minePositions.includes(index) && !revealedTiles.has(index)) {
      return 'mine_revealed';
    }

    // If this tile was the mine that was hit
    if (gameResult && !gameResult.won && gameResult.mineHitTile === index) {
      return 'mine';
    }

    // If tile is revealed (safe)
    if (revealedTiles.has(index)) {
      return 'safe';
    }

    return 'hidden';
  };

  return (
    <GridWrapper>
      <GridContainer size={size}>
        {Array.from({ length: gridSize }, (_, index) => (
          <Tile
            key={index}
            state={getTileState(index)}
            disabled={disabled || revealedTiles.has(index) || isWaiting}
            onClick={() => onTileClick?.(index)}
          />
        ))}
      </GridContainer>

      {isWaiting && (
        <GridOverlay>
          <OverlayText>
            <div className="spinner" />
            Waiting for VRF...
          </OverlayText>
        </GridOverlay>
      )}
    </GridWrapper>
  );
};

export default MinesGrid;
