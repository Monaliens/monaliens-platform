import React from 'react';
import ReactDOM from 'react-dom';
import { usePrivyOptimized } from '../../../../context';
import {
  ModalOverlay,
  ModalContainer,
  CloseButton
} from './styles';
import { useRaffleDetails } from './hooks/useRaffleDetails';
import { handleModalClose } from './utils/modalHelpers';
import ModalHeader from './components/ModalHeader';
import ModalContent from './components/ModalContent';
import RaffleInfo from './components/RaffleInfo';
// import TimeDisplay from './components/TimeDisplay'; // Integrated into RaffleInfo
import ParticipationForm from './components/ParticipationForm';
import WinnerInfo from './components/WinnerInfo';
import Participants from './components/Participants';
import SlidingTabs from './components/SlidingTabs';

const RaffleDetailsModal = ({ isOpen, onClose, raffle, onParticipate }) => {
  const { authenticated } = usePrivyOptimized();
  const [isClosing, setIsClosing] = React.useState(false);
  
  // Use raffle details hook for API management
  // Handle different ID formats from API (id, raffleId, _id)
  const raffleId = raffle?.id || raffle?.raffleId || raffle?._id;
  const { 
    raffleDetails, 
    loading: detailsLoading, 
    error: detailsError,
    refetch,
    resetState 
  } = useRaffleDetails(raffleId, isOpen);

  // Use raffle details from hook if available, otherwise use prop
  const currentRaffle = raffleDetails || raffle;

  // Handle modal close with cleanup
  const handleClose = () => {
    if (isClosing) return; // Prevent double closing
    
    setIsClosing(true);
    
    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      handleModalClose(onClose, resetState);
      setIsClosing(false);
    }, 300); // Match animation duration
  };

  // Handle click outside modal to close
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Handle escape key to close modal
  React.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Don't render if modal is not open and not closing
  if (!isOpen && !isClosing) {
    return null;
  }

  // Show loading state
  if (detailsLoading) {
    return ReactDOM.createPortal(
      <ModalOverlay $isClosing={isClosing} onClick={handleOverlayClick}>
        <ModalContainer $isClosing={isClosing}>
          <CloseButton onClick={handleClose}>×</CloseButton>
          <ModalContent>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '200px',
              fontSize: '16px',
              color: '#6b7280'
            }}>
              Loading raffle details...
            </div>
          </ModalContent>
        </ModalContainer>
      </ModalOverlay>,
      document.body
    );
  }

  // Show error state
  if (detailsError) {
    return ReactDOM.createPortal(
      <ModalOverlay $isClosing={isClosing} onClick={handleOverlayClick}>
        <ModalContainer $isClosing={isClosing}>
          <CloseButton onClick={handleClose}>×</CloseButton>
          <ModalContent>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '200px',
              textAlign: 'center',
              padding: '20px'
            }}>
              <div style={{ color: '#ef4444', fontSize: '18px', marginBottom: '8px' }}>
                Error Loading Raffle
              </div>
              <div style={{ color: '#6b7280', fontSize: '14px' }}>
                {detailsError}
              </div>
            </div>
          </ModalContent>
        </ModalContainer>
      </ModalOverlay>,
      document.body
    );
  }

  // Render full modal
  return ReactDOM.createPortal(
    <ModalOverlay $isClosing={isClosing} onClick={handleOverlayClick}>
      <ModalContainer $isClosing={isClosing}>
        <CloseButton onClick={handleClose}>×</CloseButton>
        
        {/* Modal Header */}
        <ModalHeader raffle={currentRaffle} />
        
        {/* Modal Content */}
        <ModalContent>
          {/* NFT Header Section */}
          {currentRaffle?.prizeType === 'NFT' && (
            <div style={{ 
              display: 'flex', 
              gap: '20px',
              marginBottom: '24px',
              padding: '20px',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0'
            }}>
              {/* NFT Image - Left Side */}
              {currentRaffle?.metadata?.image && (
                <div style={{ 
                  flexShrink: 0,
                  width: '120px',
                  height: '120px',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: '1px solid #e2e8f0'
                }}>
                  <img 
                    src={currentRaffle.metadata.image} 
                    alt={currentRaffle.metadata?.name || 'NFT'}
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover' 
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              {/* NFT Info - Right Side */}
              <div style={{ 
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <h2 style={{ 
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#1f2937',
                  lineHeight: '1.2'
                }}>
                  {currentRaffle.metadata?.name || currentRaffle.prizeMetadata?.name || currentRaffle.title || 'NFT Prize'}
                </h2>
                
                {currentRaffle.metadata?.collectionName && (
                  <div style={{ 
                    fontSize: '16px',
                    color: '#6b7280',
                    fontWeight: '500'
                  }}>
                    Collection: {currentRaffle.metadata.collectionName}
                  </div>
                )}
                
                <div style={{ 
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  marginTop: '8px'
                }}>
                  <span style={{
                    padding: '4px 12px',
                    background: '#6930c3',
                    color: 'white',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    NFT Prize
                  </span>
                  <span style={{
                    padding: '4px 12px',
                    background: currentRaffle.status === 'ACTIVE' ? '#d4edda' : '#f8d7da',
                    color: currentRaffle.status === 'ACTIVE' ? '#155724' : '#721c24',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    {currentRaffle.status === 'ACTIVE' ? 'Active' : 'Ended'}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {/* Sliding Tabs */}
          <SlidingTabs 
            tabs={[
              {
                label: 'Raffle Info',
                content: (
                  <div>
                    <RaffleInfo raffle={currentRaffle} />
                    <ParticipationForm 
                      raffle={currentRaffle}
                      authenticated={authenticated}
                      onParticipate={(data) => {
                        // Call parent callback if provided
                        if (onParticipate) {
                          onParticipate(data);
                        }
                        // Refresh raffle data after successful purchase
                        if (refetch) {
                          // Immediate refresh
                          refetch();
                          
                          // Additional refresh after 3 seconds to catch blockchain updates
                          setTimeout(() => {
                            refetch();
                          }, 3000);
                        }
                      }}
                    />
                    <WinnerInfo raffle={currentRaffle} />
                  </div>
                )
              },
              {
                label: 'Participants',
                content: <Participants raffleId={raffleId} isOpen={isOpen} />
              }
            ]}
          />
        </ModalContent>
      </ModalContainer>
    </ModalOverlay>,
    document.body
  );
};

export default RaffleDetailsModal; 