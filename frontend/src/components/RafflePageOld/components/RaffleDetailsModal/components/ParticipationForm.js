import React from 'react';
import {
  ParticipationSection,
  SectionTitle,
  TicketControls,
  QuantityLabel,
  QuantityButton,
  QuantityInput,
  CostSummary,
  CostRow,
  ParticipateButton
} from '../styles';
import { COST_SUMMARY_CONFIG } from '../data/participationConfig';
import { useParticipation } from '../hooks/useParticipation';
import { isRaffleActive } from '../utils/modalHelpers';
import LoadingSpinner from './LoadingSpinner';

// Add CSS for spinner animation
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
if (!document.head.querySelector('style[data-spinner]')) {
  spinnerStyle.setAttribute('data-spinner', 'true');
  document.head.appendChild(spinnerStyle);
}

const ParticipationForm = ({ raffle, authenticated, onParticipate }) => {
  const isActive = isRaffleActive(raffle);
  
  const {
    ticketQuantity,
    loading,
    error,
    totalCost,
    txHash,
    progress,
    handleQuantityChange,
    handleQuantityInput,
    handleParticipate,
    canIncreaseQuantity,
    canDecreaseQuantity,
    buttonText,
    isButtonDisabled,
    isProcessing
  } = useParticipation(raffle, authenticated, onParticipate);

  // Don't show participation form if raffle is not active
  if (!isActive) {
    return null;
  }

  return (
    <ParticipationSection>
      <SectionTitle>Buy Tickets</SectionTitle>
      
      {/* Error Display */}
      {error && (
        <div style={{ 
          color: '#dc2626', 
          background: '#fef2f2', 
          padding: '12px', 
          borderRadius: '8px', 
          marginBottom: '16px',
          fontSize: '14px',
          border: '1px solid #fecaca',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '16px' }}>⚠️</span>
          {error}
        </div>
      )}
      
      {/* Max Tickets Warning */}
      {raffle?.maxTicketsPerWallet && ticketQuantity >= raffle.maxTicketsPerWallet && (
        <div style={{ 
          color: '#d97706', 
          background: '#fffbeb', 
          padding: '12px', 
          borderRadius: '8px', 
          marginBottom: '16px',
          fontSize: '14px',
          border: '1px solid #fed7aa',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '16px' }}>ℹ️</span>
          You've reached the maximum tickets per wallet ({raffle.maxTicketsPerWallet})
        </div>
      )}

      {/* Progress Display */}
      {progress && (
        <div style={{ 
          color: '#1d4ed8', 
          background: '#eff6ff', 
          padding: '12px', 
          borderRadius: '8px', 
          marginBottom: '16px',
          fontSize: '14px',
          border: '1px solid #bfdbfe',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {isProcessing && (
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid #bfdbfe',
              borderTop: '2px solid #1d4ed8',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          )}
          <span>{progress.message}</span>
        </div>
      )}

      {/* Transaction Hash Display */}
      {txHash && (
        <div style={{ 
          color: '#059669', 
          background: '#ecfdf5', 
          padding: '12px', 
          borderRadius: '8px', 
          marginBottom: '16px',
          fontSize: '14px',
          border: '1px solid #a7f3d0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '16px' }}>✅</span>
          <span>Transaction Hash: </span>
          <code style={{
            background: 'rgba(0,0,0,0.1)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            wordBreak: 'break-all'
          }}>
            {txHash.slice(0, 10)}...{txHash.slice(-8)}
          </code>
        </div>
      )}
      
      {/* Quantity Controls */}
      <TicketControls>
        <QuantityLabel>Quantity:</QuantityLabel>
        <QuantityButton 
          onClick={() => handleQuantityChange(-1)}
          disabled={!canDecreaseQuantity || isProcessing}
        >
          −
        </QuantityButton>
        <QuantityInput
          type="number"
          value={ticketQuantity}
          onChange={(e) => handleQuantityInput(e.target.value)}
          min="1"
          max={raffle?.maxTicketsPerWallet || 10}
          disabled={isProcessing}
        />
        <QuantityButton 
          onClick={() => handleQuantityChange(1)}
          disabled={!canIncreaseQuantity || isProcessing}
        >
          +
        </QuantityButton>
      </TicketControls>
      
      {/* Cost Summary */}
      <CostSummary>
        {COST_SUMMARY_CONFIG.rows.map(row => {
          // Skip platform fee if it's 0
          if (row.id === 'platformFee' && (!raffle?.platformFeePercentage || raffle.platformFeePercentage === 0)) {
            return null;
          }
          
          return (
            <CostRow key={row.id} $isPlatformFee={row.isPlatformFee}>
              <span>{row.label}</span>
              <span style={{ fontWeight: row.isTotal ? '600' : 'normal' }}>
                {row.getValue(raffle, ticketQuantity, totalCost)}
              </span>
            </CostRow>
          );
        })}
      </CostSummary>
      
      {/* Participate Button */}
      <ParticipateButton 
        onClick={handleParticipate}
        disabled={isButtonDisabled}
      >
        {isProcessing && <LoadingSpinner />}
        {buttonText}
      </ParticipateButton>
    </ParticipationSection>
  );
};

export default ParticipationForm; 