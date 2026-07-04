import React, { memo, useRef, useState, useEffect } from 'react';
import OfferCard from './OfferCard';
import {
  ThreeCardGrid as GridContainer,
  NavigationArrow,
  LoadingState,
  LoadingSpinner,
  ErrorState,
  RetryButton
} from '../styles';

const ThreeCardGrid = memo(({ offers, loading, error, onRetry, onOfferClick }) => {
  const scrollContainerRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const checkScrollButtons = () => {
    if (!scrollContainerRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScrollButtons();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollButtons);
      return () => container.removeEventListener('scroll', checkScrollButtons);
    }
  }, [offers]);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -280, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 280, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <LoadingState>
        <LoadingSpinner />
        Loading latest offers...
      </LoadingState>
    );
  }

  if (error) {
    return (
      <ErrorState>
        <h3>Failed to Load Offers</h3>
        <p>{error}</p>
        {onRetry && (
          <RetryButton onClick={onRetry}>
            Try Again
          </RetryButton>
        )}
      </ErrorState>
    );
  }

  if (!offers || offers.length === 0) {
    return (
      <ErrorState>
        <h3>No Active Offers</h3>
        <p>Be the first to create a P2P trade offer!</p>
      </ErrorState>
    );
  }

  // Show all offers
  const displayOffers = offers;

  return (
    <GridContainer>
      {showLeftArrow && (
        <NavigationArrow className="left" onClick={scrollLeft}>
          ←
        </NavigationArrow>
      )}
      {showRightArrow && (
        <NavigationArrow className="right" onClick={scrollRight}>
          →
        </NavigationArrow>
      )}
      <div className="grid-container" ref={scrollContainerRef}>
        {displayOffers.map((offer, index) => (
          <OfferCard
            key={offer.offerId || offer._id || index}
            offer={offer}
            index={index}
            onClick={onOfferClick}
          />
        ))}
      </div>
    </GridContainer>
  );
});

ThreeCardGrid.displayName = 'ThreeCardGrid';

export default ThreeCardGrid;