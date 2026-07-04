import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { Home } from 'lucide-react';
import UnicornScene from '../UnicornScene';

// Styled components
const ComingSoonContainer = styled.div`
  position: relative;
  min-height: 80vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border-radius: 20px;
  overflow: hidden;
  
  /* 🚀 OPTIMIZATION: GPU acceleration */
  transform: translateZ(0);
`;

const AnimationBackground = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  
  /* 🔥 PERFORMANCE: Optimize for empty state */
  &.fallback {
    opacity: 0.3;
  }
  
  &.loading {
    opacity: 0.5;
  }
`;

const ContentWrapper = styled.div`
  position: relative;
  z-index: 2;
  text-align: center;
  padding: 30px;
  border-radius: 15px;
  backdrop-filter: blur(5px);
  max-width: 600px;
  
  /* 🚀 OPTIMIZATION: Better contrast during empty state */
  .fallback & {
    backdrop-filter: blur(8px);
    background: var(--card-bg);
  }
`;

const Title = styled.h1`
  font-size: 42px;
  margin-bottom: 20px;
  color: var(--text-primary);
  font-weight: 700;

  /* 🔥 PERFORMANCE: Text readability during loading */
  .loading & {
    color: var(--text-secondary);
  }

  .fallback & {
    color: var(--text-primary);
    text-shadow: 0 1px 3px rgba(255, 255, 255, 0.1);
  }

  @media (max-width: 768px) {
    font-size: 32px;
  }
`;

const Description = styled.p`
  font-size: 18px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin-bottom: 32px;

  /* 🚀 OPTIMIZATION: Better readability during states */
  .loading & {
    color: var(--text-secondary);
  }

  .fallback & {
    color: var(--text-primary);
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.1);
  }

  @media (max-width: 768px) {
    font-size: 16px;
  }
`;

const HomeButton = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary-hover) 100%);
  color: white;
  text-decoration: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(105, 48, 195, 0.4);
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

/**
 * 🚀 OPTIMIZED ComingSoonPage Component 
 * Low priority animation with graceful degradation
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - Page title
 * @param {string} props.description - Page description
 * @param {string} props.projectId - UnicornStudio project ID for animation
 * @param {string} [props.className] - Additional CSS classes
 * @returns {JSX.Element} Rendered coming soon page
 */
const ComingSoonPage = ({ 
  title, 
  description, 
  projectId,
  className = ''
}) => {
  return (
    <ComingSoonContainer className={className}>
      <AnimationBackground>
        <UnicornScene
          projectId={projectId}
          width="100%"
          height="100%"
          altText={`${title} Animation`}
          priority="low"
          lazyLoad={true}
          maxLoadTime={6000}
          scale={0.9}
          dpi={1}
          fps={24}
          onLoadSuccess={() => {
            console.log(`🎨 ${title} animation loaded`);
          }}
          onLoadError={(error) => {
            console.warn(`⚠️ ${title} animation failed:`, error.message);
          }}
          onFallback={() => {
            console.log(`🎭 ${title} empty state`);
          }}
        />
      </AnimationBackground>
      
      <ContentWrapper>
        <Title>{title}</Title>
        <Description>{description}</Description>
        <HomeButton to="/">
          <Home />
          Back to Home
        </HomeButton>
      </ContentWrapper>
    </ComingSoonContainer>
  );
};

export default ComingSoonPage; 