import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useRaffleDetail } from '../../../../hooks/useRaffleData';
import { useRafflePurchase } from '../../hooks/useRafflePurchase';
import { usePrivyOptimized } from '../../../../context';
import { fetchNFTFloorPrice, formatFloorPrice } from '../../../../services/magicEdenApi';
import {
  DetailContainer,
  ScrollContainer,
  ContentWrapper,
  BackButton,
  DetailLayout,
  TopSection,
  BottomSection,
  NFTImage,
  TraitsSection,
  TraitsList,
  TraitItem,
  CreatorInfo,
  RaffleInfoSection,
  NFTTitle,
  TitleRow,
  StatusBadgeDetail,
  PriceInfo,
  InfoBoxes,
  InfoBox,
  AmountSelector,
  AmountButton,
  AmountDisplay,
  BuyButton,
  ParticipantsSection,
  ParticipantsTitle,
  ParticipantsTable,
  TableHeader,
  TableRow,
  TableCell,
  ResultsSection,
  CountdownTimer,
  WinnerResultsTitle,
  WinnerInfoContainer,
  WinnerLabel,
  WinnerAddress,
  TransactionContainer,
  TransactionLabel,
  TransactionLink
} from './styles';

const RaffleDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [amount, setAmount] = useState(1);
  const [showContent, setShowContent] = useState(false);
  const [minimumLoadingMet, setMinimumLoadingMet] = useState(false);
  const [searchWallet, setSearchWallet] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [floorPrice, setFloorPrice] = useState(null);
  const [floorPriceLoading, setFloorPriceLoading] = useState(false);
  const loadingStartTime = useRef(Date.now());
  const { user } = usePrivyOptimized();
  
  // Fetch raffle data from API with refresh capability
  const { raffle, loading, error, refresh } = useRaffleDetail(id);
  
  // Use the purchase hook
  const { 
    buyTickets, 
    loading: purchasing, 
    error: purchaseError, 
    progress, 
    reset 
  } = useRafflePurchase();

  // Memoize participants list - MUST be called before any conditional returns!
  const participants = useMemo(() => {
    if (!raffle || !raffle.participants) return [];
    
    // Create a sorted list based on address (for stable ordering) then amount
    const sortedParticipants = raffle.participants
      .map(p => ({
        address: `${p.owner.slice(0, 6)}...${p.owner.slice(-4)}`,
        fullAddress: p.owner,
        amount: p.totalTickets,
        chance: raffle.totalTicketsSold > 0 
          ? `${((p.totalTickets / raffle.totalTicketsSold) * 100).toFixed(1)}%`
          : '0%'
      }))
      .sort((a, b) => {
        // First sort by amount (descending)
        if (b.amount !== a.amount) {
          return b.amount - a.amount;
        }
        // If amounts are equal, sort by address for consistent ordering
        return a.fullAddress.localeCompare(b.fullAddress);
      });
    
    // Filter by search if active
    if (isSearching && searchWallet) {
      return sortedParticipants.filter(p => 
        p.fullAddress.toLowerCase() === searchWallet.toLowerCase()
      );
    }
    
    return sortedParticipants;
  }, [raffle?.participants, raffle?.totalTicketsSold, isSearching, searchWallet]);

  // Handle wallet search input change
  const handleSearchChange = (value) => {
    setSearchWallet(value);
    
    // Enable search mode when input has value
    if (value.trim()) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchWallet('');
    setIsSearching(false);
  };

  // Manage loading transition with minimum display time
  useEffect(() => {
    const minLoadingTime = 800; // Minimum 800ms loading display
    
    if (loading) {
      loadingStartTime.current = Date.now();
      setShowContent(false);
      setMinimumLoadingMet(false);
    } else if (!loading && raffle) {
      const elapsedTime = Date.now() - loadingStartTime.current;
      const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
      
      setTimeout(() => {
        setMinimumLoadingMet(true);
        // Add a small delay for smooth transition
        setTimeout(() => {
          setShowContent(true);
        }, 100);
      }, remainingTime);
    }
  }, [loading, raffle]);

  // Fetch floor price for NFT raffles - only when raffle ID changes
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

  // Skeleton Loader Component
  const SkeletonLoader = () => (
    <SkeletonContainer>
      <SkeletonLayout>
        {/* Top Section */}
        <SkeletonTopSection>
          {/* NFT Image Skeleton */}
          <SkeletonImage />
          
          {/* Info Section Skeleton */}
          <SkeletonInfoSection>
            <SkeletonBox $height="48px" $width="60%" $margin="0 0 12px 0" />
            <SkeletonBox $height="24px" $width="40%" $margin="0 0 20px 0" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <SkeletonBox $height="80px" />
              <SkeletonBox $height="80px" />
            </div>
            <SkeletonBox $height="55px" $margin="20px auto" $width="200px" />
            <SkeletonBox $height="80px" $margin="20px 0 0 0" />
          </SkeletonInfoSection>
        </SkeletonTopSection>
        
        {/* Bottom Section */}
        <SkeletonBottomSection>
          {/* Traits Panel */}
          <SkeletonPanel $minHeight="300px" $delay="0.1s">
            <SkeletonBox $height="24px" $width="30%" $margin="0 0 20px 0" />
            <SkeletonBox $height="40px" $margin="0 0 12px 0" />
            <SkeletonBox $height="40px" $margin="0 0 12px 0" />
            <SkeletonBox $height="40px" $margin="0 0 12px 0" />
            <SkeletonBox $height="40px" />
          </SkeletonPanel>
          
          {/* Participants Panel */}
          <SkeletonPanel $minHeight="400px" $delay="0.2s">
            <SkeletonBox $height="24px" $width="40%" $margin="0 0 20px 0" />
            <SkeletonBox $height="30px" $margin="0 0 12px 0" />
            <SkeletonBox $height="30px" $margin="0 0 12px 0" />
            <SkeletonBox $height="30px" $margin="0 0 12px 0" />
            <SkeletonBox $height="30px" />
          </SkeletonPanel>
          
          {/* Results Panel */}
          <SkeletonPanel $minHeight="400px" $delay="0.3s">
            <SkeletonBox $height="60px" $width="80%" $margin="0 auto 20px auto" />
            <SkeletonBox $height="80px" $width="60%" $margin="0 auto" />
          </SkeletonPanel>
        </SkeletonBottomSection>
      </SkeletonLayout>
    </SkeletonContainer>
  );

  if (loading || !minimumLoadingMet) {
    return (
      <DetailContainer>
        <ScrollContainer>
          <ContentWrapper>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <BackButton onClick={() => navigate('/raffle')}>
                <ArrowLeft size={20} />
                <span>Loading...</span>
              </BackButton>
            </div>
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              Loading raffle details...
            </div>
          </ContentWrapper>
        </ScrollContainer>
      </DetailContainer>
    );
  }

  if (error || !raffle) {
    return (
      <DetailContainer>
        <ScrollContainer>
          <ContentWrapper>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <BackButton onClick={() => navigate('/raffle')}>
                <ArrowLeft size={20} />
                <span>back</span>
              </BackButton>
            </div>
            <div style={{ textAlign: 'center', padding: '40px', color: '#dc2626' }}>
              {error || 'Raffle not found'}
            </div>
          </ContentWrapper>
        </ScrollContainer>
      </DetailContainer>
    );
  }

  // Use traits from API (attributes field)
  const traits = raffle.traits && raffle.traits.length > 0 ? raffle.traits : [];

  // Check if user is the owner
  const isOwner = raffle.owner && user?.wallet?.address && 
                 raffle.owner.toLowerCase() === user.wallet.address.toLowerCase();

  // Calculate user's remaining ticket allowance
  const userCurrentTickets = raffle.userTickets || 0;
  const maxAllowed = raffle.maxTicketsPerWallet || 0;
  const userRemainingAllowance = isOwner ? 0 : Math.max(0, maxAllowed - userCurrentTickets);
  
  // Override amount to 0 if user is owner or raffle is not active
  const isRaffleEnded = raffle.status === 'CLAIMED' || raffle.status === 'REFUNDED' || raffle.endTime === 'Ended';
  const isRaffleInactive = !raffle.isActive || raffle.status !== 'ACTIVE';
  const displayAmount = (isOwner || isRaffleEnded || isRaffleInactive) ? 0 : amount;

  const handleDecrease = () => {
    if (isOwner || amount <= 1 || userRemainingAllowance === 0 || isRaffleEnded || isRaffleInactive) return;
    
    setAmount(amount - 1);
  };

  const handleIncrease = () => {
    if (isOwner || userRemainingAllowance === 0 || isRaffleEnded || isRaffleInactive) return;
    
    const maxPossible = Math.min(raffle.remainingTickets, userRemainingAllowance);
    
    if (amount < maxPossible) {
      setAmount(amount + 1);
    }
  };

  const handleBuy = async () => {
    // Check if raffle is active and not ended
    const isRaffleEnded = raffle.status === 'CLAIMED' || raffle.status === 'REFUNDED' || raffle.endTime === 'Ended';
    if (isRaffleEnded || userRemainingAllowance === 0) {
      // Cannot purchase tickets - raffle has ended or no remaining allowance
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
          // Purchase progress
        },
        onSuccess: (result) => {
          // Reset amount after successful purchase
          setAmount(1);
          // Refresh raffle data silently
          if (refresh) {
            refresh();
          }
        }
      });
    } catch (err) {
      // Purchase failed
    }
  };

  const handleBack = () => {
    navigate('/raffle');
  };

  const handleMagicEdenClick = () => {
    if (raffle.isNFTPrize && raffle.prizeContractAddress) {
      window.open(`https://magiceden.io/collections/monad-testnet/${raffle.prizeContractAddress}`, '_blank');
    }
  };

  return (
    <DetailContainer>
      <ScrollContainer>
        <ContentWrapper>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
            <BackButton onClick={handleBack} style={{ marginBottom: 0 }}>
              <ArrowLeft size={20} />
            </BackButton>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '18px', color: '#6b7280' }}>
              {raffle.isNFTPrize ? (
                <a
                  href={raffle.prizeContractAddress ? `https://magiceden.io/collections/monad-testnet/${raffle.prizeContractAddress}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ 
                    fontWeight: '700', 
                    color: '#1f2937',
                    fontSize: '20px',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#6930c3';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#1f2937';
                  }}
                  onClick={(e) => {
                    if (!raffle.prizeContractAddress) {
                      e.preventDefault();
                    }
                  }}
                >
                  {raffle.collectionName || 'Collection'}
                </a>
              ) : (
                <span
                  style={{ 
                    fontWeight: '700', 
                    color: '#1f2937',
                    fontSize: '20px',
                    cursor: 'default'
                  }}
                >
                  {raffle.collectionName || 'Token Reward'}
                </span>
              )}
              <span>•</span>
              <a
                href={`https://testnet.monadexplorer.com/address/${raffle.contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#6b7280',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#6930c3';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                Contract: {raffle.contractAddress ? `${raffle.contractAddress.slice(0, 6)}...${raffle.contractAddress.slice(-4)}` : 'Unknown'}
                <ExternalLink size={14} />
              </a>
            </div>
          </div>

          <DetailLayout>
            {/* Top Section - NFT and Main Container */}
            <TopSection>
              {/* NFT or Token Image */}
              <NFTImage 
                src={raffle.imageUrl} 
                alt={raffle.nftName}
                onError={(e) => {
                  e.target.src = raffle.prizeType === 'TOKEN' 
                    ? '/assets/images/monad.png' 
                    : '/raffle-images/nftphoto.png';
                }}
              />

              {/* Main Container */}
              <RaffleInfoSection>
                {/* Title Row with Status Badge */}
                <TitleRow>
                  <div>
                    <NFTTitle>{raffle.nftName}</NFTTitle>
                    {raffle.isNFTPrize && (
                      <div style={{
                        fontSize: '16px',
                        color: '#6930c3',
                        marginTop: '6px',
                        fontWeight: '700'
                      }}>
                        FP: {floorPriceLoading ? 'Loading...' : formatFloorPrice(floorPrice)}
                      </div>
                    )}
                  </div>
                  <StatusBadgeDetail 
                    $active={raffle.isActive && raffle.status === 'ACTIVE' && raffle.endTime !== 'Ended'}
                    $claimed={raffle.status === 'CLAIMED'}
                    $refunded={raffle.status === 'REFUNDED'}
                  >
                    {raffle.status === 'CLAIMED' ? 'Claimed' :
                     raffle.status === 'REFUNDED' ? 'Refunded' :
                     raffle.endTime === 'Ended' ? 'Ended' :
                     (!raffle.isActive || raffle.status !== 'ACTIVE') ? 'Inactive' : 'Active'}
                  </StatusBadgeDetail>
                </TitleRow>
                
                
                {/* Info Boxes */}
                <InfoBoxes>
                  <InfoBox>Ticket Price: {raffle.ticketPrice}</InfoBox>
                  <InfoBox>Tickets Sold: {raffle.totalTicketsSold}/{raffle.totalTickets}</InfoBox>
                </InfoBoxes>
            
            {/* Error Display */}
            {purchaseError && (
              <div style={{
                padding: '12px',
                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                borderRadius: '8px',
                color: '#dc2626',
                fontSize: '14px',
                marginBottom: '16px'
              }}>
                {purchaseError}
              </div>
            )}
            
            {/* Progress Display */}
            {progress && (
              <div style={{
                padding: '12px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                color: '#3b82f6',
                fontSize: '14px',
                marginBottom: '16px'
              }}>
                <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                  {progress.step === 'wallet' && 'Connecting Wallet'}
                  {progress.step === 'validation' && 'Validating Purchase'}
                  {progress.step === 'balance' && 'Checking Balance'}
                  {progress.step === 'gas' && 'Estimating Gas'}
                  {progress.step === 'transaction' && 'Submitting Transaction'}
                  {progress.step === 'confirmation' && 'Waiting for Confirmation'}
                  {progress.step === 'success' && 'Success!'}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                  {progress.message}
                </div>
                {progress.txHash && (
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    <a 
                      href={`https://testnet.monadexplorer.com/tx/${progress.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#3b82f6', textDecoration: 'underline' }}
                    >
                      View Transaction
                    </a>
                  </div>
                )}
              </div>
            )}
            
            {/* Amount Selector */}
            <AmountSelector>
              <AmountButton 
                onClick={handleDecrease}
                disabled={amount <= 1 || isRaffleEnded || isRaffleInactive || isOwner || userRemainingAllowance === 0}
              >
                -
              </AmountButton>
              
              <AmountDisplay>
                {displayAmount}
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
            
            {/* Buy Button */}
            <BuyButton 
                onClick={handleBuy}
                disabled={(() => {
                  const isInactive = !raffle.isActive || raffle.status !== 'ACTIVE';
                  const isEnded = raffle.endTime === 'Ended';
                  const isFinished = raffle.status === 'CLAIMED' || raffle.status === 'REFUNDED';
                  return purchasing || (isInactive && !isFinished) || (isEnded && !isFinished) || isOwner || userRemainingAllowance === 0;
                })()}
                style={{
                  background: (raffle.status === 'CLAIMED' || raffle.status === 'REFUNDED') ? 'transparent' : undefined,
                  border: raffle.status === 'CLAIMED' ? '3px solid #FFD700' : raffle.status === 'REFUNDED' ? '3px solid #dc2626' : undefined,
                  color: raffle.status === 'CLAIMED' ? '#FFD700' : raffle.status === 'REFUNDED' ? '#dc2626' : undefined,
                  cursor: (raffle.status === 'CLAIMED' || raffle.status === 'REFUNDED') ? 'default' : undefined,
                  opacity: 1
                }}
              >
                <span className="buy-text" style={{ color: raffle.status === 'CLAIMED' ? '#FFD700 !important' : raffle.status === 'REFUNDED' ? '#dc2626 !important' : undefined }}>
                  {purchasing ? 'Processing...' :
                   raffle.status === 'CLAIMED' && raffle.winner ? 
                     `${raffle.winner.slice(0, 6)}...${raffle.winner.slice(-4)} Won` : 
                   raffle.status === 'REFUNDED' ? 'Refunded' :
                   raffle.endTime === 'Ended' ? 'Ended' :
                   (!raffle.isActive || raffle.status !== 'ACTIVE') ? 'Inactive' :
                   isOwner ? "Your Raffle" : 
                   userRemainingAllowance === 0 ? 'Limit Reached' : 
                   `Buy Ticket${amount > 1 ? 's' : ''}`}
                </span>
                {!purchasing && 
                 raffle.status !== 'CLAIMED' && 
                 raffle.status !== 'REFUNDED' && 
                 raffle.endTime !== 'Ended' &&
                 raffle.isActive &&
                 raffle.status === 'ACTIVE' &&
                 !isOwner &&
                 userRemainingAllowance > 0 && (
                  <span className="price-text"> ({amount * parseFloat(raffle.ticketPrice.replace('MON', ''))} MON)</span>
                )}
              </BuyButton>
          </RaffleInfoSection>
            </TopSection>

            {/* Bottom Section - Traits, Participants, Results */}
            <BottomSection>
              {/* Traits Section - Only show for NFT raffles with traits */}
              {raffle.isNFTPrize && traits.length > 0 ? (
                <TraitsSection>
                  <h3>Traits</h3>
                  <TraitsList>
                    {traits.map((trait, index) => (
                      <TraitItem key={index}>
                        <span className="trait-name">{trait.trait_type || trait.name}</span>
                        <span className="trait-value">{trait.value}</span>
                      </TraitItem>
                    ))}
                  </TraitsList>
                  
                </TraitsSection>
              ) : (
                <div style={{ minWidth: '400px' }}></div>
              )}

              {/* Participants Section */}
              <ParticipantsSection>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <ParticipantsTitle style={{ margin: 0 }}>
                    Participants ({isSearching && participants.length > 0 ? `${participants.length} of ${raffle.participantCount || raffle.participants?.length}` : (raffle.participantCount || participants.length)})
                  </ParticipantsTitle>
                  
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Search wallet..."
                      value={searchWallet}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        border: '2px solid rgba(105, 48, 195, 0.2)',
                        borderRadius: '6px',
                        fontSize: '13px',
                        width: '180px',
                        background: 'rgba(255, 255, 255, 0.98)',
                        transition: 'all 0.3s ease',
                        fontFamily: 'Lexend, sans-serif',
                        outline: 'none'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = 'rgba(105, 48, 195, 0.5)';
                        e.target.style.boxShadow = '0 0 0 3px rgba(105, 48, 195, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(105, 48, 195, 0.2)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    {searchWallet && (
                      <button
                        onClick={clearSearch}
                        style={{
                          padding: '6px 10px',
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          fontFamily: 'Lexend, sans-serif'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#b91c1c';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = '#dc2626';
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                
                <ParticipantsTable>
                  <TableHeader>
                    <TableCell>Address</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Chance</TableCell>
                  </TableHeader>
                  
                  {participants.map((participant, index) => (
                    <TableRow key={`${participant.fullAddress}-${participant.amount}`}>
                      <TableCell>
                        <a
                          href={`https://testnet.monadexplorer.com/address/${participant.fullAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#000000',
                            textDecoration: 'none',
                            transition: 'color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#4b5563';
                            e.currentTarget.style.textDecoration = 'underline';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#000000';
                            e.currentTarget.style.textDecoration = 'none';
                          }}
                        >
                          {participant.address}
                        </a>
                      </TableCell>
                      <TableCell>{participant.amount}</TableCell>
                      <TableCell>{participant.chance}</TableCell>
                    </TableRow>
                  ))}
                </ParticipantsTable>
              </ParticipantsSection>

              {/* Results Section */}
              <ResultsSection>
                {/* Show countdown if raffle is active */}
                {raffle.isActive && raffle.status === 'ACTIVE' && raffle.endTime !== 'Ended' ? (
                  <CountdownTimer>
                    <div className="countdown-label">Results will appear in</div>
                    <div className="countdown-time">{raffle.endTime}</div>
                  </CountdownTimer>
                ) : (
                  <>
                    {/* Winner Info */}
                    {raffle.winner && (
                      <WinnerInfoContainer>
                        <WinnerLabel>Winner</WinnerLabel>
                        <WinnerAddress
                          href={`https://testnet.monadexplorer.com/address/${raffle.winner}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {raffle.winner.slice(0, 6)}...{raffle.winner.slice(-4)}
                          <span style={{ fontSize: '12px' }}>↗</span>
                        </WinnerAddress>
                      </WinnerInfoContainer>
                    )}

                    {/* Transaction Hashes */}
                    {(raffle.settlementTransactionHash || raffle.prizeClaimTransactionHash || raffle.prizeRefundTransactionHash) && (
                      <TransactionContainer>
                        <TransactionLabel>Transactions</TransactionLabel>
                        
                        {raffle.settlementTransactionHash && (
                          <TransactionLink
                            href={`https://testnet.monadexplorer.com/tx/${raffle.settlementTransactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Draw TX ↗
                          </TransactionLink>
                        )}
                        
                        {raffle.prizeClaimTransactionHash && (
                          <TransactionLink
                            href={`https://testnet.monadexplorer.com/tx/${raffle.prizeClaimTransactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Prize TX ↗
                          </TransactionLink>
                        )}
                        
                        {raffle.prizeRefundTransactionHash && (
                          <TransactionLink
                            href={`https://testnet.monadexplorer.com/tx/${raffle.prizeRefundTransactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Refund TX ↗
                          </TransactionLink>
                        )}
                      </TransactionContainer>
                    )}
                    
                  </>
                )}
              </ResultsSection>
            </BottomSection>
          </DetailLayout>
        </ContentWrapper>
      </ScrollContainer>
    </DetailContainer>
  );
};

export default RaffleDetail;