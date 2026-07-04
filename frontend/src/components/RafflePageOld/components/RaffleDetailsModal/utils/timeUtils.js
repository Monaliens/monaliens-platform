// Time remaining calculation utility
export const formatTimeRemaining = (endTime) => {
  if (!endTime) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, ended: true };
  }

  const now = new Date();
  const end = new Date(endTime);
  const diff = end - now;
  
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, ended: true };
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { days, hours, minutes, seconds, ended: false };
};

// Format date for display
export const formatDate = (date, options = {}) => {
  if (!date) return '';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  const formatOptions = { ...defaultOptions, ...options };
  
  return new Date(date).toLocaleDateString('en-US', formatOptions);
};

// Check if raffle is ended based on time
export const isRaffleTimeEnded = (endTime) => {
  if (!endTime) return false;
  return new Date() > new Date(endTime);
};

// Get readable time remaining string
export const getTimeRemainingString = (endTime) => {
  const timeData = formatTimeRemaining(endTime);
  
  if (timeData.ended) return 'Ended';
  
  const parts = [];
  if (timeData.days > 0) parts.push(`${timeData.days}d`);
  if (timeData.hours > 0) parts.push(`${timeData.hours}h`);
  if (timeData.minutes > 0) parts.push(`${timeData.minutes}m`);
  if (timeData.seconds > 0 && timeData.days === 0 && timeData.hours === 0) parts.push(`${timeData.seconds}s`);
  
  if (parts.length === 0) return 'Less than 1 second';
  
  return parts.join(' ');
};

// Calculate progress percentage based on time
export const calculateTimeProgress = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  if (now <= start) return 0;
  if (now >= end) return 100;
  
  const totalDuration = end - start;
  const elapsed = now - start;
  
  return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
}; 