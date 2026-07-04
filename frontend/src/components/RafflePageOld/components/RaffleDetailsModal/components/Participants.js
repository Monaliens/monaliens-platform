import React from 'react';
import styled from 'styled-components';
import {
  LoadingSpinner
} from '../styles';
import { useParticipants } from '../hooks/useParticipants';
import { COLOR_CONFIG } from '../data/modalConfig';

// Styled Components for List
const ParticipantsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ParticipantItemContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #cbd5e1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`;

const ParticipantAddress = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${COLOR_CONFIG.text.primary};
`;

const WinChance = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${COLOR_CONFIG.primary};
  text-align: right;
`;

const ParticipantItemComponent = ({ participant, index }) => {
  const { address, totalTickets, totalSpent, winChanceFormatted, purchaseCount } = participant;
  
  // Format address for display
  const formatAddress = (addr) => {
    if (!addr) return 'Unknown';
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  return (
    <ParticipantItemContainer>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flex: 1
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6930c3 0%, #8b5cf6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '14px',
          fontWeight: '600',
          flexShrink: 0
        }}>
          #{index + 1}
        </div>
        
        <div style={{ flex: 1 }}>
          <ParticipantAddress>
            {formatAddress(address)}
          </ParticipantAddress>
          <div style={{
            display: 'flex',
            gap: '16px',
            fontSize: '12px',
            color: '#6b7280',
            marginTop: '4px'
          }}>
            <span>{totalTickets} tickets</span>
            <span>{totalSpent} MONAD</span>
            <span>{purchaseCount} purchases</span>
          </div>
        </div>
      </div>
      
      <WinChance>
        {winChanceFormatted}
      </WinChance>
    </ParticipantItemContainer>
  );
};

const StatsRow = ({ stats }) => {
  if (!stats) return null;

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-around',
      background: '#f8fafc',
      padding: '16px',
      borderRadius: '8px',
      marginBottom: '16px',
      border: '1px solid #e2e8f0'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '18px', fontWeight: '600', color: COLOR_CONFIG.primary }}>
          {stats.totalParticipants}
        </div>
        <div style={{ fontSize: '12px', color: '#6b7280' }}>Participants</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '18px', fontWeight: '600', color: COLOR_CONFIG.primary }}>
          {stats.totalTickets}
        </div>
        <div style={{ fontSize: '12px', color: '#6b7280' }}>Total Tickets</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '18px', fontWeight: '600', color: COLOR_CONFIG.primary }}>
          {stats.averageTicketsPerParticipant}
        </div>
        <div style={{ fontSize: '12px', color: '#6b7280' }}>Avg/Participant</div>
      </div>
    </div>
  );
};

const Participants = ({ raffleId, isOpen }) => {
  const { 
    participants, 
    participantStats, 
    loading, 
    error 
  } = useParticipants(raffleId, isOpen);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '40px',
        color: '#6b7280'
      }}>
        <LoadingSpinner />
        Loading participants...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        textAlign: 'center',
        padding: '40px',
        color: '#ef4444'
      }}>
        Error loading participants: {error}
      </div>
    );
  }

  if (!participants || participants.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center',
        padding: '40px',
        color: '#6b7280'
      }}>
        No participants yet
      </div>
    );
  }

  return (
    <div>
      {/* Participant Statistics */}
      <StatsRow stats={participantStats} />
      
      {/* Participant List */}
      <ParticipantsList>
        {participants.map((participant, index) => (
          <ParticipantItemComponent 
            key={`${participant.address}-${index}`}
            participant={participant} 
            index={index} 
          />
        ))}
      </ParticipantsList>
    </div>
  );
};

export default Participants;