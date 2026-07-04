import styled, { keyframes, css } from 'styled-components';

// Animations
export const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(50px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

// CSS for animation when scrolling into view
export const fadeUpIn = css`
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
  
  &.visible {
    opacity: 1;
    transform: translateY(0);
  }
`;

// Main container
export const AboutContainer = styled.div`
  padding: 60px 40px;
  position: relative;
  overflow: hidden;
  color: var(--text-primary);
  border-radius: 20px;
  opacity: 0;
  animation: ${fadeIn} 0.8s ease-out forwards;
  animation-delay: 0.3s;
  z-index: 1;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
    background-color: rgba(0, 0, 0, 0.4);
  }

  @media (max-width: 768px) {
    padding: 40px 20px;
  }
`;

// Background animation wrapper
export const AnimationBackground = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -2;
  opacity: 0.8;
`;

// Main content grid
export const AboutContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  position: relative;
  z-index: 2;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

// Left content section
export const AboutInfo = styled.div`
  padding-top: 40px;
  
  @media (max-width: 768px) {
    padding-top: 0;
    order: 2;
  }
`;

// Title section
export const AboutTitle = styled.div`
  margin-bottom: 30px;
  ${fadeUpIn}
  transition-delay: ${props => props.$delay || '0.1s'};

  h2 {
    color: rgba(255, 255, 255, 0.7);
    font-size: 20px;
    font-weight: 500;
    margin-bottom: 10px;
  }

  h1 {
    font-size: 56px;
    font-weight: 700;
    color: #ffffff;

    @media (max-width: 768px) {
      font-size: 42px;
    }
  }
`;

// Description section
export const AboutDescription = styled.div`
  margin-bottom: 30px;
  ${fadeUpIn}
  transition-delay: ${props => props.$delay || '0.3s'};

  p {
    font-size: 18px;
    line-height: 1.7;
    margin-bottom: 20px;
    color: rgba(255, 255, 255, 0.85);

    @media (max-width: 768px) {
      font-size: 16px;
    }
  }
`;

// Features grid layout
export const FeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  
  @media (max-width: 768px) {
    gap: 20px;
  }
`;

// Individual feature item
export const FeatureItem = styled.div`
  ${fadeUpIn}
  transition-delay: ${props => props.$delay || '0.3s'};

  h3 {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 10px;
    color: #c084fc;

    @media (max-width: 768px) {
      font-size: 18px;
    }
  }

  p {
    font-size: 16px;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.75);

    @media (max-width: 768px) {
      font-size: 14px;
    }
  }
`;

// Character image section
export const CharacterImage = styled.div`
  position: relative;
  height: 100%;
  width: 100%;
  overflow: visible;
  ${fadeUpIn}
  transition-delay: ${props => props.$delay || '0.2s'};
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
  
  img {
    position: relative;
    max-width: min(120%, 800px);
    height: auto;
    object-fit: contain;
    transform: translateX(25%) translateY(10%) scaleX(-1);
    filter: drop-shadow(0 5px 15px rgba(0, 0, 0, 0.3));
  }
  
  @media (max-width: 1200px) {
    img {
      transform: translateX(20%) translateY(10%) scaleX(-1);
    }
  }
  
  @media (max-width: 992px) {
    img {
      transform: translateX(15%) translateY(8%) scaleX(-1);
    }
  }
  
  @media (max-width: 768px) {
    order: 1;
    height: 400px;
    margin-bottom: 20px;
    justify-content: center;
    
    img {
      max-width: 100%;
      max-height: 100%;
      transform: translateY(0) scaleX(-1) scale(0.9);
    }
  }
`; 