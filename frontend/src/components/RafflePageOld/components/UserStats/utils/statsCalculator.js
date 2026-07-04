// Calculate derived statistics from user stats
export const calculateDerivedStats = (userStats) => {
  if (!userStats) {
    return {
      winRate: 0,
      avgSpent: 0,
      roi: 0
    };
  }

  // Win rate calculation
  const winRate = userStats.totalRafflesParticipated > 0 
    ? (userStats.totalWins / userStats.totalRafflesParticipated) * 100 
    : 0;
    
  // Average amount spent per raffle
  const avgSpent = userStats.totalRafflesParticipated > 0 
    ? userStats.totalAmountSpent / userStats.totalRafflesParticipated 
    : 0;
    
  // Return on Investment calculation
  const roi = userStats.totalAmountSpent > 0 
    ? ((userStats.totalPrizesWon - userStats.totalAmountSpent) / userStats.totalAmountSpent) * 100 
    : 0;

  return {
    winRate,
    avgSpent,
    roi
  };
};

// Get activity summary
export const getActivitySummary = (userStats) => {
  const totalActivity = userStats.totalRafflesCreated + userStats.totalRafflesParticipated;
  
  return {
    totalActivity,
    isActive: totalActivity > 0,
    hasWins: userStats.totalWins > 0,
    hasSpent: userStats.totalAmountSpent > 0,
    hasPrizes: userStats.totalPrizesWon > 0
  };
};

// Get stat card data with computed values
export const getStatCardData = (userStats, derivedStats) => {
  return {
    totalRafflesCreated: userStats.totalRafflesCreated,
    totalRafflesParticipated: userStats.totalRafflesParticipated,
    totalWins: userStats.totalWins,
    totalAmountSpent: userStats.totalAmountSpent,
    totalPrizesWon: userStats.totalPrizesWon,
    roi: derivedStats.roi,
    winRate: derivedStats.winRate,
    avgSpent: derivedStats.avgSpent
  };
}; 