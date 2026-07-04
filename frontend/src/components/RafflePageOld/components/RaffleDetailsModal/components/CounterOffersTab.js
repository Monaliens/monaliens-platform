import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

// Counter Offers API call
const fetchCounterOffers = async (raffleId) => {
  try {
    const response = await fetch(`${process.env.REACT_APP_P2P_API_URL || 'https://your-p2p-api.example.com'}/api/offers/${raffleId}/children`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching counter offers:', error);
    return [];
  }
};

// Styled Components
const CounterOffersContainer = styled.div`
  padding: 24px;
  min-height: 400px;
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: #64748b;
  font-size: 0.9rem;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: #64748b;
  text-align: center;
  
  .icon {
    font-size: 3rem;
    margin-bottom: 16px;
    opacity: 0.5;
  }
  
  .title {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 8px;
    color: #1e293b;
  }
  
  .description {
    font-size: 0.9rem;
    line-height: 1.5;
  }
`;

const CounterOffersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const CounterOfferCard = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #6930c3;
    box-shadow: 0 4px 12px rgba(105, 48, 195, 0.1);
    transform: translateY(-2px);
  }
`;

const CounterOfferHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const CounterOfferTitle = styled.h3`
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
`;

const CounterOfferStatus = styled.span`
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: ${props => {
    switch (props.$status) {
      case 1: return '#10b981';
      case 2: return '#f59e0b';
      case 3: return '#6b7280';
      default: return '#8b5cf6';
    }
  }};
  color: white;
`;

const CounterOfferInfo = styled.div`
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 12px;
  }
`;

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  
  .label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .value {
    font-size: 0.9rem;
    font-weight: 600;
    color: #1e293b;
    font-family: 'Monaco', 'Menlo', monospace;
  }
`;

const CounterOfferDescription = styled.p`
  font-size: 0.9rem;
  color: #64748b;
  line-height: 1.5;
  margin: 0 0 16px 0;
  font-style: italic;
`;

const AssetsSection = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const AssetGroup = styled.div`
  .title {
    font-size: 0.8rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }
  
  .assets {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
`;

const AssetTag = styled.div`
  background: ${props => props.$type === 'offered' ? 'rgba(105, 48, 195, 0.1)' : 'rgba(16, 185, 129, 0.1)'};
  border: 1px solid ${props => props.$type === 'offered' ? 'rgba(105, 48, 195, 0.2)' : 'rgba(16, 185, 129, 0.2)'};
  color: ${props => props.$type === 'offered' ? '#6930c3' : '#10b981'};
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
`;

const CounterOffersTab = ({ raffleId }) => {
  const [counterOffers, setCounterOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadCounterOffers = async () => {
      if (!raffleId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        console.log('🔍 Fetching counter offers for raffle:', raffleId);
        const offers = await fetchCounterOffers(raffleId);
        console.log('📊 Counter offers received:', offers);
        setCounterOffers(offers || []);
      } catch (err) {
        console.error('❌ Error loading counter offers:', err);
        setError(err.message);
        setCounterOffers([]);
      } finally {
        setLoading(false);
      }
    };

    loadCounterOffers();
  }, [raffleId]);

  const getStatusText = (status) => {
    switch (status) {
      case 1: return 'Active';
      case 2: return 'Accepted';
      case 3: return 'Expired';
      case 4: return 'Cancelled';
      default: return 'Unknown';
    }
  };

  const formatAssetValue = (asset) => {
    if (asset.assetType === 0) {
      // MON Token
      return `${asset.tokenIdOrAmount || asset.amount || '0'} MON`;
    } else if (asset.assetType === 2) {
      // NFT
      return asset.metadata?.name || asset.nftName || `NFT #${asset.tokenIdOrAmount}`;
    }
    return 'Unknown Asset';
  };

  if (loading) {
    return (
      <CounterOffersContainer>
        <LoadingState>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
          Loading counter offers...
        </LoadingState>
      </CounterOffersContainer>
    );
  }

  if (error) {
    return (
      <CounterOffersContainer>
        <EmptyState>
          <div className="icon">❌</div>
          <div className="title">Error Loading Counter Offers</div>
          <div className="description">
            {error}
          </div>
        </EmptyState>
      </CounterOffersContainer>
    );
  }

  if (!counterOffers || counterOffers.length === 0) {
    return (
      <CounterOffersContainer>
        <EmptyState>
          <div className="icon">💭</div>
          <div className="title">No Counter Offers Yet</div>
          <div className="description">
            This raffle doesn't have any counter offers yet.<br />
            Counter offers will appear here when users create them.
          </div>
        </EmptyState>
      </CounterOffersContainer>
    );
  }

  return (
    <CounterOffersContainer>
      <CounterOffersList>
        {counterOffers.map((offer, index) => (
          <CounterOfferCard key={offer._id || index}>
            <CounterOfferHeader>
              <CounterOfferTitle>{offer.title || 'Counter Offer'}</CounterOfferTitle>
              <CounterOfferStatus $status={offer.status}>
                {getStatusText(offer.status)}
              </CounterOfferStatus>
            </CounterOfferHeader>

            <CounterOfferInfo>
              <InfoItem>
                <div className="label">Creator</div>
                <div className="value">
                  {offer.maker ? `${offer.maker.slice(0, 6)}...${offer.maker.slice(-4)}` : 'Unknown'}
                </div>
              </InfoItem>
              <InfoItem>
                <div className="label">Created</div>
                <div className="value">
                  {offer.createdAt ? new Date(offer.createdAt).toLocaleDateString() : 'Unknown'}
                </div>
              </InfoItem>
              {offer.deadline && (
                <InfoItem>
                  <div className="label">Expires</div>
                  <div className="value">
                    {new Date(offer.deadline).toLocaleDateString()}
                  </div>
                </InfoItem>
              )}
            </CounterOfferInfo>

            {offer.description && (
              <CounterOfferDescription>
                "{offer.description}"
              </CounterOfferDescription>
            )}

            <AssetsSection>
              <AssetGroup>
                <div className="title">Assets Offered</div>
                <div className="assets">
                  {offer.offeredAssets && offer.offeredAssets.length > 0 ? (
                    offer.offeredAssets.map((asset, assetIndex) => (
                      <AssetTag key={assetIndex} $type="offered">
                        {formatAssetValue(asset)}
                      </AssetTag>
                    ))
                  ) : (
                    <AssetTag $type="offered">No assets</AssetTag>
                  )}
                </div>
              </AssetGroup>

              <AssetGroup>
                <div className="title">Assets Requested</div>
                <div className="assets">
                  {offer.requestedAssets && offer.requestedAssets.length > 0 ? (
                    offer.requestedAssets.map((asset, assetIndex) => (
                      <AssetTag key={assetIndex} $type="requested">
                        {formatAssetValue(asset)}
                      </AssetTag>
                    ))
                  ) : (
                    <AssetTag $type="requested">Any NFTs</AssetTag>
                  )}
                </div>
              </AssetGroup>
            </AssetsSection>
          </CounterOfferCard>
        ))}
      </CounterOffersList>
    </CounterOffersContainer>
  );
};

export default CounterOffersTab;
