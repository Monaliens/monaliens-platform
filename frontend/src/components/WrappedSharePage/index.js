import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

const Container = styled.div`
  min-height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
`;

const CardWrapper = styled.div`
  animation: ${fadeIn} 0.6s ease-out;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 25px 80px rgba(167, 139, 250, 0.3);
  max-width: 100%;
`;

const CardImage = styled.img`
  display: block;
  max-width: 100%;
  height: auto;
  max-height: 70vh;
  object-fit: contain;
`;

const GetYoursButton = styled.button`
  margin-top: 32px;
  padding: 16px 48px;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-light);
  background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 50%, #7c3aed 100%);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Lexend', system-ui, sans-serif;
  animation: ${fadeIn} 0.6s ease-out 0.2s both;

  &:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 12px 40px rgba(167, 139, 250, 0.4);
  }

  &:active {
    transform: translateY(0) scale(0.98);
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`;

const LoadingSpinner = styled.div`
  width: 48px;
  height: 48px;
  border: 4px solid rgba(167, 139, 250, 0.2);
  border-top: 4px solid #a78bfa;
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const LoadingText = styled.p`
  color: rgba(255, 255, 255, 0.7);
  font-size: 16px;
  font-family: 'Lexend', system-ui, sans-serif;
  animation: ${pulse} 1.5s ease-in-out infinite;
`;

const ErrorContainer = styled.div`
  text-align: center;
  animation: ${fadeIn} 0.6s ease-out;
`;

const ErrorTitle = styled.h2`
  color: var(--text-primary);
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 12px;
  font-family: 'Lexend', system-ui, sans-serif;
`;

const ErrorMessage = styled.p`
  color: var(--text-secondary);
  font-size: 16px;
  margin-bottom: 24px;
  font-family: 'Lexend', system-ui, sans-serif;
`;

const WrappedSharePage = () => {
  const { address } = useParams();
  const navigate = useNavigate();
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (address) {
      // Image URL'ini direkt kullan
      const url = `${process.env.API_URL || "https://your-api-url"}/api/wrapped/share/${address}/image`;

      // Test image loading
      const img = new Image();
      img.onload = () => {
        setImageUrl(url);
        setLoading(false);
      };
      img.onerror = () => {
        setError('Card not found');
        setLoading(false);
      };
      img.src = url;
    }
  }, [address]);

  const handleGetYours = () => {
    navigate('/wrapped');
  };

  if (loading) {
    return (
      <Container>
        <LoadingContainer>
          <LoadingSpinner />
          <LoadingText>Loading wrapped card...</LoadingText>
        </LoadingContainer>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <ErrorContainer>
          <ErrorTitle>Card Not Found</ErrorTitle>
          <ErrorMessage>This wrapped card doesn't exist or has expired.</ErrorMessage>
          <GetYoursButton onClick={handleGetYours}>
            Get Your Wrapped
          </GetYoursButton>
        </ErrorContainer>
      </Container>
    );
  }

  return (
    <Container>
      <CardWrapper>
        <CardImage src={imageUrl} alt="Monaliens Wrapped 2025" />
      </CardWrapper>
      <GetYoursButton onClick={handleGetYours}>
        Get Yours
      </GetYoursButton>
    </Container>
  );
};

export default WrappedSharePage;
