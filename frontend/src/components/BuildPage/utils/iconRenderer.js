import React from 'react';

// Import PNG icons
import alienIcon from '../../../assets/icons/alien-icon.png';
import mouthIcon from '../../../assets/icons/mouth-icon.png';
import clothesIcon from '../../../assets/icons/clothes-icon.png';
import handsIcon from '../../../assets/icons/hands-icon.png';
import backgroundIcon from '../../../assets/icons/background-icon.png';

// Icon rendering utility
export const renderIcon = (type) => {
  const iconStyle = {
    width: '18px',
    height: '18px',
    objectFit: 'contain'
  };

  switch (type) {
    case 'background':
      return (
        <img 
          src={backgroundIcon} 
          alt="Background" 
          style={iconStyle}
        />
      );
    case 'head':
      return (
        <img 
          src={alienIcon} 
          alt="Head" 
          style={iconStyle}
        />
      );
    case 'eyes':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
        </svg>
      );
    case 'mouth':
      return (
        <img 
          src={mouthIcon} 
          alt="Mouth" 
          style={iconStyle}
        />
      );
    case 'clothes':
      return (
        <img 
          src={clothesIcon} 
          alt="Clothes" 
          style={iconStyle}
        />
      );
    case 'hands':
      return (
        <img 
          src={handsIcon} 
          alt="Hands" 
          style={iconStyle}
        />
      );
    case 'body':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      );
    default:
      return null;
  }
}; 