import React from 'react';
import {
  EndedSection,
  SectionTitle,
  WinnerInfo as StyledWinnerInfo
} from '../styles';
import { WINNER_CONFIG } from '../data/participationConfig';
import { shouldShowWinner } from '../utils/modalHelpers';
import { formatWalletAddress } from '../utils/modalHelpers';
import { formatDate } from '../utils/timeUtils';

const WinnerInfo = ({ raffle }) => {
  const showWinner = shouldShowWinner(raffle);

  // Show for raffles with winner info or transaction hashes
  const hasWinnerInfo = showWinner || raffle?.winner;
  const hasTransactionHashes = raffle?.settlementTransactionHash || raffle?.prizeClaimTransactionHash || raffle?.prizeRefundTransactionHash;
  
  if (!hasWinnerInfo && !hasTransactionHashes) {
    return null;
  }

  return (
    <EndedSection>
      <SectionTitle>{WINNER_CONFIG.title}</SectionTitle>
      <p style={{ color: '#64748b', marginBottom: '16px' }}>
        {WINNER_CONFIG.endedMessage}
      </p>
      
      {/* Winner Information */}
      {raffle?.winner && (
        <StyledWinnerInfo>
          <strong style={{ color: '#1e293b' }}>{WINNER_CONFIG.winnerLabel}</strong>
          <div style={{ fontFamily: 'monospace', marginTop: '8px', fontSize: '14px' }}>
            {formatWalletAddress(raffle.winner)}
          </div>
        </StyledWinnerInfo>
      )}
      
      {/* Winner Draw Date */}
      {raffle?.status === 'DRAWN' && raffle?.winnerDrawnAt && (
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '12px' }}>
          {WINNER_CONFIG.drawnLabel} {formatDate(raffle.winnerDrawnAt, WINNER_CONFIG.dateFormat)}
        </p>
      )}

      {/* Transaction Hashes Section */}
      {(raffle?.settlementTransactionHash || raffle?.prizeClaimTransactionHash || raffle?.prizeRefundTransactionHash) && (
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          background: '#f8fafc', 
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ 
            fontSize: '14px', 
            color: '#6b7280', 
            fontWeight: '600',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Blockchain Transactions
          </div>
          
          {raffle.settlementTransactionHash && (
            <div style={{ marginBottom: (raffle.prizeClaimTransactionHash || raffle.prizeRefundTransactionHash) ? '8px' : '0' }}>
              <a 
                href={`https://testnet.monadexplorer.com/tx/${raffle.settlementTransactionHash}`} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  color: '#1f2937',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.color = '#6930c3'}
                onMouseLeave={(e) => e.target.style.color = '#1f2937'}
              >
                🏆 Draw Winner Transaction
                <span style={{ fontSize: '12px' }}>↗</span>
              </a>
            </div>
          )}
          
          {raffle.prizeClaimTransactionHash && (
            <div style={{ marginBottom: raffle.prizeRefundTransactionHash ? '8px' : '0' }}>
              <a 
                href={`https://testnet.monadexplorer.com/tx/${raffle.prizeClaimTransactionHash}`}
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  color: '#1f2937',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.color = '#6930c3'}
                onMouseLeave={(e) => e.target.style.color = '#1f2937'}
              >
                💰 Prize Claim Transaction
                <span style={{ fontSize: '12px' }}>↗</span>
              </a>
            </div>
          )}
          
          {raffle.prizeRefundTransactionHash && (
            <div>
              <a 
                href={`https://testnet.monadexplorer.com/tx/${raffle.prizeRefundTransactionHash}`}
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  color: '#1f2937',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.color = '#6930c3'}
                onMouseLeave={(e) => e.target.style.color = '#1f2937'}
              >
                🔄 Prize Refund Transaction
                <span style={{ fontSize: '12px' }}>↗</span>
              </a>
            </div>
          )}
        </div>
      )}
    </EndedSection>
  );
};

export default WinnerInfo; 