import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { motion } from 'framer-motion';
import { createPublicClient, http, publicActions } from 'viem';
import { mainnet } from 'viem/chains';

// --- Styled Components ---

const Container = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== 'ref'
})`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  z-index: -1;
  background-image: url('/assets/images/checkerbg.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
  background-color: var(--bg-secondary);

  @media (max-width: 768px) {
    background-attachment: scroll;
  }
`;

const Wrapper = styled(motion.div)`
  width: 100%;
  max-width: 650px;
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: calc(100vh - 160px);
  background: transparent;
  border-radius: 24px;
  padding: 32px;
  padding-top: 140px;
  padding-bottom: 40px;
  margin: 0 auto;

  @media (max-width: 768px) {
    padding: 24px;
    padding-top: 120px;
    border-radius: 20px;
  }
`;

const Header = styled(motion.div)`
  text-align: center;
  margin-bottom: 50px;
`;

const Title = styled.h1`
  font-family: var(--font-primary);
  font-size: 56px;
  font-weight: 800;
  color: var(--text-light);
  margin: 0;
  letter-spacing: -1px;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));

  @media (max-width: 768px) {
    font-size: 40px;
  }
`;

const Subtitle = styled.p`
  font-family: var(--font-primary);
  font-size: 16px;
  color: var(--text-light);
  margin: 12px 0 0 0;
  font-weight: 500;
`;

const InputContainer = styled(motion.div)`
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-card);
  border: 2px solid var(--border-light);
  border-radius: 60px;
  padding: 8px 8px 8px 32px;
  box-shadow: 0 8px 32px var(--shadow-color);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  width: 100%;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px var(--shadow-color);
  }

  &:focus-within {
    background: var(--bg-card);
    border-color: var(--accent-primary);
    box-shadow: 0 16px 48px var(--shadow-color);
  }
`;

const Input = styled.input`
  flex: 1;
  border: none;
  background: transparent;
  font-family: var(--font-primary);
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  outline: none;
  padding: 8px 0;

  &::placeholder {
    color: var(--text-muted);
    font-weight: 400;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SubmitButton = styled(motion.button)`
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, var(--accent-primary), #5a23b8);
  color: var(--text-light);
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 8px 24px var(--shadow-color);
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(rgba(255,255,255,0.2), transparent);
    opacity: 0;
    transition: opacity 0.2s;
  }

  &:hover::after {
    opacity: 1;
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const ErrorText = styled.div`
  margin-top: 16px;
  text-align: center;
  color: var(--text-light);
  font-weight: 600;
  background: rgba(239, 68, 68, 0.2);
  padding: 10px;
  border-radius: 12px;
  width: 100%;
  min-height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ResultCard = styled.div`
  margin-top: 40px;
  width: 100%;
  background: var(--bg-card);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 2px solid var(--border-light);
  border-radius: 24px;
  padding: 32px;
  box-shadow: 0 8px 32px var(--shadow-color);
  display: flex;
  flex-direction: column;
  gap: 8px;

  @media (max-width: 768px) {
    padding: 24px;
    gap: 6px;
  }
`;


const TierRow = styled.div`
  display: grid;
  grid-template-columns: 100px 1fr auto;
  align-items: center;
  gap: 20px;
  padding: 8px 0;
  font-family: var(--font-primary);
  transition: all 0.3s ease;
  color: var(--text-primary);
  font-weight: ${props => props.active ? 700 : 500};
  font-size: 18px;
  
  ${props => props.shouldAnimate ? `
    animation: fadeIn${props.active ? 'Active' : 'Inactive'} 0.4s ease-out forwards;
    animation-delay: ${props.delay || '0s'};
    opacity: 0;
  ` : `
    opacity: ${props.active ? 1 : 0.4};
  `}

  @keyframes fadeInActive {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes fadeInInactive {
    from {
      opacity: 0;
    }
    to {
      opacity: 0.4;
    }
  }

  @media (max-width: 768px) {
    font-size: 16px;
    padding: 6px 0;
    gap: 16px;
    grid-template-columns: 80px 1fr auto;
  }
`;

const AnimatedCardDivider = styled.div`
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--border-light), transparent);
  margin: 4px 0;
  transform-origin: left;
  
  ${props => props.shouldAnimate ? `
    animation: scaleIn 0.3s ease-out forwards;
    animation-delay: ${props.delay || '0s'};
    opacity: 0;
  ` : `
    opacity: 1;
    transform: scaleX(1);
  `}

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scaleX(0);
    }
    to {
      opacity: 1;
      transform: scaleX(1);
    }
  }
`;

const TierLabel = styled.span`
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: ${props => props.active ? 'var(--accent-primary)' : 'var(--text-secondary)'};
  font-weight: ${props => props.active ? 800 : 500};
`;

const TierMint = styled.span`
  text-align: left;
  color: var(--text-primary);
`;

const TierPrice = styled.span`
  text-align: right;
  color: var(--text-primary);
`;

const CardFooter = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 20px;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
  font-family: var(--font-primary);
  font-size: 14px;
  color: var(--text-secondary);

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 12px;
    text-align: center;
  }
`;

const FooterRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;

  &:last-child {
    justify-content: flex-end;
  }

  @media (max-width: 768px) {
    justify-content: center;
  }
`;

const FooterLabel = styled.span`
  color: var(--text-muted);
  font-weight: 600;
`;

const FooterValue = styled.span`
  color: var(--accent-primary);
  font-weight: 700;
`;

const FooterLink = styled.a`
  color: var(--accent-primary);
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    color: #8e44ad;
    text-decoration: underline;
  }
`;

const MintNowText = styled.a`
  display: inline-block;
  font-family: var(--font-primary);
  font-size: 18px;
  font-weight: 800;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  letter-spacing: 1.5px;
  background: linear-gradient(90deg, #ff5dd6 0%, #9c04b4 50%, #ff5dd6 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gradientShift 3s ease infinite;
  transition: all 0.3s ease;

  @keyframes gradientShift {
    0% {
      background-position: 0% center;
    }
    50% {
      background-position: 100% center;
    }
    100% {
      background-position: 0% center;
    }
  }

  &:hover {
    transform: scale(1.05);
    letter-spacing: 2px;
  }

  @media (max-width: 768px) {
    font-size: 16px;
  }
`;

// --- Main Component ---

const CheckerPage = () => {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const hasAnimated = useRef(false);
  const containerRef = useRef(null);

  useEffect(() => {
    // Background image preload check
    const img = new Image();
    img.src = '/assets/images/checkerbg.png';
  }, []);

  const handleCheck = async () => {
    if (!address?.trim() || loading) return;

    setError('');
    setLoading(true);
    setResult(null);

    try {
      let resolvedAddress = address.trim();

      // Check if input is an ENS name (ends with .eth)
      if (address.trim().endsWith('.eth') || address.trim().includes('.')) {
        try {
          // Create public client for Ethereum mainnet (ENS is on mainnet)
          const publicClient = createPublicClient({
            chain: mainnet,
            transport: http('https://eth.llamarpc.com') // Public RPC endpoint
          }).extend(publicActions);

          // Resolve ENS name to address
          const ensAddress = await publicClient.getEnsAddress({
            name: address.trim().toLowerCase()
          });

          if (!ensAddress) {
            setError('ENS name not found or invalid');
            setLoading(false);
            return;
          }

          resolvedAddress = ensAddress;
        } catch (ensError) {
          setError('Failed to resolve ENS name. Please try again or use a wallet address.');
          setLoading(false);
          return;
        }
      } else {
        // Validate Ethereum address format
        if (!address.startsWith('0x') || address.length !== 42) {
          setError('Invalid address format');
          setLoading(false);
          return;
        }
      }

      // Check whitelist with resolved address
      const { data } = await axios.get(
        `${process.env.API_URL || "https://your-api-url"}/api/whitelist/check/${resolvedAddress}`
      );
      hasAnimated.current = false;
      
      // If success is false or data doesn't have the expected structure, set all values to false
      if (!data.success || !data) {
        setResult({
          success: false,
          address: resolvedAddress,
          free: false,
          freeCount: 0,
          gtd: false,
          gtdCount: 0,
          fcfs: false,
          fcfsCount: 0,
          public: false,
          publicCount: 0
        });
      } else {
        // If success is true, use the actual values
        // Store both boolean (for active state) and count (for display)
        const freeCount = typeof data.free === 'number' ? data.free : (data.free ? 2 : 0);
        const gtdCount = typeof data.gtd === 'number' ? data.gtd : (data.gtd ? 2 : 0);
        const fcfsCount = typeof data.fcfs === 'number' ? data.fcfs : (data.fcfs ? 2 : 0);
        const publicCount = typeof data.public === 'number' ? data.public : (data.public ? 2 : 0);
        
        setResult({
          success: true,
          address: data.address || resolvedAddress,
          free: freeCount > 0,
          freeCount: freeCount,
          gtd: gtdCount > 0,
          gtdCount: gtdCount,
          fcfs: fcfsCount > 0,
          fcfsCount: fcfsCount,
          public: publicCount > 0,
          publicCount: publicCount
        });
      }
      
      // Reset animation flag after animations complete
      setTimeout(() => {
        hasAnimated.current = true;
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to check. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Container ref={containerRef} />
      <div style={{ position: 'relative', zIndex: 2, minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px' }}>
        <Wrapper
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
        <Header>
          <Title>Monaliens Checker</Title>
          <Subtitle>Let’s see if you’re privileged to mint a Monalien…</Subtitle>
        </Header>

        <InputContainer>
          <Input
            type="text"
            placeholder="Enter wallet address (0x...) or ENS name (e.g., vitalik.eth)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
            disabled={loading}
          />
          <SubmitButton
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCheck}
            disabled={loading}
          >
            →
          </SubmitButton>
        </InputContainer>

        {error && (
          <ErrorText>
            {error}
          </ErrorText>
        )}

        {result && (
          <ResultCard key={result.address}>
              <TierRow 
                active={result.free}
                shouldAnimate={!hasAnimated.current}
                delay="0.1s"
              >
                <TierLabel active={result.free}>Free</TierLabel>
                <TierMint active={result.free}>
                  {result.success ? `${result.freeCount || 0} per wallet` : (result.free ? '2 per wallet' : '0 per wallet')}
                </TierMint>
                <TierPrice active={result.free}>Price: 0$</TierPrice>
              </TierRow>

              <AnimatedCardDivider
                shouldAnimate={!hasAnimated.current}
                delay="0.3s"
              />

              <TierRow 
                active={result.gtd}
                shouldAnimate={!hasAnimated.current}
                delay="0.4s"
              >
                <TierLabel active={result.gtd}>GTD</TierLabel>
                <TierMint active={result.gtd}>
                  {result.success ? `${result.gtdCount || 0} per wallet` : (result.gtd ? '2 per wallet' : '0 per wallet')}
                </TierMint>
                <TierPrice active={result.gtd}>Price: 33$</TierPrice>
              </TierRow>

              <AnimatedCardDivider
                shouldAnimate={!hasAnimated.current}
                delay="0.6s"
              />

              <TierRow 
                active={result.fcfs}
                shouldAnimate={!hasAnimated.current}
                delay="0.7s"
              >
                <TierLabel active={result.fcfs}>FCFS</TierLabel>
                <TierMint active={result.fcfs}>
                  {result.success ? `${result.fcfsCount || 0} per wallet` : (result.fcfs ? '2 per wallet' : '0 per wallet')}
                </TierMint>
                <TierPrice active={result.fcfs}>Price: 33$</TierPrice>
              </TierRow>

              <AnimatedCardDivider
                shouldAnimate={!hasAnimated.current}
                delay="0.9s"
              />

              <TierRow
                active={result.public}
                shouldAnimate={!hasAnimated.current}
                delay="1.0s"
              >
                <TierLabel active={result.public}>Public</TierLabel>
                <TierMint active={result.public}>
                  {result.success ? `${result.publicCount || 0} per wallet` : (result.public ? '3 per wallet' : '0 per wallet')}
                </TierMint>
                <TierPrice active={result.public}>Price: 33$</TierPrice>
              </TierRow>

              <CardFooter>
                <FooterRow>
                  <FooterLabel>Date:</FooterLabel>
                  <FooterValue>NOW</FooterValue>
                </FooterRow>

                <MintNowText
                  href="https://www.scatter.art/collection/monaliens"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  MINT NOW
                </MintNowText>

                <FooterRow>
                  <FooterLabel>On:</FooterLabel>
                  <FooterLink
                    href="https://www.scatter.art/collection/monaliens"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Scatter
                  </FooterLink>
                </FooterRow>
              </CardFooter>
          </ResultCard>
        )}
        </Wrapper>
      </div>
    </>
  );
};

export default CheckerPage;
