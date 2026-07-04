import React, { memo, useRef, useState, useEffect } from 'react';
import OfferCard from './OfferCard';
import OfferCardSkeleton from './OfferCardSkeleton';
import {
  LoadingState,
  LoadingSpinner,
  ErrorState,
  RetryButton
} from '../styles';

// Featured horizontal scroll container (RafflePage pattern)
import styled from 'styled-components';

const FeaturedContainer = styled.div`
  margin-bottom: 60px;
`;

const HorizontalScrollGrid = styled.div`
  display: flex;
  gap: 20px;
  overflow-x: auto;
  padding: 20px 0;
  scroll-behavior: smooth;
  scrollbar-width: none;
  -ms-overflow-style: none;
  
  &::-webkit-scrollbar {
    display: none;
  }
  
  /* Featured cards - wider for better image display */
  & > * {
    flex: 0 0 320px;
  }

  @media (max-width: 1200px) {
    gap: 16px;
    & > * {
      flex: 0 0 300px;
    }
  }
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: center;
    gap: 16px;
    overflow-x: visible;
    
    & > * {
      flex: none;
      width: 100%;
      max-width: 350px;
    }
  }
`;

const ScrollNavigation = styled.div`
  position: relative;
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const NavButton = styled.button`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #6b7280;
  z-index: 10;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  
  &:hover {
    background: #f9fafb;
    color: #374151;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: #f3f4f6;
  }
  
  &.left {
    left: -20px;
  }
  
  &.right {
    right: -20px;
  }
`;

/**
 * FeaturedOffersSection - Horizontal scrolling featured offers
 * Clean implementation without container issues
 */
const FeaturedOffersSection = memo(({ offers, loading, error, onRetry, onOfferClick }) => {
  const scrollRef = useRef(null);
  const [showLeftNav, setShowLeftNav] = useState(false);
  const [showRightNav, setShowRightNav] = useState(true);

  const checkScrollButtons = () => {
    if (!scrollRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeftNav(scrollLeft > 0);
    setShowRightNav(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScrollButtons();
    const container = scrollRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollButtons);
      return () => container.removeEventListener('scroll', checkScrollButtons);
    }
  }, [offers]);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -380, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 380, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <FeaturedContainer>
        <HorizontalScrollGrid>
          {[...Array(4)].map((_, idx) => (
            <OfferCardSkeleton key={idx} index={idx} />
          ))}
        </HorizontalScrollGrid>
      </FeaturedContainer>
    );
  }

  if (error) {
    return (
      <FeaturedContainer>
        <ErrorState>
          <h3>Failed to Load Offers</h3>
          <p>{error}</p>
          {onRetry && (
            <RetryButton onClick={onRetry}>
              Try Again
            </RetryButton>
          )}
        </ErrorState>
      </FeaturedContainer>
    );
  }

  if (!offers || offers.length === 0) {
    return (
      <FeaturedContainer>
        <ErrorState>
          <h3>No Active Offers</h3>
          <p>Be the first to create a P2P trade offer!</p>
        </ErrorState>
      </FeaturedContainer>
    );
  }

  // Show first 8 offers as featured
  const featuredOffers = offers.slice(0, 8);

  return (
    <FeaturedContainer>
      <ScrollNavigation>
        {showLeftNav && (
          <NavButton className="left" onClick={scrollLeft}>
            ←
          </NavButton>
        )}
        {showRightNav && (
          <NavButton className="right" onClick={scrollRight}>
            →
          </NavButton>
        )}
        
        <HorizontalScrollGrid ref={scrollRef}>
          {featuredOffers.map((offer, index) => (
            <OfferCard
              key={offer.offerId || offer._id || index}
              offer={offer}
              index={index}
              onClick={onOfferClick}
            />
          ))}
        </HorizontalScrollGrid>
      </ScrollNavigation>
    </FeaturedContainer>
  );
});

FeaturedOffersSection.displayName = 'FeaturedOffersSection';

export default FeaturedOffersSection;