import React, {
  useCallback,
  useState,
  useEffect,
  useRef,
  useTransition,
  useDeferredValue,
  useMemo,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import useP2P2Api from "./hooks/useP2P2Api";
import FeaturedOffersSection from "./components/FeaturedOffersSection";
import OffersGrid from "./components/OffersGrid";
import ScrollIndicator from "./components/ScrollIndicator";
import { useP2P2Events } from "../../context/P2P2EventsContext";
import {
  PageContainer,
  ScrollContainer,
  ContentWrapper,
  Section,
  HeaderSection,
  PageTitle,
  CreateOfferButton,
  YourOffersButton,
  HowItWorksButton,
  ScrollToTopButton,
} from "./styles";

const P2P2Page = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getOfferById, recentOfferEvents } = useP2P2Events();

  const [pendingOfferId, setPendingOfferId] = useState(() => location.state?.newOfferId || null);
  const [stagedOffers, setStagedOffers] = useState([]);
  const latestEventTimestampRef = useRef(0);
  
  // Two separate API hooks for different sections
  const {
    offers: activeOffers,
    loading: activeLoading,
    error: activeError,
    hasMore: activeHasMore,
    loadingMore: activeLoadingMore,
    refresh: activeRefresh,
    loadMore: activeLoadMore,
  } = useP2P2Api("active");

  const {
    offers: allOffers,
    loading: allLoading,
    error: allError,
    hasMore: allHasMore,
    loadingMore: allLoadingMore,
    refresh: allRefresh,
    loadMore: allLoadMore,
  } = useP2P2Api("by-deadline");

  const selectEventTimestamp = useCallback((event) => {
    if (!event) return 0;
    if (typeof event.receivedAt === "number" && Number.isFinite(event.receivedAt)) {
      return event.receivedAt;
    }
    if (event.timestamp !== undefined && event.timestamp !== null) {
      const numeric = Number(event.timestamp);
      if (Number.isFinite(numeric)) return numeric;
    }
    if (event.createdAt) {
      const ms = new Date(event.createdAt).getTime();
      if (Number.isFinite(ms)) return ms;
    }
    return Date.now();
  }, []);

  const isOfferInDatasets = useCallback((offerId) => {
    if (offerId === undefined || offerId === null) return false;
    const id = String(offerId);

    if (Array.isArray(activeOffers) && activeOffers.some((offer) => String(offer.offerId) === id)) {
      return true;
    }

    if (Array.isArray(allOffers) && allOffers.some((offer) => String(offer.offerId) === id)) {
      return true;
    }

    return stagedOffers.some((offer) => String(offer.offerId) === id);
  }, [activeOffers, allOffers, stagedOffers]);

  const stageOffer = useCallback((offer) => {
    if (!offer || !offer.offerId) return;

    const statusLabel = (offer.statusString || "").toUpperCase();
    const statusCode = Number.isFinite(Number(offer.status)) ? Number(offer.status) : null;
    const isActive = statusLabel
      ? statusLabel === "ACTIVE"
      : statusCode === null || statusCode === 1;

    if (!isActive) return;

    if (isOfferInDatasets(offer.offerId)) return;

    setStagedOffers((prev) => {
      const exists = prev.some((item) => String(item.offerId) === String(offer.offerId));
      if (exists) return prev;
      return [offer, ...prev];
    });
  }, [isOfferInDatasets]);

  const [showHowItWorks, setShowHowItWorks] = useState(true);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const pageContainerRef = useRef(null);

  // React 19/2025 Concurrent Features
  const [isPending, startTransition] = useTransition();

  const newOfferIdFromLocation = location.state?.newOfferId;

  useEffect(() => {
    if (!newOfferIdFromLocation) return;
    setPendingOfferId(newOfferIdFromLocation);
    const state = location.state || {};
    const { newOfferId, ...rest } = state;
    navigate(location.pathname, {
      replace: true,
      state: Object.keys(rest).length ? rest : undefined,
    });
  }, [location.pathname, navigate, newOfferIdFromLocation]);

  useEffect(() => {
    if (!pendingOfferId) return;
    const fallback = getOfferById(pendingOfferId);
    if (fallback) {
      stageOffer(fallback);
      const timestamp = selectEventTimestamp(fallback);
      latestEventTimestampRef.current = Math.max(latestEventTimestampRef.current, timestamp);
      setPendingOfferId(null);
    }
  }, [pendingOfferId, getOfferById, stageOffer, selectEventTimestamp]);

  useEffect(() => {
    if (!Array.isArray(recentOfferEvents) || recentOfferEvents.length === 0) {
      return;
    }

    const processable = [];

    recentOfferEvents.forEach((event) => {
      if (!event || !event.offerId) return;
      const timestamp = selectEventTimestamp(event);
      const isNewer = timestamp > latestEventTimestampRef.current;
      const matchesPending = pendingOfferId && String(event.offerId) === String(pendingOfferId);

      if (!isNewer && !matchesPending) {
        return;
      }

      processable.push({ event, timestamp });
    });

    if (processable.length === 0) {
      return;
    }

    processable
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach(({ event, timestamp }) => {
        latestEventTimestampRef.current = Math.max(latestEventTimestampRef.current, timestamp);
        stageOffer(event);
        if (pendingOfferId && String(event.offerId) === String(pendingOfferId)) {
          setPendingOfferId(null);
        }
      });
  }, [recentOfferEvents, selectEventTimestamp, stageOffer, pendingOfferId]);

  useEffect(() => {
    if (!stagedOffers.length) return;
    setStagedOffers((prev) => prev.filter((offer) => {
      if (!offer || !offer.offerId) return false;
      const id = String(offer.offerId);
      const inActive = Array.isArray(activeOffers) && activeOffers.some((item) => String(item.offerId) === id);
      const inAll = Array.isArray(allOffers) && allOffers.some((item) => String(item.offerId) === id);
      return !(inActive || inAll);
    }));
  }, [activeOffers, allOffers, stagedOffers.length]);

  const mergedActiveOffers = useMemo(() => {
    if (!stagedOffers.length) return activeOffers;
    const base = Array.isArray(activeOffers) ? activeOffers : [];
    const staged = stagedOffers.filter((offer) => {
      if (!offer || !offer.offerId) return false;
      const id = String(offer.offerId);
      return !base.some((item) => String(item.offerId) === id);
    });
    if (!staged.length) return base;
    return [...staged, ...base];
  }, [activeOffers, stagedOffers]);

  const mergedAllOffers = useMemo(() => {
    if (!stagedOffers.length) return allOffers;
    const base = Array.isArray(allOffers) ? allOffers : [];
    const staged = stagedOffers.filter((offer) => {
      if (!offer || !offer.offerId) return false;
      const id = String(offer.offerId);
      return !base.some((item) => String(item.offerId) === id);
    });
    if (!staged.length) return base;
    return [...staged, ...base];
  }, [allOffers, stagedOffers]);

  const deferredActiveOffers = useDeferredValue(mergedActiveOffers);
  const deferredAllOffers = useDeferredValue(mergedAllOffers);

  // Optimized scroll management with better throttling
  useEffect(() => {
    let rafId = null;
    let isThrottling = false;

    const optimizedScrollHandler = () => {
      if (isThrottling) return;

      isThrottling = true;

      rafId = requestAnimationFrame(() => {
        const container = pageContainerRef.current;
        if (!container) {
          isThrottling = false;
          return;
        }

        const scrollTop = container.scrollTop;
        const windowHeight = window.innerHeight;
        const scrollPercentage = scrollTop / windowHeight;

        // Batch DOM updates for better performance
        setShowHowItWorks(scrollPercentage < 0.8 || scrollPercentage >= 1.0);
        setShowScrollToTop(scrollPercentage > 0.3);

        // Reset throttling after a delay
        setTimeout(() => {
          isThrottling = false;
        }, 100); // 10fps throttling for better performance
      });
    };

    const container = pageContainerRef.current;
    if (container) {
      // Use passive listener for better performance
      container.addEventListener("scroll", optimizedScrollHandler, {
        passive: true,
      });

      return () => {
        container.removeEventListener("scroll", optimizedScrollHandler);
        if (rafId) cancelAnimationFrame(rafId);
      };
    }
  }, []);

  const scrollToTop = () => {
    if (pageContainerRef.current) {
      pageContainerRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  const handleOfferClick = useCallback((offer) => {
    if (!offer) return;
    const offerId = offer.offerId || offer._id;
    if (!offerId) return;
    navigate(`/p2p/${offerId}`);
  }, [navigate]);

  const handleActiveRetry = useCallback(() => {
    startTransition(() => {
      activeRefresh();
    });
  }, [activeRefresh, startTransition]);

  const handleAllRetry = useCallback(() => {
    startTransition(() => {
      allRefresh();
    });
  }, [allRefresh, startTransition]);

  const handleCreateOffer = useCallback(() => {
    navigate("/p2p/create");
  }, [navigate]);

  return (
    <PageContainer>
      <ScrollContainer ref={pageContainerRef}>
        {/* Section 1: Featured Offers (Horizontal Scroll) */}
        <Section>
          <ContentWrapper>
            <HeaderSection style={{ marginBottom: '6px' }}>
              <PageTitle>Featured P2P Offers</PageTitle>
              <CreateOfferButton onClick={handleCreateOffer}>
                Create Offer
              </CreateOfferButton>
            </HeaderSection>

            <FeaturedOffersSection
              offers={deferredActiveOffers}
              loading={activeLoading || isPending}
              error={activeError}
              onRetry={handleActiveRetry}
              onOfferClick={handleOfferClick}
            />

            {/* Scroll Indicator */}
            <ScrollIndicator />
          </ContentWrapper>
        </Section>

        {/* Section 2: All Offers (Responsive Grid) */}
        <Section>
          <ContentWrapper>
            <HeaderSection>
              <PageTitle>All P2P Trades</PageTitle>
              <YourOffersButton onClick={() => navigate("/p2p/me")}>
                Your Offers
              </YourOffersButton>
            </HeaderSection>

            <OffersGrid
              offers={deferredAllOffers}
              loading={allLoading || isPending}
              error={allError}
              hasMore={allHasMore}
              loadingMore={allLoadingMore}
              onRetry={handleAllRetry}
              onOfferClick={handleOfferClick}
              onLoadMore={allLoadMore}
              scrollContainerRef={pageContainerRef}
            />
          </ContentWrapper>
        </Section>
      </ScrollContainer>

      {/* Fixed Action Buttons */}
      <HowItWorksButton
        style={{
          opacity: showHowItWorks ? 1 : 0,
          pointerEvents: showHowItWorks ? "auto" : "none",
        }}
        onClick={() => {
          console.log("How P2P Works clicked");
          // TODO: Open P2P documentation or modal
        }}
      >
        how p2p works
      </HowItWorksButton>

      <ScrollToTopButton
        style={{
          opacity: showScrollToTop ? 1 : 0,
          pointerEvents: showScrollToTop ? "auto" : "none",
        }}
        onClick={scrollToTop}
      >
        ↑
      </ScrollToTopButton>
    </PageContainer>
  );
};

export default P2P2Page;
