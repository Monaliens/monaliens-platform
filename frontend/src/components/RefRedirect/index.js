import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { Users, ArrowRight } from 'lucide-react';

const DISCORD_CLIENT_ID = '1358795922519101561';
const REDIRECT_URI = process.env.REACT_APP_FRONTEND_URL ? `${process.env.REACT_APP_FRONTEND_URL}/profile` : 'https://your-domain/profile';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  text-align: center;
  padding: 20px;
`;

const Card = styled.div`
  background: var(--bg-glass);
  backdrop-filter: blur(8px);
  border: 2px solid var(--border-light);
  border-radius: 20px;
  padding: 48px;
  max-width: 480px;
  animation: ${fadeIn} 0.6s ease-out;
  box-shadow: 0 8px 32px var(--shadow-color);
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0 0 12px 0;
  font-family: var(--font-primary);
`;

const CodeBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--bg-glass);
  border: 2px solid var(--border-light);
  border-radius: 12px;
  font-family: 'Courier New', monospace;
  font-size: 18px;
  font-weight: 700;
  color: var(--accent-primary);
  letter-spacing: 1px;
  margin-bottom: 24px;
`;

const Description = styled.p`
  font-size: 16px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 32px 0;
  font-family: var(--font-primary);
`;

const StepList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 32px;
  text-align: left;
`;

const Step = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-glass);
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-primary);
`;

const StepNumber = styled.div`
  width: 28px;
  height: 28px;
  background: ${props => props.$active ? 'var(--accent-primary)' : 'var(--bg-glass)'};
  color: ${props => props.$active ? 'white' : 'var(--accent-primary)'};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
`;

const RedirectBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 24px;
  background: var(--bg-glass);
  border: 2px solid var(--border-light);
  border-radius: 12px;
  animation: ${pulse} 2s ease-in-out infinite;
`;

const Spinner = styled.div`
  width: 20px;
  height: 20px;
  border: 3px solid var(--border-light);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

const RedirectText = styled.span`
  font-size: 14px;
  font-weight: 700;
  color: var(--accent-primary);
  font-family: var(--font-primary);
`;

const Countdown = styled.span`
  font-size: 14px;
  font-weight: 700;
  color: var(--accent-primary);
  min-width: 20px;
`;

/**
 * RefRedirect Component
 * Handles /ref/:code route - saves referral code and redirects to Discord OAuth
 */
const RefRedirect = () => {
  const { code } = useParams();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (code) {
      // Save referral code to localStorage
      localStorage.setItem('pendingReferralCode', code);

      // Countdown timer
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            // Build Discord OAuth URL and redirect
            const discordUrl = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=identify`;
            window.location.href = discordUrl;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [code]);

  return (
    <Container>
      <Card>
        <Title>You've Been Invited!</Title>

        <CodeBadge>
          <Users size={18} />
          {code}
        </CodeBadge>

        <Description>
          Connect with Discord to verify your account and start using your referral benefits.
        </Description>

        <StepList>
          <Step>
            <StepNumber $active>1</StepNumber>
            Authorize with Discord
          </Step>
          <Step>
            <StepNumber>2</StepNumber>
            Your referral code will be applied automatically
          </Step>
          <Step>
            <StepNumber>3</StepNumber>
            Get your own referral link to share
          </Step>
        </StepList>

        <RedirectBox>
          <Spinner />
          <RedirectText>Redirecting to Discord</RedirectText>
          <ArrowRight size={18} style={{ color: 'var(--accent-primary)' }} />
          <Countdown>{countdown}s</Countdown>
        </RedirectBox>
      </Card>
    </Container>
  );
};

export default RefRedirect;
