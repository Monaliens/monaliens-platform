import React from 'react';
import UnicornScene from '../UnicornScene';
import { useElementOnScreen } from './hooks/useElementOnScreen';

// Component imports
import { AboutTitle, AboutDescription } from './components/AboutSection';
import { FeaturesGrid } from './components/FeaturesGrid';
import { CharacterSection } from './components/CharacterSection';

// Styled components imports
import {
  AboutContainer,
  AnimationBackground,
  AboutContent,
  AboutInfo
} from './styles';

// Data imports
import { 
  aboutContent, 
  animationDelays, 
  backgroundAnimation 
} from './data/aboutContent';

// Main About component - handles composition only
const About = () => {
  // Track visibility for main sections
  const [titleRef, isTitleVisible] = useElementOnScreen({ threshold: 0.1 });
  const [descRef, isDescVisible] = useElementOnScreen({ threshold: 0.1 });
  const [imageRef, isImageVisible] = useElementOnScreen({ threshold: 0.1 });

  return (
    <AboutContainer>
      {/* Background Animation - 🚀 ASYNC LOADING */}
      <AnimationBackground>
        <UnicornScene
          projectId={backgroundAnimation.projectId}
          width={backgroundAnimation.width}
          height={backgroundAnimation.height}
          scale={backgroundAnimation.scale}
          altText={backgroundAnimation.altText}
          priority="medium"
          lazyLoad={false}
          maxLoadTime={4000}
          dpi={1.2}
          fps={30}
          onLoadSuccess={() => {
            console.log('🎨 About background animation loaded');
          }}
          onLoadError={(error) => {
            console.warn('⚠️ About background failed:', error.message);
          }}
          onFallback={() => {
            // Background empty state
          }}
        />
      </AnimationBackground>

      {/* Main Content */}
      <AboutContent>
        <AboutInfo>
          {/* Title Section */}
          <AboutTitle
            title={aboutContent.title}
            isVisible={isTitleVisible}
            delay={animationDelays.title}
            elementRef={titleRef}
          />

          {/* Description Section */}
          <AboutDescription
            description={aboutContent.description}
            isVisible={isDescVisible}
            delay={animationDelays.description}
            elementRef={descRef}
          />

          {/* Features Grid */}
          <FeaturesGrid
            features={aboutContent.features}
            animationDelays={animationDelays.features}
          />
        </AboutInfo>

        {/* Character Image */}
        <CharacterSection
          isVisible={isImageVisible}
          delay={animationDelays.image}
          elementRef={imageRef}
        />
      </AboutContent>
    </AboutContainer>
  );
};

export default About; 