import React, { useState } from 'react';
import RaffleCard from './RaffleCard';
import { useRaffleData } from '../../../hooks/useRaffleData';
import { sortByTimeRemaining, sortByEndTime, sortByValue } from '../../../utils/raffleHelpers';
import { usePrivyOptimized } from '../../../context';
import {
  AllRafflesContainer,
  AllRafflesHeader,
  AllRafflesGrid
} from '../styles';

/**
 * AllRafflesSection Component - Second section with all raffles and filters
 * Shows all raffles from API with filter options
 * 
 * @returns {JSX.Element} Rendered all raffles section
 */
const AllRafflesSection = () => {
  const { raffles, activeRaffles, endedRaffles, loading, error, refresh } = useRaffleData();
  const { user } = usePrivyOptimized();
  const [filters, setFilters] = useState({
    all: true,
    nft: false,
    token: false,
    active: false,
    ended: false
  });

  // Handle filter toggle
  const toggleFilter = (filterType) => {
    if (filterType === 'all') {
      // If All is selected, clear all other filters
      setFilters({
        all: true,
        nft: false,
        token: false,
        active: false,
        ended: false
      });
    } else {
      // If any other filter is selected, disable 'all' and toggle the specific filter
      setFilters(prev => ({
        ...prev,
        all: false,
        [filterType]: !prev[filterType]
      }));
    }
  };

  // Determine which raffles to show based on multi-filter selection
  const getDisplayedRaffles = () => {
    // If 'all' is selected, show everything sorted by value
    if (filters.all) {
      // Sort all raffles by value (FP for NFT, prize amount for TOKEN)
      return sortByValue(raffles);
    }

    // Start with all raffles
    let filteredRaffles = [...raffles];

    // Apply type filters (NFT/Token)
    if (filters.nft || filters.token) {
      filteredRaffles = filteredRaffles.filter(raffle => {
        if (filters.nft && filters.token) {
          // Both selected - show both types
          return true;
        } else if (filters.nft) {
          // Only NFT selected
          return raffle.isNFTPrize;
        } else if (filters.token) {
          // Only Token selected
          return !raffle.isNFTPrize;
        }
        return false;
      });
    }

    // Apply status filters (Active/Ended)
    if (filters.active || filters.ended) {
      filteredRaffles = filteredRaffles.filter(raffle => {
        const isActive = raffle.isActive && 
                        raffle.status !== 'CLAIMED' && 
                        raffle.status !== 'REFUNDED' &&
                        raffle.timeRemaining > 0;
        const isEnded = !isActive;

        if (filters.active && filters.ended) {
          // Both selected - show both statuses
          return true;
        } else if (filters.active) {
          // Only Active selected
          return isActive;
        } else if (filters.ended) {
          // Only Ended selected
          return isEnded;
        }
        return false;
      });
    }

    // Sort results by FP/value (highest first)
    return sortByValue(filteredRaffles);
  };

  const displayedRaffles = getDisplayedRaffles();

  if (loading) {
    return (
      <AllRafflesContainer>
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          Loading all raffles...
        </div>
      </AllRafflesContainer>
    );
  }

  if (error) {
    return (
      <AllRafflesContainer>
        <div style={{ textAlign: 'center', padding: '40px', color: '#dc2626' }}>
          Error loading raffles: {error}
        </div>
      </AllRafflesContainer>
    );
  }

  // Calculate counts for display
  const nftRaffles = raffles.filter(r => r.isNFTPrize);
  const tokenRaffles = raffles.filter(r => !r.isNFTPrize);

  return (
    <AllRafflesContainer>
      <AllRafflesHeader>
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          flexWrap: 'wrap',
          ...(window.innerWidth <= 768 ? {
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: '8px',
            marginBottom: '8px'
          } : {})
        }}>
          <button
            onClick={() => toggleFilter('all')}
            style={{
              padding: window.innerWidth <= 768 ? '10px 14px' : '8px 16px',
              borderRadius: '8px',
              border: '2px solid',
              borderColor: filters.all ? '#2563eb' : '#e5e7eb',
              backgroundColor: filters.all ? '#2563eb' : 'transparent',
              color: filters.all ? 'white' : '#6b7280',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s',
              minHeight: window.innerWidth <= 768 ? '44px' : 'auto',
              fontSize: window.innerWidth <= 768 ? '14px' : '16px',
              whiteSpace: 'nowrap'
            }}
          >
            All ({raffles.length})
          </button>
          <button
            onClick={() => toggleFilter('nft')}
            style={{
              padding: window.innerWidth <= 768 ? '10px 14px' : '8px 16px',
              borderRadius: '8px',
              border: '2px solid',
              borderColor: filters.nft ? '#7c3aed' : '#e5e7eb',
              backgroundColor: filters.nft ? '#7c3aed' : 'transparent',
              color: filters.nft ? 'white' : '#6b7280',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s',
              minHeight: window.innerWidth <= 768 ? '44px' : 'auto',
              fontSize: window.innerWidth <= 768 ? '14px' : '16px',
              whiteSpace: 'nowrap'
            }}
          >
            NFT ({nftRaffles.length})
          </button>
          <button
            onClick={() => toggleFilter('token')}
            style={{
              padding: window.innerWidth <= 768 ? '10px 14px' : '8px 16px',
              borderRadius: '8px',
              border: '2px solid',
              borderColor: filters.token ? '#ea580c' : '#e5e7eb',
              backgroundColor: filters.token ? '#ea580c' : 'transparent',
              color: filters.token ? 'white' : '#6b7280',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s',
              minHeight: window.innerWidth <= 768 ? '44px' : 'auto',
              fontSize: window.innerWidth <= 768 ? '14px' : '16px',
              whiteSpace: 'nowrap'
            }}
          >
            Token ({tokenRaffles.length})
          </button>
          <button
            onClick={() => toggleFilter('active')}
            style={{
              padding: window.innerWidth <= 768 ? '10px 14px' : '8px 16px',
              borderRadius: '8px',
              border: '2px solid',
              borderColor: filters.active ? '#16a34a' : '#e5e7eb',
              backgroundColor: filters.active ? '#16a34a' : 'transparent',
              color: filters.active ? 'white' : '#6b7280',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s',
              minHeight: window.innerWidth <= 768 ? '44px' : 'auto',
              fontSize: window.innerWidth <= 768 ? '14px' : '16px',
              whiteSpace: 'nowrap'
            }}
          >
            Active ({activeRaffles.length})
          </button>
          <button
            onClick={() => toggleFilter('ended')}
            style={{
              padding: window.innerWidth <= 768 ? '10px 14px' : '8px 16px',
              borderRadius: '8px',
              border: '2px solid',
              borderColor: filters.ended ? '#6b7280' : '#e5e7eb',
              backgroundColor: filters.ended ? '#6b7280' : 'transparent',
              color: filters.ended ? 'white' : '#6b7280',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s',
              minHeight: window.innerWidth <= 768 ? '44px' : 'auto',
              fontSize: window.innerWidth <= 768 ? '14px' : '16px',
              whiteSpace: 'nowrap'
            }}
          >
            Ended ({endedRaffles.length})
          </button>
        </div>
      </AllRafflesHeader>
      
      {displayedRaffles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          No raffles match the selected filters
        </div>
      ) : (
        <AllRafflesGrid>
          {displayedRaffles.map((raffle) => (
            <RaffleCard 
              key={raffle.id} 
              raffle={raffle}
              userAddress={user?.wallet?.address}
              onPurchaseSuccess={refresh}
            />
          ))}
        </AllRafflesGrid>
      )}
    </AllRafflesContainer>
  );
};

export default AllRafflesSection;