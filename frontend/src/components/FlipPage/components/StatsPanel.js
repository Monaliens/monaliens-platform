import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { getFlipStats } from '../utils/flipApi';
import monadImage from '../../../assets/images/monad.png';

const lmonImage = '/images/lmonphoto.png';

const Container = styled.div`
  background: linear-gradient(135deg, var(--bg-card) 0%, var(--table-header-bg) 100%);
  border: 2px solid var(--border-light);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 8px 25px var(--shadow-color);
  height: fit-content;
  position: sticky;
  top: 2rem;
  opacity: ${props => props.$isHidden ? '0' : '1'};
  transform: ${props => props.$isHidden ? 'scale(0.95)' : 'scale(1)'};
  transition: opacity 0.3s ease, transform 0.3s ease;
  pointer-events: ${props => props.$isHidden ? 'none' : 'auto'};
  ${props => props.$isHidden && `
    position: absolute;
    right: 0;
  `}

  @media (max-width: 1024px) {
    position: static;
    margin-top: 2rem;
    ${props => props.$isHidden && `
      display: none;
    `}
  }

  @media (max-width: 768px) {
    padding: 1.5rem;
    border-radius: 16px;
  }
`;

const Title = styled.h2`
  font-size: 1.5rem;
  font-weight: 800;
  margin-bottom: 1.5rem;
  background: linear-gradient(90deg, #6930c3 0%, #8e44ad 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-align: center;
`;

const StatItem = styled.div`
  margin-bottom: 1.25rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--divider-color);

  &:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
`;

const StatLabel = styled.div`
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StatValue = styled.div`
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;

  span {
    font-size: 1rem;
    color: var(--text-secondary);
    font-weight: 600;
    margin-left: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
`;

const TokenIcon = styled.img`
  width: 20px;
  height: 20px;
  border-radius: 50%;
`;

const LoadingText = styled.div`
  color: var(--text-secondary);
  font-size: 0.9rem;
  text-align: center;
`;

const StatsPanel = ({ isHidden = false }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const initialized = useRef(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getFlipStats();
        
        if (data && data.success) {
          // Only update if data actually changed
          setStats(prevStats => {
            if (prevStats) {
              const prevBalance = JSON.stringify(prevStats.contractBalance);
              const prevVolume = JSON.stringify(prevStats.totalVolume);
              const newBalance = JSON.stringify(data.contractBalance);
              const newVolume = JSON.stringify(data.totalVolume);
              if (prevBalance === newBalance && prevVolume === newVolume) {
                return prevStats; // No change, don't update
              }
            }
            return data;
          });
          setError(null);
        } else {
          // Even if success is false, try to show the data if it exists
          if (data && (data.contractBalance || data.totalVolume)) {
            setStats(prevStats => {
              if (prevStats) {
                const prevBalance = JSON.stringify(prevStats.contractBalance);
                const prevVolume = JSON.stringify(prevStats.totalVolume);
                const newBalance = JSON.stringify(data.contractBalance);
                const newVolume = JSON.stringify(data.totalVolume);
                if (prevBalance === newBalance && prevVolume === newVolume) {
                  return prevStats; // No change, don't update
                }
              }
              return data;
            });
            setError(null);
          } else {
            setError(data?.error || 'Failed to load stats');
            // Don't clear stats if we already have them
            if (!stats) {
              setStats(null);
            }
          }
        }
      } catch (err) {
        setError(err.message || 'Failed to load stats');
        // Don't clear stats on error if we already have them
        if (!stats) {
          setStats(null);
        }
      } finally {
        // Only set loading to false on first load
        if (!initialized.current) {
          setLoading(false);
          initialized.current = true;
        }
      }
    };

    fetchStats();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Container $isHidden={isHidden}>
        <Title>Statistics</Title>
        <LoadingText>Loading stats...</LoadingText>
      </Container>
    );
  }

  // Show error only if we have an error AND no stats data
  if (error && !stats) {
    return (
      <Container $isHidden={isHidden}>
        <Title>Statistics</Title>
        <LoadingText>{error}</LoadingText>
      </Container>
    );
  }

  // Use stats data even if there was an error (fallback data)
  const contractBalance = stats?.contractBalance || {};
  const totalVolume = stats?.totalVolume || {};

  // Format MON values to 2 decimal places
  const formatMON = (value) => {
    if (!value || value === '0') return '0.00';
    const num = parseFloat(value);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  return (
    <Container $isHidden={isHidden}>
      <Title>Statistics</Title>

      <StatItem>
        <StatLabel>Contract Balance</StatLabel>
        <StatValue style={{ fontSize: '1.25rem' }}>
          {formatMON(contractBalance.native?.ether)}
          <span><TokenIcon src={monadImage} alt="MON" />MON</span>
        </StatValue>
        <StatValue style={{ fontSize: '1.25rem', marginTop: '0.25rem' }}>
          {contractBalance.lmon?.ether || '0'}
          <span><TokenIcon src={lmonImage} alt="LMON" />LMON</span>
        </StatValue>
      </StatItem>

      <StatItem>
        <StatLabel>Total Volume</StatLabel>
        <StatValue style={{ fontSize: '1.25rem' }}>
          {formatMON(totalVolume.native?.ether)}
          <span><TokenIcon src={monadImage} alt="MON" />MON</span>
        </StatValue>
        <StatValue style={{ fontSize: '1.25rem', marginTop: '0.25rem' }}>
          {totalVolume.lmon?.ether || '0'}
          <span><TokenIcon src={lmonImage} alt="LMON" />LMON</span>
        </StatValue>
      </StatItem>
    </Container>
  );
};

export default StatsPanel;
