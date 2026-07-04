import React, { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import CreateOfferSection from './components/CreateOfferSection';
import {
  PageContainer,
  ContentWrapper,
  HeaderSection,
  BackButton
} from './styles';
import useP2P2Offer from '../P2P2OfferDetailPage/hooks/useP2P2Offer';

/**
 * P2P2CreatePage Component - P2P offer creation page with raffle-like design
 * 
 * @returns {JSX.Element} Rendered P2P2CreatePage
 */
const P2P2CreatePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const targetParam = searchParams.get('target');
  const targetOfferId = useMemo(() => {
    if (!targetParam) return null;
    const normalized = String(targetParam).trim();
    return normalized.length ? normalized : null;
  }, [targetParam]);

  const stateOffer = location.state?.counterOfferSource || null;
  const stateOfferId = useMemo(() => {
    if (!stateOffer) return null;
    const byOfferId = stateOffer.offerId ?? stateOffer.id;
    if (!byOfferId) return null;
    return String(byOfferId);
  }, [stateOffer]);

  const shouldReuseState = Boolean(stateOffer && stateOfferId && (!targetOfferId || stateOfferId === targetOfferId));

  const {
    offer: fetchedOffer,
    loading: offerLoading,
    error: offerError,
    refresh: refreshOffer
  } = useP2P2Offer(targetOfferId, { skipIfMissing: true });

  const effectiveOffer = useMemo(() => {
    if (shouldReuseState && stateOffer) {
      return stateOffer;
    }
    return fetchedOffer || null;
  }, [shouldReuseState, stateOffer, fetchedOffer]);

  const prefillStatus = useMemo(() => {
    if (!targetOfferId) return 'idle';
    if (offerError) return 'error';
    if (!effectiveOffer && offerLoading) return 'loading';
    if (effectiveOffer) return 'ready';
    return 'idle';
  }, [targetOfferId, offerError, offerLoading, effectiveOffer]);

  const prefill = useMemo(() => ({
    targetOfferId,
    sourceOffer: effectiveOffer,
    status: prefillStatus,
    error: offerError,
    refresh: refreshOffer,
    hydratedFromState: shouldReuseState
  }), [targetOfferId, effectiveOffer, prefillStatus, offerError, refreshOffer, shouldReuseState]);

  const handleBack = () => {
    navigate('/p2p');
  };

  return (
    <PageContainer>
      <ContentWrapper>
        <HeaderSection>
          <BackButton onClick={handleBack}>
            ← Back to P2P Offers
          </BackButton>
        </HeaderSection>
        
        <CreateOfferSection counterOfferPrefill={prefill} />
      </ContentWrapper>
    </PageContainer>
  );
};

export default P2P2CreatePage;
