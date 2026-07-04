import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRafflePurchase } from '../hooks/useRafflePurchase';
import { fetchNFTFloorPrice, formatFloorPrice } from '../../../services/magicEdenApi';
import {
  RaffleCardContainer,
  NFTImage,
  CardContent,
  CountdownTimer,
  NFTInfo,
  NFTName,
  CollectionName,
  StatsGrid,
  StatItem,
  TicketPrice,
  QuickBuySection,
  AmountSelector,
  AmountButton,
  AmountDisplay,
  QuickBuyButton,
  StatusBadge,
  WinnerDisplay,
  MaxTicketsLabelNew
} from '../styles';

/**
 * RaffleCard Component - Individual raffle card with NFT info and quick buy
 * 
 * @param {Object} raffle - Raffle data object
 * @returns {JSX.Element} Rendered raffle card
 */
const RaffleCard = ({ raffle, userAddress = null, onPurchaseSuccess }) => {
  const [amount, setAmount] = useState(1);
  const [floorPrice, setFloorPrice] = useState(null);
  const [floorPriceLoading, setFloorPriceLoading] = useState(false);
  const navigate = useNavigate();
  
  // Use the purchase hook
  const { buyTickets, loading, error, progress, reset } = useRafflePurchase();

  // Fetch floor price for NFT raffles
  useEffect(() => {
    const fetchFloorPrice = async () => {
      // Only fetch for NFT raffles with valid contract address and token ID
      if (!raffle?.isNFTPrize || !raffle?.prizeContractAddress || !raffle?.prizeTokenId) {
        setFloorPrice(null);
        return;
      }

      setFloorPriceLoading(true);
      try {
        const nftData = await fetchNFTFloorPrice(raffle.prizeContractAddress, raffle.prizeTokenId);
        if (nftData && nftData.floorPrice !== null) {
          setFloorPrice(nftData.floorPrice);
        } else {
          setFloorPrice(null);
        }
      } catch (error) {
        // Error fetching floor price - silently handle
        setFloorPrice(null);
      } finally {
        setFloorPriceLoading(false);
      }
    };

    if (raffle?.id) {
      fetchFloorPrice();
    }
  }, [raffle?.id, raffle?.prizeContractAddress, raffle?.prizeTokenId]);

  // Check if user is the owner of this raffle
  const isOwner = raffle.owner && userAddress && 
                 raffle.owner.toLowerCase() === userAddress.toLowerCase();

  // Calculate user's current tickets for this raffle
  const userTickets = userAddress && raffle.participants && Array.isArray(raffle.participants)
    ? (raffle.participants.find(p => p.address?.toLowerCase() === userAddress?.toLowerCase())?.tickets || 0)
    : 0;

  // Check if raffle is inactive or ended
  const isRaffleInactive = !raffle.isActive || (raffle.status !== 'ACTIVE' && raffle.status !== 'DRAWN');
  const isRaffleEnded = raffle.status === 'CLAIMED' || raffle.status === 'DRAWN' || raffle.status === 'REFUNDED' || raffle.endTime === 'Ended' || raffle.remainingTickets === 0;

  // Calculate user's remaining ticket allowance
  const maxAllowed = raffle.maxTicketsPerWallet || 0;
  const userRemainingAllowance = isOwner ? 0 : Math.max(0, maxAllowed - userTickets);
  
  // Override amount to 0 if user is owner or raffle is not active
  const displayAmount = (isOwner || isRaffleEnded || isRaffleInactive) ? 0 : amount;

  const handleDecrease = (e) => {
    e.stopPropagation(); // Prevent card click
    if (amount > 1 && !isRaffleEnded && !isRaffleInactive && !isOwner && userRemainingAllowance > 0) {
      setAmount(amount - 1);
    }
  };

  const handleIncrease = (e) => {
    e.stopPropagation(); // Prevent card click
    if (isRaffleInactive || isRaffleEnded || isOwner || userRemainingAllowance === 0) return;
    
    const maxPossible = Math.min(raffle.remainingTickets, userRemainingAllowance);
    
    if (amount < maxPossible) {
      setAmount(amount + 1);
    }
  };

  const handleQuickBuy = async (e) => {
    e.stopPropagation(); // Prevent card click
    
    // Check if raffle is active and not ended
    if (isRaffleInactive || isRaffleEnded || isOwner || userRemainingAllowance === 0) {
      // Cannot purchase tickets - raffle is inactive, ended, user is the owner, or no remaining allowance
      return;
    }

    // Reset any previous errors
    reset();

    try {
      await buyTickets({
        contractAddress: raffle.contractAddress,
        ticketCount: amount,
        ticketPriceRaw: raffle.ticketPriceRaw,
        onProgress: (progressData) => {
          // Quick buy progress
        },
        onSuccess: (result) => {
          // Reset amount after successful purchase
          setAmount(1);
          // Call the refresh function if provided
          if (onPurchaseSuccess) {
            onPurchaseSuccess();
          }
        }
      });
    } catch (err) {
      // Quick buy failed
    }
  };

  const handleCardClick = () => {
    navigate(`/raffle/${raffle.id}`);
  };

  // Format winner address
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Determine status badge text and state
  const getStatusInfo = () => {
    if (raffle.status === 'CLAIMED') return { text: 'Claimed', active: true };
    if (raffle.status === 'DRAWN' && raffle.prizeClaimTransactionHash) return { text: 'Claimed', active: true };
    if (raffle.status === 'DRAWN' && raffle.winner) return { text: 'Drawn', active: true };
    if (raffle.status === 'DRAWN') return { text: 'Drawing', active: true };
    if (raffle.status === 'REFUNDED') return { text: 'Refunded', active: false };
    if (!raffle.isActive || raffle.status !== 'ACTIVE') return { text: 'Non-Active', active: false };
    return { text: 'Active', active: true };
  };

  const statusInfo = getStatusInfo();

  return (
    <RaffleCardContainer onClick={handleCardClick}>
      <NFTImage 
        src={raffle.imageUrl} 
        alt={raffle.nftName}
        onError={(e) => {
          e.target.src = '/raffle-images/nftphoto.png';
        }}
      />
      
      <CardContent>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <StatusBadge $active={statusInfo.active} $status={raffle.status} style={{ position: 'static', margin: 0 }}>
            {statusInfo.text}
          </StatusBadge>
          {statusInfo.active && raffle.endTime !== 'Ended' && (
            <CountdownTimer style={{ marginBottom: 0 }}>
              Ends in {raffle.endTime}
            </CountdownTimer>
          )}
        </div>
        
        <NFTInfo style={{ marginBottom: '12px' }}>
          <NFTName style={{ marginBottom: '2px' }}>
            {raffle.nftName}
          </NFTName>
          
          <CollectionName style={{ 
            marginBottom: '0', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between' 
          }}>
            <span>{raffle.collectionName}</span>
            {raffle.isNFTPrize && (
              <span style={{ 
                fontSize: '13px', 
                color: '#6930c3',
                fontWeight: '700',
                marginLeft: '8px'
              }}>
                FP: {floorPriceLoading ? '...' : formatFloorPrice(floorPrice)}
              </span>
            )}
          </CollectionName>
        </NFTInfo>
        
        <StatsGrid style={{ marginBottom: '12px' }}>
          <StatItem>
            <div className="label">remaining</div>
            <div className="value">{raffle.remainingTickets}/{raffle.totalTickets}</div>
          </StatItem>
          <StatItem>
            <div className="label">participants</div>
            <div className="value">{raffle.participants}</div>
          </StatItem>
        </StatsGrid>
        
        <TicketPrice style={{ margin: '0 0 8px 0' }}>
          {raffle.ticketPrice}
        </TicketPrice>
        
        {/* Error Display */}
        {error && (
          <div style={{
            padding: '8px',
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            borderRadius: '6px',
            color: '#dc2626',
            fontSize: '12px',
            marginBottom: '12px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}
        
        <QuickBuySection style={{ flexDirection: 'column', gap: '8px', paddingTop: '0px', borderTop: '0px' }}>
          <QuickBuyButton 
            onClick={(e) => {
              if (raffle.status === 'CLAIMED' && raffle.winner) {
                e.stopPropagation();
                window.open(`https://testnet.monadexplorer.com/address/${raffle.winner}`, '_blank');
              } else {
                handleQuickBuy(e);
              }
            }}
            disabled={loading || (raffle.status !== 'CLAIMED' && raffle.status !== 'DRAWN' && raffle.status !== 'REFUNDED' && (isRaffleEnded || isRaffleInactive || isOwner || userRemainingAllowance === 0))}
            style={{
              width: '100%',
              opacity: (loading || (raffle.status !== 'CLAIMED' && raffle.status !== 'DRAWN' && raffle.status !== 'REFUNDED' && (isRaffleEnded || isRaffleInactive || isOwner || userRemainingAllowance === 0))) ? 0.5 : 1,
              cursor: (raffle.status === 'CLAIMED' || raffle.status === 'DRAWN' || raffle.status === 'REFUNDED') ? 'pointer' : (loading || isRaffleEnded || isRaffleInactive || isOwner || userRemainingAllowance === 0) ? 'not-allowed' : 'pointer',
              backgroundColor: (isOwner && !isRaffleEnded && !isRaffleInactive) ? '#f4a0a0' : 'transparent',
              borderColor: raffle.status === 'CLAIMED' ? '#FFC107' : (raffle.status === 'DRAWN' && raffle.winner) ? '#FFC107' : raffle.status === 'REFUNDED' ? '#dc2626' : (isOwner && !isRaffleEnded && !isRaffleInactive) ? '#f4a0a0' : '#2563eb',
              color: raffle.status === 'CLAIMED' ? '#FFC107' : (raffle.status === 'DRAWN' && raffle.winner) ? '#FFC107' : raffle.status === 'REFUNDED' ? '#dc2626' : (isOwner && !isRaffleEnded && !isRaffleInactive) ? '#ffffff' : '#2563eb'
            }}
          >
            {loading ? 'Processing...' : 
             raffle.status === 'CLAIMED' ? 
               (raffle.winner ? `${formatAddress(raffle.winner)} won` : 'Claimed') :
             raffle.status === 'DRAWN' && raffle.winner ? 
               `${formatAddress(raffle.winner)} won` :
             raffle.status === 'DRAWN' ? 'Winner Selected' :
             raffle.status === 'REFUNDED' ? 'Refunded' :
             raffle.endTime === 'Ended' ? 'Ended' :
             (!raffle.isActive || raffle.status !== 'ACTIVE') ? 'Inactive' :
             isOwner ? "Your Raffle" :
             userRemainingAllowance === 0 ? 'Limit Reached' :
             raffle.remainingTickets === 0 ? 'Sold Out' : 'Quick Buy'}
          </QuickBuyButton>
          
          <AmountSelector style={{ justifyContent: 'center' }}>
            <AmountButton 
              onClick={handleDecrease}
              disabled={amount <= 1 || isRaffleEnded || isRaffleInactive || isOwner || userRemainingAllowance === 0}
            >
              -
            </AmountButton>
            
            <AmountDisplay style={{ minWidth: '40px', textAlign: 'center' }}>
              {(isRaffleInactive || isRaffleEnded || userRemainingAllowance === 0) ? '-' : displayAmount}
            </AmountDisplay>
            
            <AmountButton 
              onClick={handleIncrease}
              disabled={(() => {
                if (isRaffleInactive || isRaffleEnded || isOwner || userRemainingAllowance === 0) return true;
                const maxPossible = Math.min(raffle.remainingTickets, userRemainingAllowance);
                return amount >= maxPossible;
              })()}
            >
              +
            </AmountButton>
          </AmountSelector>
          
          <MaxTicketsLabelNew style={{ marginTop: '2px' }}>
            Maximum: {(isRaffleInactive || isRaffleEnded) ? '-' : userRemainingAllowance}
          </MaxTicketsLabelNew>
        </QuickBuySection>
      </CardContent>
    </RaffleCardContainer>
  );
};

export default RaffleCard;