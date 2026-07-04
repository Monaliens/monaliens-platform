import { useMemo } from 'react';
import { calculateDerivedStats, getActivitySummary, getStatCardData } from '../utils/statsCalculator';
import { calculateUserTier, calculateNextTierProgress } from '../utils/tierCalculator';
import { getDisplayName } from '../utils/formatters';
import { USER_DISPLAY_CONFIG } from '../data/tierConfig';

// Custom hook for managing user stats business logic
export const useUserStats = (userProfile) => {
  const processedData = useMemo(() => {
    if (!userProfile || !userProfile.userStats) {
      return {
        hasData: false,
        displayName: 'User',
        tier: 'BRONZE',
        derivedStats: { winRate: 0, avgSpent: 0, roi: 0 },
        tierProgress: { progress: 0, nextTier: null, required: 0, isMaxTier: false },
        activitySummary: { totalActivity: 0, isActive: false },
        statCardData: {},
        userInfo: { isVerified: false, memberSince: USER_DISPLAY_CONFIG.defaultYear }
      };
    }

    const { userStats } = userProfile;
    
    // Calculate derived statistics
    const derivedStats = calculateDerivedStats(userStats);
    
    // Calculate user tier
    const tier = calculateUserTier(userStats);
    
    // Calculate tier progress
    const tierProgress = calculateNextTierProgress(userStats, tier);
    
    // Get activity summary
    const activitySummary = getActivitySummary(userStats);
    
    // Get formatted display name
    const displayName = getDisplayName(userProfile);
    
    // Get stat card data
    const statCardData = getStatCardData(userStats, derivedStats);
    
    // User info
    const userInfo = {
      isVerified: userProfile.isVerified || false,
      memberSince: USER_DISPLAY_CONFIG.defaultYear,
      avatar: userProfile.avatar,
      address: userProfile.address,
      username: userProfile.username
    };

    return {
      hasData: true,
      displayName,
      tier,
      derivedStats,
      tierProgress,
      activitySummary,
      statCardData,
      userInfo
    };
  }, [userProfile]);

  return processedData;
}; 