import React from 'react';
import { GRID_SIZE } from '../utils/constants';
import {
  GridContainer,
  NumberTile,
  DrawOrder
} from '../styles/KenoStyles';

const KenoGrid = ({
  onNumberClick,
  getNumberState,
  getDrawOrder,
  disabled = false
}) => {
  const numbers = Array.from({ length: GRID_SIZE }, (_, i) => i + 1);

  return (
    <GridContainer>
      {numbers.map((num) => {
        const state = getNumberState(num);
        const drawOrder = getDrawOrder(num);

        return (
          <NumberTile
            key={num}
            $state={state}
            onClick={() => onNumberClick(num)}
            disabled={disabled || state === 'drawn' || state === 'hit'}
          >
            {num}
            {drawOrder && <DrawOrder>{drawOrder}</DrawOrder>}
          </NumberTile>
        );
      })}
    </GridContainer>
  );
};

export default KenoGrid;
