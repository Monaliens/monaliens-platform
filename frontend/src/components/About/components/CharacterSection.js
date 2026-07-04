import React from 'react';
import { CharacterImage } from '../styles';
import nftImage from '../../../assets/images/landing-about-nft.png';

// Character image section component
export const CharacterSection = ({ isVisible, delay, elementRef }) => {
  return (
    <CharacterImage 
      ref={elementRef} 
      className={isVisible ? 'visible' : ''} 
      $delay={delay}
    >
      <img src={nftImage} alt="Monaliens NFT Character" />
    </CharacterImage>
  );
}; 