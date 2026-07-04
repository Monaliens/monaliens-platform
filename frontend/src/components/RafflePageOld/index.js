import React, { useState, useCallback } from 'react';
import { usePrivyOptimized } from '../../context';
// Removed Privy import - using usePrivyOptimized from context instead

// Import components
import RaffleGrid from './components/RaffleGrid';
import UserStats from './components/UserStats';
import CreateRaffleTab from './components/CreateRaffleTab';
import RaffleDetailsModal from './components/RaffleDetailsModal';
import { useRaffleToast } from './components/CreateRaffleTab/hooks/useRaffleToast';
import RaffleToast from './components/CreateRaffleTab/components/RaffleToast';

// Import hooks
import useRaffles from './hooks/useRaffles';
import useUserProfile from './hooks/useUserProfile';
import useNFTMetadata from './hooks/useNFTMetadata';

// Import styles and data
import {
  RafflePageContainer,
  ContentWrapper,
  RaffleHeader,
  ActionButtons,
  ActionButton,
  WalletWarning,
  LoadingContainer,
  PageTransition
} from './styles';
import { rafflePageContent } from './data/pageContent';

/**
 * Main RafflePage Component - Raffle sistemi ana sayfası
 */
const RafflePage = () => {
  const { user, ready, login, connectors } = usePrivyOptimized();
  const activeWallet = connectors.find(wallet => wallet.address === user?.wallet?.address);
  const address = user?.wallet?.address || '';
  const isConnected = ready && !!user?.wallet?.address;
  
  // UI State
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRaffle, setSelectedRaffle] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreatePage, setShowCreatePage] = useState(false);
  const [slideDirection, setSlideDirection] = useState('enter-right');
  
  // Toast management
  const {
    toasts,
    addSuccessToast,
    addErrorToast,
    addInfoToast,
    clearToasts
  } = useRaffleToast();
  
  // Custom hooks
  const { 
    raffles, 
    loading: rafflesLoading, 
    error: rafflesError,
    refetch: refetchRaffles 
  } = useRaffles();
  
  const { 
    userProfile, 
    loading: profileLoading,
    refreshProfile 
  } = useUserProfile(address, isConnected);

  // NFT Metadata Hook - Enrich raffles with NFT metadata
  const { 
    enrichedRaffles, 
    isLoading: metadataLoading 
  } = useNFTMetadata(raffles, activeWallet);

  // Handle raffle creation success
  const handleRaffleCreated = useCallback(() => {
    addSuccessToast('Raffle created successfully!');
    setSlideDirection('exit-right');
    setTimeout(() => {
      setShowCreatePage(false);
      setSlideDirection('enter-left');
    }, 400);
    refetchRaffles();
    refreshProfile();
  }, [refetchRaffles, refreshProfile, addSuccessToast]);

  // Handle navigation to create page
  const handleShowCreatePage = useCallback(() => {
    setSlideDirection('exit-left');
    setTimeout(() => {
      setShowCreatePage(true);
      setSlideDirection('enter-right');
    }, 400);
  }, []);

  // Handle back to main page
  const handleBackToMain = useCallback(() => {
    setSlideDirection('exit-right');
    setTimeout(() => {
      setShowCreatePage(false);
      setSlideDirection('enter-left');
    }, 400);
  }, []);

  // Handle raffle creation error
  const handleRaffleError = useCallback((error) => {
    let errorMessage = 'Failed to create raffle';
    
    if (error?.message) {
      // Clean up common technical error messages
      if (error.message.includes('User rejected the request')) {
        errorMessage = 'Transaction was cancelled';
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds to complete transaction';
      } else if (error.message.includes('gas')) {
        errorMessage = 'Transaction failed due to gas issues';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network connection error';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Transaction timed out';
      } else {
        // Use the original message if it's user-friendly
        const cleanMessage = error.message.split('.')[0]; // Take first sentence
        if (cleanMessage.length < 100) {
          errorMessage = cleanMessage;
        }
      }
    }
    
    addErrorToast(errorMessage);
    console.error('Raffle creation error:', error);
  }, [addErrorToast]);

  // Handle raffle details
  const handleRaffleClick = useCallback((raffle) => {
    setSelectedRaffle(raffle);
    setShowDetailsModal(true);
  }, []);

  // Handle raffle participation (opens details modal with focus on participation)
  const handleParticipate = useCallback((raffle) => {
    setSelectedRaffle(raffle);
    setShowDetailsModal(true);
  }, []);

  // Connect wallet handler
  const handleConnectWallet = useCallback(() => {
    login();
  }, [login]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    console.log('🔄 Refresh button clicked');
    setIsRefreshing(true);
    
    try {
      await Promise.all([
        refetchRaffles(),
        refreshProfile()
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchRaffles, refreshProfile]);

  if (!ready) {
    return (
      <RafflePageContainer>
        <ContentWrapper>
          <LoadingContainer>
            <h2>{rafflePageContent.messages.loading}</h2>
          </LoadingContainer>
        </ContentWrapper>
      </RafflePageContainer>
    );
  }

  return (
    <RafflePageContainer>
      <ContentWrapper>
        <RaffleHeader>
          {showCreatePage ? (
            <>
              <h2>Create Raffles</h2>
              <p>Set up your raffle with custom prizes and settings</p>
            </>
          ) : (
            <>
              <h2>{rafflePageContent.header.title}</h2>
              <p>
                {rafflePageContent.header.description}
              </p>
            </>
          )}
          
          {!isConnected && (
            <WalletWarning>
              <p>{rafflePageContent.messages.walletWarning}</p>
              <ActionButton onClick={handleConnectWallet} style={{ marginTop: '1rem' }}>
                {rafflePageContent.buttons.connectWallet}
              </ActionButton>
            </WalletWarning>
          )}
        </RaffleHeader>

        {/* Show Create Page or Main Content with Sliding Animation */}
        <PageTransition $slideDirection={slideDirection}>
          {showCreatePage ? (
            <div style={{ marginTop: '2rem' }}>
              {/* Back Button */}
              <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <ActionButton onClick={handleBackToMain}>
                  ← Back to Raffles
                </ActionButton>
                <ActionButton 
                  onClick={() => {
                    // Gerçek submit handler'ı çağır
                    if (window.raffleSubmitHandler) {
                      window.raffleSubmitHandler();
                    } else {
                      console.warn('Raffle submit handler not available');
                    }
                  }}
                >
                  Create Raffle
                </ActionButton>
              </div>
              
              {/* Create Raffle Page */}
              <CreateRaffleTab
                onSuccess={handleRaffleCreated}
                onError={handleRaffleError}
                userAddress={address}
                triggerAssetFetch={showCreatePage}
                toastHandlers={{
                  addSuccessToast,
                  addErrorToast,
                  addInfoToast
                }}
              />
            </div>
          ) : (
            <>
              {/* Action Buttons */}
              {isConnected && (
                <ActionButtons>
                  <ActionButton onClick={handleShowCreatePage}>
                    {rafflePageContent.buttons.createRaffle}
                  </ActionButton>
                  <ActionButton 
                    onClick={handleRefresh}
                    disabled={rafflesLoading || isRefreshing}
                  >
                    {rafflesLoading || isRefreshing ? rafflePageContent.buttons.refreshing : rafflePageContent.buttons.refresh}
                  </ActionButton>
                </ActionButtons>
              )}

              {/* User Stats Section */}
              {isConnected && userProfile && (
                <UserStats 
                  userProfile={userProfile}
                  loading={profileLoading}
                />
              )}

              {/* Raffles Grid */}
              <RaffleGrid 
                raffles={enrichedRaffles}
                loading={rafflesLoading || metadataLoading}
                isRefreshing={isRefreshing}
                error={rafflesError}
                onRaffleClick={handleRaffleClick}
                onParticipate={handleParticipate}
                userAddress={address}
              />
            </>
          )}
        </PageTransition>

        <RaffleDetailsModal
          isOpen={showDetailsModal}
          raffle={selectedRaffle}
          onClose={() => {
            setShowDetailsModal(false);
            // Delay clearing selectedRaffle to prevent flash of "No raffle ID" error
            setTimeout(() => {
              setSelectedRaffle(null);
            }, 100);
          }}
          onParticipate={(data) => {
            // Handle participation success
            console.log('🎉 Participation successful:', data);
            
            // Immediate refresh
            refetchRaffles();
            refreshProfile();
            
            // Additional delayed refreshes to catch blockchain updates
            setTimeout(() => {
              console.log('🔄 Delayed refetch #1 (3s)');
              refetchRaffles();
              refreshProfile();
            }, 3000);
            
            setTimeout(() => {
              console.log('🔄 Delayed refetch #2 (8s)');
              refetchRaffles();
              refreshProfile();
            }, 8000);
          }}
        />
      </ContentWrapper>
      
      {/* Global Toast Notifications */}
      <RaffleToast toasts={toasts} />
    </RafflePageContainer>
  );
};

export default RafflePage; 