import React, { memo } from 'react';
import styled from 'styled-components';
import { Link, useLocation } from 'react-router-dom';

const LogoContainer = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  font-weight: 700;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  opacity: 1;
  transform: translateZ(0);

  img {
    width: 36px;
    height: 36px;
    margin-right: 10px;
    border-radius: 10px;
  }

  .logo-text {
    white-space: nowrap;

    @media (max-width: 1500px) {
      font-size: 22px;
    }

    @media (max-width: 1300px) {
      font-size: 20px;
    }

    @media (max-width: 768px) {
      display: none;
    }
  }
`;

/**
 * Logo Component
 * Single Responsibility: Display application logo with navigation
 * 
 * @returns {JSX.Element} Rendered logo with link to home
 */
const Logo = memo(() => {
  const location = useLocation();
  
  // Determine page name based on route
  const getPageName = () => {
    if (location.pathname === '/flip' ||
        location.pathname.startsWith('/flip/')) {
      return '/Flip';
    }
    if (location.pathname === '/hilo' ||
        location.pathname.startsWith('/hilo/')) {
      return '/Hi-Lo';
    }
    if (location.pathname === '/dice' ||
        location.pathname.startsWith('/dice/')) {
      return '/Dice';
    }
    if (location.pathname === '/blackjack' ||
        location.pathname.startsWith('/blackjack/')) {
      return '/Blackjack';
    }
    if (location.pathname === '/mines' ||
        location.pathname.startsWith('/mines/')) {
      return '/Mines';
    }
    if (location.pathname === '/limbo' ||
        location.pathname.startsWith('/limbo/')) {
      return '/Limbo';
    }
    if (location.pathname === '/keno' ||
        location.pathname.startsWith('/keno/')) {
      return '/Keno';
    }
    if (location.pathname === '/staking') {
      return '/Staking';
    }
    // Add other page mappings as needed
    return '';
  };

  const pageName = getPageName();

  return (
    <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
      <LogoContainer>
        <img src={require('../../../assets/images/monaliens.jpg')} alt="Monaliens Logo" />
        <div className="logo-text">
          Monaliens{pageName}
        </div>
      </LogoContainer>
    </Link>
  );
});

Logo.displayName = 'Logo';

export default Logo; 
