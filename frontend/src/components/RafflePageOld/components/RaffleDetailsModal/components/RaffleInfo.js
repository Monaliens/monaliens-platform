import React, { useState } from 'react';
import {
  Description,
  DetailsSection,
  SectionTitle,
  AttributesTags,
  AttributeTag,
  ProgressSection,
  ProgressBar,
  ProgressFill,
  ProgressText
} from '../styles';
import { calculateTimeProgress } from '../utils/timeUtils';
import { shouldShowNFTMetadata, getNFTAttributes, isRaffleActive } from '../utils/modalHelpers';
import { useTimeRemaining } from '../hooks/useTimeRemaining';

// Description truncation utility
const truncateDescription = (text, maxLength = 150) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  // Find the last space before maxLength to avoid cutting words
  const truncated = text.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  if (lastSpaceIndex === -1) {
    return truncated + '...';
  }
  
  return truncated.substring(0, lastSpaceIndex) + '...';
};

const RaffleInfo = ({ raffle }) => {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  if (!raffle) return null;

  const showNFTMetadata = shouldShowNFTMetadata(raffle);
  const nftAttributes = getNFTAttributes(raffle);
  
  // Time progress calculation and live time remaining
  const timePercentage = calculateTimeProgress(raffle.startTime, raffle.endTime);
  const isActive = isRaffleActive(raffle);
  const { timeRemaining, isEnded } = useTimeRemaining(raffle?.endTime, isActive);
  
  // Check if description needs truncation
  const hasLongDescription = raffle.description && raffle.description.length > 150;
  const displayDescription = hasLongDescription && !isDescriptionExpanded 
    ? truncateDescription(raffle.description) 
    : raffle.description;

  // Get NFT metadata if available
  const nftMetadata = raffle.prizeType === 'NFT' ? raffle.metadata : null;

  return (
    <>
      {/* Description */}
      {raffle.description && (
        <div style={{ marginBottom: '24px' }}>
          <Description>{displayDescription}</Description>
          {hasLongDescription && (
            <button
              onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
              style={{
                background: 'none',
                border: 'none',
                color: '#6930c3',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                padding: '0',
                marginTop: '8px',
                textDecoration: 'underline'
              }}
            >
              {isDescriptionExpanded ? 'Show Less' : 'Show More'}
            </button>
          )}
        </div>
      )}

      {/* NFT Attributes */}
      {showNFTMetadata && nftAttributes.length > 0 && (
        <DetailsSection>
          <SectionTitle>Attributes</SectionTitle>
          <AttributesTags>
            {nftAttributes.map((attr, index) => (
              <AttributeTag key={index}>
                {attr.trait}: {attr.value}
              </AttributeTag>
            ))}
          </AttributesTags>
        </DetailsSection>
      )}

      {/* Prize Information - Redesigned */}
      <DetailsSection>
        <SectionTitle>Prize Information</SectionTitle>
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{
            flex: 1,
            padding: '16px',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              fontWeight: '500',
              marginBottom: '4px',
              textTransform: 'uppercase'
            }}>
              Prize Type
            </div>
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1f2937'
            }}>
              {raffle.prizeType === 'NFT' ? 'NFT Prize' : `${raffle.prizeAmountFormatted || raffle.prizeAmount} ${raffle.ticketTokenSymbol || 'MON'}`}
            </div>
          </div>
          
          <div style={{
            flex: 1,
            padding: '16px',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              fontWeight: '500',
              marginBottom: '4px',
              textTransform: 'uppercase'
            }}>
              Ticket Price
            </div>
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1f2937'
            }}>
              {raffle.ticketPriceFormatted || raffle.ticketPrice || 0} {raffle.ticketTokenSymbol || 'MON'}
            </div>
          </div>
          
          <div style={{
            flex: 1,
            padding: '16px',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              fontWeight: '500',
              marginBottom: '4px',
              textTransform: 'uppercase'
            }}>
              Max Per Wallet
            </div>
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1f2937'
            }}>
              {raffle.maxTicketsPerWallet || 'Unlimited'}
            </div>
          </div>
        </div>
      </DetailsSection>

      {/* Raffle Statistics - Redesigned */}
      <DetailsSection>
        <SectionTitle>Raffle Statistics</SectionTitle>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          marginBottom: '12px'
        }}>
          <div style={{
            padding: '16px',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              fontWeight: '500',
              marginBottom: '4px',
              textTransform: 'uppercase'
            }}>
              Tickets Remaining
            </div>
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1f2937'
            }}>
              {raffle.remainingTickets || 0} / {raffle.totalTickets || 0}
            </div>
          </div>
          
          <div style={{
            padding: '16px',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              fontWeight: '500',
              marginBottom: '4px',
              textTransform: 'uppercase'
            }}>
              Tickets Sold
            </div>
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1f2937'
            }}>
              {raffle.totalTicketsSold || 0}
            </div>
          </div>
        </div>
        
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{
            flex: 1,
            padding: '16px',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              fontWeight: '500',
              marginBottom: '4px',
              textTransform: 'uppercase'
            }}>
              Participants
            </div>
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1f2937'
            }}>
              {raffle.totalParticipants || 0}
            </div>
          </div>
          
          <div style={{
            flex: 1,
            padding: '16px',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              fontWeight: '500',
              marginBottom: '4px',
              textTransform: 'uppercase'
            }}>
              Platform Fee
            </div>
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1f2937'
            }}>
              {raffle.platformFeePercentage > 100 ? (raffle.platformFeePercentage / 100).toFixed(1) : raffle.platformFeePercentage || 5}%
            </div>
          </div>
        </div>
      </DetailsSection>

      {/* Time Progress & Remaining - Combined */}
      {isActive && !isEnded && (
        <ProgressSection>
          <SectionTitle>Time Progress</SectionTitle>
          
          {/* Time Remaining Display */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '16px',
            padding: '16px',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0'
          }}>
            {/* Live countdown breakdown */}
            <div style={{
              display: 'flex',
              gap: '16px',
              alignItems: 'center'
            }}>
              {timeRemaining.days > 0 && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: '50px'
                }}>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#6930c3'
                  }}>
                    {timeRemaining.days}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    fontWeight: '500'
                  }}>
                    Days
                  </div>
                </div>
              )}
              
              {timeRemaining.hours > 0 && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: '50px'
                }}>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#6930c3'
                  }}>
                    {timeRemaining.hours}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    fontWeight: '500'
                  }}>
                    Hours
                  </div>
                </div>
              )}
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: '50px'
              }}>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#6930c3'
                }}>
                  {timeRemaining.minutes}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  fontWeight: '500'
                }}>
                  Min
                </div>
              </div>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: '50px'
              }}>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#6930c3'
                }}>
                  {timeRemaining.seconds || 0}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  fontWeight: '500'
                }}>
                  Sec
                </div>
              </div>
            </div>
          </div>
          
          {/* Animated Progress Bar */}
          <div style={{
            position: 'relative',
            background: '#f1f5f9',
            borderRadius: '8px',
            height: '12px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: 'linear-gradient(90deg, #6930c3 0%, #8b5cf6 50%, #a855f7 100%)',
              height: '100%',
              width: `${Math.min(timePercentage, 100)}%`,
              borderRadius: '8px',
              transition: 'width 0.3s ease',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Animated shimmer effect */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                animation: 'shimmer 2s infinite'
              }} />
            </div>
          </div>
          
          <ProgressText>
            <span>Time Elapsed</span>
            <span>{timePercentage.toFixed(1)}% complete</span>
          </ProgressText>
        </ProgressSection>
      )}

      {/* Add shimmer keyframes */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            left: -100%;
          }
          100% {
            left: 100%;
          }
        }
      `}</style>
    </>
  );
};

export default RaffleInfo; 