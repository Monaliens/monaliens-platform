import React, { memo, useEffect, useRef } from "react";
import OfferCard from "./OfferCard";
import OfferCardSkeleton from "./OfferCardSkeleton";
import {
  OffersGrid as GridContainer,
  LoadingState,
  LoadingSpinner,
  ErrorState,
  RetryButton,
  LoadMoreTrigger,
} from "../styles";

/**
 * OffersGrid Component - Responsive grid layout for offers
 * Uses RafflePage-style responsive grid instead of horizontal scroll
 *
 * @param {Object} props - Component props
 * @param {Array} props.offers - Array of offers to display
 * @param {boolean} props.loading - Loading state
 * @param {string} props.error - Error message
 * @param {Function} props.onRetry - Retry function
 * @param {Function} props.onOfferClick - Offer click handler
 * @param {Object} props.scrollContainerRef - Reference to scroll container
 * @returns {JSX.Element} Rendered offers grid
 */
const OffersGrid = memo(
  ({
    offers,
    loading,
    error,
    hasMore,
    loadingMore,
    onRetry,
    onOfferClick,
    onLoadMore,
    scrollContainerRef,
  }) => {
    const loadingRef = useRef(null);

    // IntersectionObserver for infinite scroll
    const scrollRoot = scrollContainerRef?.current || null;

    useEffect(() => {
      if (!hasMore || loadingMore || loading || !onLoadMore) return;

      const loadingElement = loadingRef.current;
      if (!loadingElement) return;

      let observerTriggered = false;

      const callback = (entries) => {
        const target = entries[0];
        if (target.isIntersecting && !observerTriggered) {
          observerTriggered = true;
          onLoadMore();
        } else if (!target.isIntersecting && observerTriggered) {
          observerTriggered = false;
        }
      };

      const observer = new IntersectionObserver(callback, {
        root: scrollRoot,
        threshold: 0,
        rootMargin: "200px 0px 200px 0px",
      });

      observer.observe(loadingElement);

      return () => {
        observer.unobserve(loadingElement);
        observer.disconnect();
      };
    }, [hasMore, loadingMore, loading, onLoadMore, scrollRoot]);

    useEffect(() => {
      if (typeof window === "undefined") return undefined;
      if (!hasMore || loadingMore || loading || !onLoadMore) return undefined;

      const scrollElement = scrollRoot;
      const scrollTarget = scrollElement || window;
      let rafId = null;
      let triggered = false;

      const checkPosition = () => {
        if (!hasMore || loadingMore || loading) {
          triggered = false;
          return;
        }

        let scrollTop;
        let scrollHeight;
        let clientHeight;

        if (scrollElement) {
          scrollTop = scrollElement.scrollTop;
          scrollHeight = scrollElement.scrollHeight;
          clientHeight = scrollElement.clientHeight;
        } else {
          const doc = document.documentElement;
          scrollTop = window.pageYOffset || doc.scrollTop;
          scrollHeight = doc.scrollHeight;
          clientHeight = window.innerHeight;
        }

        const distanceToBottom = scrollHeight - (scrollTop + clientHeight);

        if (distanceToBottom <= 240) {
          if (!triggered) {
            triggered = true;
            onLoadMore();
          }
        } else if (triggered) {
          triggered = false;
        }
      };

      const handleScroll = () => {
        if (rafId) return;
        rafId = window.requestAnimationFrame(() => {
          rafId = null;
          checkPosition();
        });
      };

      checkPosition();
      scrollTarget.addEventListener("scroll", handleScroll, { passive: true });

      return () => {
        scrollTarget.removeEventListener("scroll", handleScroll);
        if (rafId) {
          window.cancelAnimationFrame(rafId);
        }
      };
    }, [hasMore, loadingMore, loading, onLoadMore, scrollRoot]);
    if (loading) {
      return (
        <GridContainer>
          {[...Array(8)].map((_, idx) => (
            <OfferCardSkeleton key={idx} index={idx} />
          ))}
        </GridContainer>
      );
    }

    if (error) {
      return (
        <ErrorState>
          <h3>Failed to Load Offers</h3>
          <p>{error}</p>
          {onRetry && <RetryButton onClick={onRetry}>Try Again</RetryButton>}
        </ErrorState>
      );
    }

    if (!offers || offers.length === 0) {
      return (
        <ErrorState>
          <h3>No Offers Available</h3>
          <p>Be the first to create a P2P trade offer!</p>
        </ErrorState>
      );
    }

    return (
      <GridContainer>
        {offers.map((offer, index) => (
          <OfferCard
            key={offer.offerId || offer._id || index}
            offer={offer}
            index={index}
            onClick={onOfferClick}
          />
        ))}

        {/* Loading trigger element for infinite scroll */}
        {hasMore && loadingMore && (
          <>
            {[...Array(4)].map((_, idx) => (
              <OfferCardSkeleton key={`loading-${idx}`} index={offers.length + idx} />
            ))}
          </>
        )}

        {hasMore && <LoadMoreTrigger ref={loadingRef} />}
      </GridContainer>
    );
  },
);

OffersGrid.displayName = "OffersGrid";

export default OffersGrid;
