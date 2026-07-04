// Number formatting utilities
export const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

// Currency formatting utility
export const formatCurrency = (amount, symbol = 'MON') => {
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K ${symbol}`;
  if (amount < 0.001) return `< 0.001 ${symbol}`;
  return `${amount.toFixed(3)} ${symbol}`;
};

// Percentage formatting utility
export const formatPercentage = (value, decimals = 1) => {
  const formatted = value.toFixed(decimals);
  return value >= 0 ? `+${formatted}%` : `${formatted}%`;
};

// Address truncation utility
export const formatAddress = (address, startLength = 6, endLength = 4) => {
  if (!address) return '';
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
};

// User display name utility
export const getDisplayName = (userProfile) => {
  if (userProfile.username) return userProfile.username;
  if (userProfile.address) return formatAddress(userProfile.address);
  return 'User';
};

// Generic value formatter based on type
export const formatValue = (value, type, symbol = 'MON') => {
  switch (type) {
    case 'number':
      return formatNumber(value);
    case 'currency':
      return formatCurrency(value, symbol);
    case 'percentage':
      return formatPercentage(value);
    default:
      return value.toString();
  }
}; 