import { useState, useEffect } from 'react';
import { formatTimeRemaining, isRaffleTimeEnded } from '../utils/timeUtils';

export const useTimeRemaining = (endTime, isActive = true) => {
  const [timeRemaining, setTimeRemaining] = useState(() => formatTimeRemaining(endTime));

  // Update time remaining
  const updateTimeRemaining = () => {
    const newTimeRemaining = formatTimeRemaining(endTime);
    setTimeRemaining(newTimeRemaining);
    return newTimeRemaining;
  };

  // Live time updates
  useEffect(() => {
    if (!isActive || !endTime) {
      setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: true });
      return;
    }

    // Initial update
    updateTimeRemaining();

    // Set up interval for live updates
    const interval = setInterval(() => {
      const newTimeRemaining = updateTimeRemaining();
      // Stop interval if time ended
      if (newTimeRemaining.ended) {
        clearInterval(interval);
      }
    }, 1000); // Update every second

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [endTime, isActive]);

  // Derived states
  const isEnded = timeRemaining.ended || isRaffleTimeEnded(endTime);
  const hasTime = !isEnded && (timeRemaining.days > 0 || timeRemaining.hours > 0 || timeRemaining.minutes > 0 || timeRemaining.seconds > 0);

  // Format time display
  const formatDisplay = () => {
    if (isEnded) return 'Ended';
    
    const parts = [];
    if (timeRemaining.days > 0) parts.push(`${timeRemaining.days}d`);
    if (timeRemaining.hours > 0) parts.push(`${timeRemaining.hours}h`);
    if (timeRemaining.minutes > 0) parts.push(`${timeRemaining.minutes}m`);
    if (timeRemaining.seconds > 0 && timeRemaining.days === 0 && timeRemaining.hours === 0) parts.push(`${timeRemaining.seconds}s`);
    
    if (parts.length === 0) return 'Less than 1 second';
      
    return parts.join(' ');
  };

  // Get urgency level for styling
  const getUrgencyLevel = () => {
    if (isEnded) return 'ended';
    
    const totalMinutes = (timeRemaining.days * 24 * 60) + (timeRemaining.hours * 60) + timeRemaining.minutes;
    
    if (totalMinutes <= 60) return 'critical'; // Less than 1 hour
    if (totalMinutes <= 24 * 60) return 'urgent'; // Less than 1 day
    if (totalMinutes <= 7 * 24 * 60) return 'warning'; // Less than 1 week
    
    return 'normal';
  };

  return {
    // Time data
    timeRemaining,
    isEnded,
    hasTime,
    
    // Formatted displays
    displayText: formatDisplay(),
    urgencyLevel: getUrgencyLevel(),
    
    // Manual update function
    updateTimeRemaining
  };
}; 