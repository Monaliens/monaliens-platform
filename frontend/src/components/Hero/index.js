import React from 'react';
import { HeroContainer, HeroContent } from './styles';
import { useTypingAnimation } from './hooks/useTypingAnimation';
import { heroContent } from './data/heroContent';
import TypingTitle from './components/TypingTitle';
import TypingSubtitle from './components/TypingSubtitle';
import MarketplaceButtons from './components/MarketplaceButtons';

// Main Hero component - composition only
const Hero = () => {
  // Get typing animation state
  const {
    currentTitle,
    currentSubtitle,
    showTitleCursor,
    showSubtitleCursor,
    subtitleComplete
  } = useTypingAnimation(heroContent.title, heroContent.subtitle);

  return (
    <HeroContainer>
      <HeroContent>
        <TypingTitle 
          currentTitle={currentTitle}
          showTitleCursor={showTitleCursor}
        />
        <TypingSubtitle 
          currentSubtitle={currentSubtitle}
          showSubtitleCursor={showSubtitleCursor}
          subtitleComplete={subtitleComplete}
        />
      </HeroContent>
      
      <MarketplaceButtons />
    </HeroContainer>
  );
};

export default Hero;