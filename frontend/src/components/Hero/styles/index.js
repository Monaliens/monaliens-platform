import styled, { keyframes, css } from 'styled-components';
import { COLORS, ANIMATION_TIMING } from '../data/heroContent';
import heroImage from '../../../assets/images/background.png';

// Animation keyframes
export const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const scaleIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

export const cursorBlink = keyframes`
  from, to { opacity: 0; }
  50% { opacity: 1; }
`;

// Main container
export const HeroContainer = styled.div`
  position: relative;
  width: 100%;
  height: 600px;
  overflow: hidden;
  background: linear-gradient(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.1)), url(${heroImage});
  background-size: cover;
  background-position: center;
  border-radius: 20px;
  opacity: 0;
  animation: ${scaleIn} 0.8s ease-out forwards;
  animation-delay: 0.1s;
  
  @media (max-width: 768px) {
    height: 400px;
  }
`;

// Content wrapper
export const HeroContent = styled.div`
  padding: 50px;
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  width: 100%;
  height: 100%;
  
  @media (max-width: 768px) {
    padding: 30px;
  }
`;

// Typography
export const Title = styled.h1`
  font-size: 80px;
  margin: 0 0 10px 0;
  color: var(--text-primary);
  position: relative;

  @media (max-width: 768px) {
    font-size: 48px;
  }
`;

export const Subtitle = styled.p`
  font-size: 26px;
  color: var(--text-primary);
  margin: 0;
  position: relative;

  @media (max-width: 768px) {
    font-size: 18px;
  }
`;

// Text styling components
export const GradientText = styled.span`
  font-weight: 700;
  background: linear-gradient(to right, ${COLORS.creatusOrange}, ${COLORS.creatusRed}, ${COLORS.creatusPurple});
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  text-fill-color: transparent;
  padding: 0 4px;
`;

export const Cursor = styled.span`
  display: inline-block;
  width: 3px;
  height: 1em;
  background-color: var(--text-primary);
  margin-left: 2px;
  animation: ${cursorBlink} 0.8s infinite;
  vertical-align: text-bottom;
`;

// Marketplace buttons
export const MarketplaceButtons = styled.div`
  position: absolute;
  bottom: 50px;
  left: 50px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 15px;
  opacity: 0;
  animation: ${fadeIn} 0.8s ease-out forwards;
  animation-delay: ${ANIMATION_TIMING.marketplaceDelay}ms;

  @media (max-width: 768px) {
    bottom: 20px;
    left: 20px;
    flex-direction: column;
    gap: 10px;
  }
`;

export const MarketplaceButton = styled.a`
  background-color: var(--bg-secondary);
  padding: 10px 15px;
  border-radius: 8px;
  font-weight: 600;
  display: flex;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
  text-decoration: none;
  color: var(--text-primary);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
    text-decoration: none;
    color: var(--text-primary);
  }

  img {
    height: 30px;
    margin-right: 10px;
    border-radius: 8px;
  }

  @media (max-width: 768px) {
    padding: 6px 10px;
    font-size: 11px;
    white-space: nowrap;

    img {
      height: 16px;
      margin-right: 6px;
    }
  }
`;

export const SocialButtonsGroup = styled.div`
  position: absolute;
  bottom: 50px;
  right: 50px;
  display: flex;
  gap: 12px;
  align-items: center;
  opacity: 0;
  animation: ${fadeIn} 0.8s ease-out forwards;
  animation-delay: ${ANIMATION_TIMING.marketplaceDelay}ms;

  @media (max-width: 768px) {
    bottom: 20px;
    right: 20px;
    gap: 8px;
    justify-content: flex-end;
  }
`;

export const SocialButton = styled.a`
  background-color: var(--bg-secondary);
  width: 54px;
  height: 54px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  text-decoration: none;
  padding: 12px;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    ${props => props.$iconType === 'discord' && 'filter: brightness(0) saturate(100%) invert(42%) sepia(93%) saturate(1352%) hue-rotate(215deg) brightness(99%) contrast(91%);'}
    ${props => props.$iconType === 'x' && css`
      filter: brightness(0) saturate(100%);
    `}
  }

  /* X logo - white in dark mode */
  [data-theme="dark"] & {
    img {
      ${props => props.$iconType === 'x' && css`
        filter: brightness(0) saturate(100%) invert(1) !important;
      `}
    }
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
  }

  @media (max-width: 768px) {
    width: 36px;
    height: 36px;
    padding: 7px;
  }
`; 