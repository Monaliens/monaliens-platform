/**
 * Format large numbers with K, M suffixes
 */
export const formatNumber = (num) => {
  if (!num && num !== 0) return '0';
  const n = parseFloat(num);
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
};

/**
 * Format large numbers with commas
 */
export const formatNumberWithCommas = (num) => {
  if (!num && num !== 0) return '0';
  return Math.floor(parseFloat(num)).toLocaleString('en-US');
};

/**
 * Format MON amounts
 */
export const formatMON = (amount) => {
  if (!amount) return '0';
  const num = parseFloat(amount);
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  if (num < 1) return num.toFixed(4);
  return num.toFixed(2);
};

/**
 * Truncate wallet address
 */
export const truncateAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Format percentage
 */
export const formatPercentage = (value) => {
  if (!value && value !== 0) return '0%';
  return parseFloat(value).toFixed(1) + '%';
};

/**
 * Get game letter for icon
 */
export const getGameLetter = (game) => {
  const letters = {
    flip: 'F',
    mines: 'M',
    dice: 'D',
    limbo: 'L',
    hilo: 'H',
    blackjack: 'B',
    keno: 'K',
  };
  return letters[game?.toLowerCase()] || game?.[0]?.toUpperCase() || '?';
};

/**
 * Get game display name
 */
export const getGameName = (game) => {
  const names = {
    flip: 'Coin Flip',
    mines: 'Mines',
    dice: 'Dice',
    limbo: 'Limbo',
    hilo: 'Hi-Lo',
    blackjack: 'BJ',
    keno: 'Keno',
  };
  return names[game?.toLowerCase()] || game;
};

/**
 * Format date for display
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Get month name from date
 */
export const getMonthName = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short' });
};

/**
 * Get month names array
 */
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Get hour display (12-hour format)
 */
export const formatHour = (hour) => {
  if (hour === undefined || hour === null) return '';
  const h = parseInt(hour);
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
};

/**
 * Process calendar data into monthly groups for visualization
 */
export const processCalendarByMonth = (calendar) => {
  if (!calendar || Object.keys(calendar).length === 0) return {};

  const monthlyData = {};
  let maxSpins = 0;

  Object.entries(calendar).forEach(([dateStr, data]) => {
    const date = new Date(dateStr);
    const month = date.getMonth();
    const day = date.getDate();
    const spins = data.spins || 0;

    if (!monthlyData[month]) {
      monthlyData[month] = {};
    }
    monthlyData[month][day] = {
      spins,
      rewardsMon: parseFloat(data.rewardsMon) || 0,
      winRate: parseFloat(data.winRate) || 0,
    };

    if (spins > maxSpins) maxSpins = spins;
  });

  return { monthlyData, maxSpins };
};

/**
 * Generate calendar grid for a specific month
 */
export const generateMonthGrid = (month, monthData, maxSpins) => {
  const year = new Date().getFullYear();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  // Create array of weeks, each week is an array of 7 days
  const weeks = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dayOfWeek = (startDayOfWeek + day - 1) % 7;
    const weekIndex = Math.floor((startDayOfWeek + day - 1) / 7);

    if (!weeks[weekIndex]) {
      weeks[weekIndex] = new Array(7).fill(null);
    }

    const dayData = monthData?.[day];
    weeks[weekIndex][dayOfWeek] = {
      day,
      spins: dayData?.spins || 0,
      intensity: maxSpins > 0 && dayData?.spins ? dayData.spins / maxSpins : 0,
      rewardsMon: dayData?.rewardsMon || 0,
    };
  }

  return weeks;
};

/**
 * Process hourly distribution for bar chart
 */
export const processHourlyData = (hourlyDistribution) => {
  if (!hourlyDistribution) return [];

  const hours = [];
  let maxCount = 0;

  for (let h = 0; h < 24; h++) {
    const count = hourlyDistribution[h] || 0;
    if (count > maxCount) maxCount = count;
    hours.push({ hour: h, count });
  }

  return hours.map(h => ({
    ...h,
    percentage: maxCount > 0 ? (h.count / maxCount) * 100 : 0,
    label: formatHour(h.hour),
  }));
};

/**
 * Process daily distribution for bar chart
 */
export const processDailyData = (dailyDistribution) => {
  if (!dailyDistribution) return [];

  const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let maxCount = 0;

  const data = dayOrder.map(day => {
    const count = dailyDistribution[day] || 0;
    if (count > maxCount) maxCount = count;
    return { day, count, label: day.slice(0, 3) };
  });

  return data.map(d => ({
    ...d,
    percentage: maxCount > 0 ? (d.count / maxCount) * 100 : 0,
  }));
};

/**
 * Process monthly data for bar chart
 */
export const processMonthlyData = (calendar) => {
  if (!calendar) return [];

  const monthlyTotals = {};
  let maxCount = 0;

  Object.entries(calendar).forEach(([dateStr, data]) => {
    const month = new Date(dateStr).getMonth();
    if (!monthlyTotals[month]) monthlyTotals[month] = 0;
    monthlyTotals[month] += data.spins || 0;
  });

  const data = MONTH_NAMES.map((name, index) => {
    const count = monthlyTotals[index] || 0;
    if (count > maxCount) maxCount = count;
    return { month: index, name, count };
  });

  return data.map(d => ({
    ...d,
    percentage: maxCount > 0 ? (d.count / maxCount) * 100 : 0,
  }));
};

/**
 * Get casino games with data
 */
export const getCasinoGames = (casino) => {
  if (!casino) return [];

  const games = ['flip', 'mines', 'dice', 'limbo', 'hilo', 'blackjack', 'keno'];

  return games
    .filter(game => casino[game]?.totalGames > 0)
    .map(game => ({
      name: game,
      displayName: getGameName(game),
      letter: getGameLetter(game),
      ...casino[game],
      profitLoss: parseFloat(casino[game].profitLossMon) || 0,
    }))
    .sort((a, b) => b.totalGames - a.totalGames);
};

/**
 * Calculate casino summary
 */
export const getCasinoSummary = (casino) => {
  if (!casino) return null;

  const games = getCasinoGames(casino);
  if (games.length === 0) return null;

  let totalGames = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let totalProfit = 0;
  let totalWagered = 0;
  let favoriteGame = games[0];

  games.forEach(game => {
    totalGames += game.totalGames;
    totalWins += game.wins;
    totalLosses += game.losses;
    totalProfit += game.profitLoss;
    totalWagered += parseFloat(game.volumeMon) || 0;
  });

  return {
    totalGames,
    totalWins,
    totalLosses,
    winRate: totalGames > 0 ? (totalWins / totalGames) * 100 : 0,
    totalProfit,
    totalWagered,
    isProfit: totalProfit >= 0,
    favoriteGame,
    games,
  };
};

/**
 * Determine which slides to show based on available data
 */
export const getAvailableSlides = (data) => {
  if (!data) return [];

  const slides = ['intro'];

  // Spin slides
  const hasSpinData = data.overall?.hasSpinMainnet || data.overall?.hasSpinTestnet;
  if (hasSpinData) {
    slides.push('spin-total');

    const spinData = data.spin?.mainnet || data.spin?.testnet;
    if (spinData?.calendar && Object.keys(spinData.calendar).length > 0) {
      slides.push('spin-calendar');
    }

    if (spinData?.hourlyDistribution || spinData?.dailyDistribution) {
      slides.push('spin-when');
    }

    if (spinData?.biggestWin && parseFloat(spinData.biggestWin.amountMon) > 0) {
      slides.push('spin-biggest');
    }
  }

  // Casino slides
  if (data.overall?.hasCasino && data.overall?.totalCasinoGames > 0) {
    slides.push('casino-total');
    slides.push('casino-games');
  }

  // Raffle slides
  const raffleTickets = (data.raffle?.mainnet?.totalTickets || 0) + (data.raffle?.testnet?.totalTickets || 0);
  if (raffleTickets > 0) {
    slides.push('raffle');
  }

  // Summary slide
  slides.push('summary');

  return slides;
};

/**
 * Get narrative text for spin count
 */
export const getSpinNarrative = (totalSpins) => {
  if (totalSpins >= 1000) return "You were unstoppable.";
  if (totalSpins >= 500) return "You kept the wheel spinning.";
  if (totalSpins >= 100) return "You showed up consistently.";
  if (totalSpins >= 50) return "You found your rhythm.";
  return "You gave it a shot.";
};

/**
 * Get narrative text for casino
 */
export const getCasinoNarrative = (summary) => {
  if (!summary) return "";
  if (summary.totalProfit >= 1000) return "You played like a pro.";
  if (summary.totalProfit > 0) return "Luck was on your side.";
  if (summary.totalProfit > -100) return "You held your ground.";
  return "Win or lose, you had fun.";
};

/**
 * Get favorite day narrative
 */
export const getDayNarrative = (day) => {
  const narratives = {
    'Monday': "Mondays were your thing.",
    'Tuesday': "You loved Tuesdays.",
    'Wednesday': "Wednesdays were lucky.",
    'Thursday': "Thursdays hit different.",
    'Friday': "TGIF - you showed up.",
    'Saturday': "Weekend warrior.",
    'Sunday': "Sunday funday.",
  };
  return narratives[day] || `${day} was your favorite.`;
};

/**
 * Get peak hour narrative
 */
export const getHourNarrative = (hour) => {
  const h = parseInt(hour);
  if (h >= 5 && h < 9) return "Early bird gets the rewards.";
  if (h >= 9 && h < 12) return "Morning grinder.";
  if (h >= 12 && h < 14) return "Lunch break spinner.";
  if (h >= 14 && h < 18) return "Afternoon warrior.";
  if (h >= 18 && h < 22) return "Evening energy.";
  return "Night owl vibes.";
};
