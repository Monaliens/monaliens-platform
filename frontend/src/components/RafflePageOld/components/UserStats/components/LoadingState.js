import React from 'react';
import {
  StatsContainer,
  StatsHeader,
  UserInfo,
  UserDetails,
  StatsGrid,
  StatCard,
  LoadingSkeleton
} from '../styles';
import { LOADING_CONFIG } from '../data/statsConfig';

const LoadingState = () => {
  const { skeletonCount, avatarSize, headerHeight, subHeaderHeight, statValueHeight, statLabelHeight } = LOADING_CONFIG;

  return (
    <StatsContainer>
      <StatsHeader>
        <UserInfo>
          <LoadingSkeleton 
            height={avatarSize} 
            width={avatarSize} 
            style={{ borderRadius: '50%' }} 
          />
          <UserDetails>
            <LoadingSkeleton height={headerHeight} width="150px" />
            <LoadingSkeleton height={subHeaderHeight} width="100px" />
          </UserDetails>
        </UserInfo>
        <LoadingSkeleton height="32px" width="100px" />
      </StatsHeader>
      
      <StatsGrid>
        {[...Array(skeletonCount)].map((_, index) => (
          <StatCard key={index}>
            <LoadingSkeleton height={statValueHeight} width="60px" />
            <LoadingSkeleton height={statLabelHeight} width="80%" />
          </StatCard>
        ))}
      </StatsGrid>
    </StatsContainer>
  );
};

export default LoadingState; 