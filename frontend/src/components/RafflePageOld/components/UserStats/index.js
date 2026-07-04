import React from 'react';
import { StatsContainer } from './styles';
import { useUserStats } from './hooks/useUserStats';
import LoadingState from './components/LoadingState';
import UserHeader from './components/UserHeader';
import StatsGrid from './components/StatsGrid';
import TierProgress from './components/TierProgress';

/**
 * UserStats Component - SOLID Principles Applied
 * 
 * Single Responsibility: Composes user statistics display
 * Open/Closed: Extensible through new sub-components
 * Liskov Substitution: Props are consistent interfaces
 * Interface Segregation: Components receive only needed props
 * Dependency Inversion: Depends on abstractions via hooks
 */
const UserStats = ({ userProfile, loading = false }) => {
  // Use custom hook to handle all business logic
  const statsData = useUserStats(userProfile);


  // Early return for no data
  if (!statsData.hasData) {
    return null;
  }

  return (
    <StatsContainer>
      <UserHeader 
        displayName={statsData.displayName}
        userInfo={statsData.userInfo}
        tier={statsData.tier}
      />
      
      <StatsGrid 
        statCardData={statsData.statCardData}
        derivedStats={statsData.derivedStats}
      />
      
      <TierProgress 
        tierProgress={statsData.tierProgress}
      />
    </StatsContainer>
  );
};

export default UserStats; 