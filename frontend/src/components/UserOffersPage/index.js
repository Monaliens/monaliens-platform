import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useUserOffers from '../P2P2Page/hooks/useUserOffers';
import OfferCard from '../P2P2Page/components/OfferCard';
import OfferCardSkeleton from '../P2P2Page/components/OfferCardSkeleton';
import {
  PageContainer,
  ContentWrapper,
  PageHeader,
  PageTitle,
  TabContainer,
  TabButton,
  TabCount,
  OffersGrid,
  EmptyState,
  EmptyIcon,
  EmptyTitle,
  EmptyText,
  CreateOfferButton,
  ErrorContainer,
  ErrorTitle,
  ErrorText,
  RetryButton,
} from './styles';

const UserOffersPage = () => {
  const navigate = useNavigate();
  const { myOffers, offersToMe, loading, error, refresh, walletAddress } = useUserOffers();
  const [activeTab, setActiveTab] = useState('created');

  const displayOffers = useMemo(() => {
    return activeTab === 'created' ? myOffers : offersToMe;
  }, [activeTab, myOffers, offersToMe]);

  const handleOfferClick = useCallback((offer) => {
    if (offer && offer.offerId) {
      navigate(`/p2p/${offer.offerId}`);
    }
  }, [navigate]);

  const handleCreateOffer = useCallback(() => {
    navigate('/p2p/create');
  }, [navigate]);

  const handleBackClick = useCallback(() => {
    navigate('/p2p');
  }, [navigate]);

  // Render loading state
  if (loading && !displayOffers.length) {
    return (
      <PageContainer>
        <ContentWrapper>
          <PageHeader>
            <PageTitle onClick={handleBackClick}>
              ← Back to Offers
            </PageTitle>
            <TabContainer>
              <TabButton $active={activeTab === 'created'} onClick={() => setActiveTab('created')}>
                Created by You
                <TabCount $active={activeTab === 'created'}>0</TabCount>
              </TabButton>
              <TabButton $active={activeTab === 'received'} onClick={() => setActiveTab('received')}>
                Offers to You
                <TabCount $active={activeTab === 'received'}>0</TabCount>
              </TabButton>
            </TabContainer>
          </PageHeader>
          <OffersGrid>
            {[...Array(4)].map((_, idx) => (
              <OfferCardSkeleton key={idx} index={idx} />
            ))}
          </OffersGrid>
        </ContentWrapper>
      </PageContainer>
    );
  }

  // Render error state
  if (error && !displayOffers.length) {
    return (
      <PageContainer>
        <ContentWrapper>
          <PageHeader>
            <PageTitle onClick={handleBackClick}>
              ← Back to Offers
            </PageTitle>
            <TabContainer>
              <TabButton $active={activeTab === 'created'} onClick={() => setActiveTab('created')}>
                Created by You
                <TabCount $active={activeTab === 'created'}>0</TabCount>
              </TabButton>
              <TabButton $active={activeTab === 'received'} onClick={() => setActiveTab('received')}>
                Offers to You
                <TabCount $active={activeTab === 'received'}>0</TabCount>
              </TabButton>
            </TabContainer>
          </PageHeader>
          <ErrorContainer>
            <ErrorTitle>Failed to Load Offers</ErrorTitle>
            <ErrorText>{error}</ErrorText>
            <RetryButton onClick={refresh}>Try Again</RetryButton>
          </ErrorContainer>
        </ContentWrapper>
      </PageContainer>
    );
  }

  // Check if wallet is connected
  if (!walletAddress) {
    return (
      <PageContainer>
        <ContentWrapper>
          <PageHeader>
            <PageTitle onClick={handleBackClick}>
              ← Back to Offers
            </PageTitle>
            <TabContainer>
              <TabButton $active={activeTab === 'created'} onClick={() => setActiveTab('created')}>
                Created by You
                <TabCount $active={activeTab === 'created'}>0</TabCount>
              </TabButton>
              <TabButton $active={activeTab === 'received'} onClick={() => setActiveTab('received')}>
                Offers to You
                <TabCount $active={activeTab === 'received'}>0</TabCount>
              </TabButton>
            </TabContainer>
          </PageHeader>
          <EmptyState>
            <EmptyIcon>🔌</EmptyIcon>
            <EmptyTitle>Connect Your Wallet</EmptyTitle>
            <EmptyText>
              Please connect your wallet to view your P2P offers
            </EmptyText>
          </EmptyState>
        </ContentWrapper>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <ContentWrapper>
        <PageHeader>
          <PageTitle onClick={handleBackClick}>
            ← Back to Offers
          </PageTitle>
          <TabContainer>
          <TabButton
            $active={activeTab === 'created'}
            onClick={() => setActiveTab('created')}
          >
            Created by You
            <TabCount $active={activeTab === 'created'}>
              {myOffers.length}
            </TabCount>
          </TabButton>
          <TabButton
            $active={activeTab === 'received'}
            onClick={() => setActiveTab('received')}
          >
            Offers to You
            <TabCount $active={activeTab === 'received'}>
              {offersToMe.length}
            </TabCount>
          </TabButton>
        </TabContainer>
        </PageHeader>

        {displayOffers.length === 0 ? (
          <EmptyState>
            <EmptyIcon>{activeTab === 'created' ? '📝' : '📥'}</EmptyIcon>
            <EmptyTitle>
              {activeTab === 'created'
                ? 'No Offers Created Yet'
                : 'No Offers Received Yet'}
            </EmptyTitle>
            <EmptyText>
              {activeTab === 'created'
                ? 'Create your first P2P offer to start trading'
                : 'You haven\'t received any P2P offers yet'}
            </EmptyText>
            {activeTab === 'created' && (
              <CreateOfferButton onClick={handleCreateOffer}>
                Create Your First Offer
              </CreateOfferButton>
            )}
          </EmptyState>
        ) : (
          <OffersGrid>
            {displayOffers.map((offer, index) => (
              <OfferCard
                key={offer.offerId || offer._id}
                offer={offer}
                index={index}
                onClick={handleOfferClick}
              />
            ))}
          </OffersGrid>
        )}
      </ContentWrapper>
    </PageContainer>
  );
};

export default UserOffersPage;