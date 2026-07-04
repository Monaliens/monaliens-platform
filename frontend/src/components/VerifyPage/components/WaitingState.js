import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Users } from 'lucide-react';
import {
  WaitingStateContainer,
  WaitingIcon,
  WaitingTitle,
  WaitingSubtitle,
  WaitingIndicator,
} from '../styles';

const DISCORD_CLIENT_ID = '1358795922519101561';
const REDIRECT_URI = process.env.REACT_APP_FRONTEND_URL ? `${process.env.REACT_APP_FRONTEND_URL}/profile` : 'https://your-domain/profile';

const RegisterButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 32px;
  background: linear-gradient(135deg, #6930c3 0%, #5a28a8 100%);
  color: var(--text-light);
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  font-family: var(--font-primary);
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 8px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(105, 48, 195, 0.35);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  svg {
    width: 20px;
    height: 20px;
  }
`;

/**
 * WaitingState Component
 * Shows register prompt, redirects to Discord OAuth on button click
 */
const WaitingState = () => {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [countdown, setCountdown] = useState(2);

  useEffect(() => {
    if (!isRedirecting) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Redirect to Discord OAuth
          const discordUrl = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=identify`;
          window.location.href = discordUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRedirecting]);

  const handleRegister = () => {
    setIsRedirecting(true);
  };

  return (
    <WaitingStateContainer>
      <WaitingIcon>
        <Users size={32} />
      </WaitingIcon>
      <WaitingTitle>Monaliens Profile</WaitingTitle>
      <WaitingSubtitle>
        {isRedirecting
          ? `Redirecting to Discord in ${countdown}s...`
          : 'Register to invite your friends and earn from their fees!'
        }
      </WaitingSubtitle>
      {!isRedirecting ? (
        <RegisterButton onClick={handleRegister}>
          <Users />
          Register with Discord
        </RegisterButton>
      ) : (
        <WaitingIndicator>
          <div className="pulse"></div>
          <span>Please wait...</span>
        </WaitingIndicator>
      )}
    </WaitingStateContainer>
  );
};

export default WaitingState;
