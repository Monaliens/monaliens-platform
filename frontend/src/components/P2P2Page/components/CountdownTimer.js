import React, { useState, useEffect } from 'react';
import { CountdownContainer, CountdownLabel, CountdownValue } from '../styles';
import { formatTimeRemaining } from '../utils/constants';

const CountdownTimer = ({ deadline }) => {
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      // Handle ISO date format from API
      const deadlineTime = typeof deadline === 'string' 
        ? new Date(deadline).getTime() 
        : deadline * 1000;
      
      const now = Date.now();
      const remaining = Math.floor((deadlineTime - now) / 1000);
      
      if (remaining <= 0) {
        setTimeRemaining('EXPIRED');
        setIsExpired(true);
        return;
      }
      
      const days = Math.floor(remaining / (24 * 3600));
      const hours = Math.floor((remaining % (24 * 3600)) / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      
      let formatted;
      if (days > 0) formatted = `${days}d ${hours}h ${minutes}m`;
      else if (hours > 0) formatted = `${hours}h ${minutes}m`;
      else formatted = `${minutes}m`;
      
      setTimeRemaining(formatted);
      setIsExpired(false);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  return (
    <CountdownContainer>
      <CountdownLabel>Expires in</CountdownLabel>
      <CountdownValue style={{ color: isExpired ? '#ef4444' : '#f59e0b' }}>
        {timeRemaining}
      </CountdownValue>
    </CountdownContainer>
  );
};

export default CountdownTimer;