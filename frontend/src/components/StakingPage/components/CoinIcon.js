import React from 'react';
import styled, { keyframes } from 'styled-components';

const float = keyframes`
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-3px);
  }
`;

const CoinWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  animation: ${float} 2s ease-in-out infinite;
`;

const CoinImage = styled.img`
  width: ${props => props.size}px;
  height: ${props => props.size}px;
  object-fit: contain;
`;

const CoinIcon = ({ size = 14 }) => {
  return (
    <CoinWrapper>
      <CoinImage
        src="/images/lmonphoto.png"
        alt="LMON"
        size={size}
      />
    </CoinWrapper>
  );
};

export default CoinIcon;
