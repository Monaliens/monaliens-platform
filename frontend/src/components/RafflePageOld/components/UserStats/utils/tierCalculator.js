import { TIER_REQUIREMENTS, TIER_ORDER } from '../data/tierConfig';

// Calculate user's current tier based on activity
export const calculateUserTier = (userStats) => {
  const totalActivity = userStats.totalRafflesCreated + userStats.totalRafflesParticipated;
  
  if (totalActivity >= TIER_REQUIREMENTS.DIAMOND) return 'DIAMOND';
  if (totalActivity >= TIER_REQUIREMENTS.PLATINUM) return 'PLATINUM';
  if (totalActivity >= TIER_REQUIREMENTS.GOLD) return 'GOLD';
  if (totalActivity >= TIER_REQUIREMENTS.SILVER) return 'SILVER';
  return 'BRONZE';
};

// Calculate progress to next tier
export const calculateNextTierProgress = (userStats, currentTier) => {
  const totalActivity = userStats.totalRafflesCreated + userStats.totalRafflesParticipated;
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  
  // If already at highest tier
  if (currentIndex === TIER_ORDER.length - 1) {
    return { 
      progress: 100, 
      nextTier: null, 
      required: 0,
      isMaxTier: true
    };
  }
  
  const nextTier = TIER_ORDER[currentIndex + 1];
  const requiredForNext = TIER_REQUIREMENTS[nextTier];
  const progress = Math.min((totalActivity / requiredForNext) * 100, 100);
  const remainingRequired = Math.max(requiredForNext - totalActivity, 0);
  
  return { 
    progress, 
    nextTier, 
    required: remainingRequired,
    isMaxTier: false
  };
};

// Get tier display information
export const getTierDisplayInfo = (tier) => {
  return {
    name: tier,
    displayName: `${tier} Member`,
    requirement: TIER_REQUIREMENTS[tier],
    order: TIER_ORDER.indexOf(tier)
  };
}; 