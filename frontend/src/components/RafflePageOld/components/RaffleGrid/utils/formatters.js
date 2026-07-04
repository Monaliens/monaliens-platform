// Price formatting utility
export const formatPrice = (price, symbol = 'MON') => {
  const num = parseFloat(price);
  if (num === 0) return 'Free';
  if (num < 0.001) return `< 0.001 ${symbol}`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k ${symbol}`;
  return `${num.toFixed(3)} ${symbol}`;
};

// Time remaining formatting utility
export const formatTimeRemaining = (endTime) => {
  if (!endTime) return 'No end time';
  
  const now = new Date();
  const end = new Date(endTime);
  const diff = end - now;
  
  if (diff <= 0) return 'Ended';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

// Description truncation utility
export const truncateDescription = (description, maxLength = 100) => {
  if (!description) return '';
  if (description.length <= maxLength) return description;
  
  // Find the last space before maxLength to avoid cutting words
  const truncated = description.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  if (lastSpaceIndex === -1) {
    return truncated + '...';
  }
  
  return truncated.substring(0, lastSpaceIndex) + '...';
};

// Number formatting utility for participants, tickets etc.
export const formatNumber = (num) => {
  if (!num || num === 0) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

// Generic value formatter based on type
export const formatValue = (value, type, options = {}) => {
  switch (type) {
    case 'price':
      return formatPrice(value.price, value.symbol);
    case 'time':
      return formatTimeRemaining(value);
    case 'number':
      return formatNumber(value);
    case 'text':
      return truncateDescription(value, options.maxLength);
    default:
      return value?.toString() || '';
  }
}; 