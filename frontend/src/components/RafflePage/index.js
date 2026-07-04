import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingSection from './components/LandingSection';
import AllRafflesSection from './components/AllRafflesSection';
import ScrollIndicator from './components/ScrollIndicator';
import {
  PageContainer,
  ScrollContainer,
  ContentWrapper,
  Section,
  HeaderSection,
  PageTitle,
  CreateRaffleButton,
  HowItWorksButton,
  ScrollToTopButton
} from './styles';

/**
 * RafflePage Component - Modern raffle page with scroll snap sections
 * Features landing section and all raffles section with smooth transitions
 * 
 * @returns {JSX.Element} Rendered RafflePage
 */
const RafflePage = () => {
  const navigate = useNavigate();
  const [showHowItWorks, setShowHowItWorks] = useState(true);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const pageContainerRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!pageContainerRef.current) return;
      
      const scrollTop = pageContainerRef.current.scrollTop;
      const windowHeight = window.innerHeight;
      
      // Control how it works visibility - show immediately in second section
      const scrollPercentage = scrollTop / windowHeight;
      setShowHowItWorks(scrollPercentage < 0.8 || scrollPercentage >= 1.0);
      
      // Control scroll to top button visibility - show when scrolled down
      setShowScrollToTop(scrollPercentage > 0.3);
    };

    const container = pageContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToTop = () => {
    if (pageContainerRef.current) {
      pageContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  const handleCreateRaffle = () => {
    navigate('/raffle/create');
  };

  return (
    <PageContainer>
      <ScrollContainer ref={pageContainerRef}>
        {/* First Section - Ending Soon */}
        <Section>
          <ContentWrapper>
            <HeaderSection>
              <PageTitle>Ending Soon</PageTitle>
              <CreateRaffleButton onClick={handleCreateRaffle}>
                Create Raffle
              </CreateRaffleButton>
            </HeaderSection>
            
            <LandingSection />
            
            <ScrollIndicator />
          </ContentWrapper>
        </Section>

        {/* Second Section - All Raffles */}
        <Section>
          <ContentWrapper>
            <AllRafflesSection />
          </ContentWrapper>
        </Section>
      </ScrollContainer>

      {/* Fixed How It Works Button */}
      <HowItWorksButton 
        style={{ 
          opacity: showHowItWorks ? 1 : 0,
          pointerEvents: showHowItWorks ? 'auto' : 'none'
        }}
        onClick={() => {
          window.open('https://docs.monaliens.xyz/tools/raffle', '_blank');
        }}
      >
        how it works
      </HowItWorksButton>

      {/* Scroll To Top Button */}
      <ScrollToTopButton 
        style={{ 
          opacity: showScrollToTop ? 1 : 0,
          pointerEvents: showScrollToTop ? 'auto' : 'none'
        }}
        onClick={scrollToTop}
      >
        ↑
      </ScrollToTopButton>
    </PageContainer>
  );
};

export default RafflePage;