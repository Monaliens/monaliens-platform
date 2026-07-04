import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import useWrappedData from './hooks/useWrappedData';
import {
  FullScreenContainer,
  NavigationFooter,
  NavButton,
  ProgressDots,
  ProgressDot,
  InputScreenContainer,
  InputCard,
  InputTitle,
  InputSubtitle,
  InputDescription,
  AddressInput,
  SubmitButton,
  LoadingScreen,
  LoadingSpinner,
  LoadingText,
  ErrorScreen,
  ErrorTitle,
  ErrorMessage,
  RetryButton,
} from './styles';
import { slideComponents } from './components/Slides';
import { getAvailableSlides } from './utils';

const WrappedPage = () => {
  const { address: urlAddress } = useParams();
  const navigate = useNavigate();
  const [inputAddress, setInputAddress] = useState('');
  const [walletAddress, setWalletAddress] = useState(urlAddress || '');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideDirection, setSlideDirection] = useState('next');
  const touchStartX = useRef(null);

  const { data, loading, error } = useWrappedData(walletAddress);
  const availableSlides = getAvailableSlides(data);

  useEffect(() => {
    if (urlAddress) {
      setWalletAddress(urlAddress);
    }
  }, [urlAddress]);

  // Reset slide when data changes
  useEffect(() => {
    setCurrentSlide(0);
  }, [data]);

  const handleSubmit = useCallback((e) => {
    e?.preventDefault();
    const address = inputAddress.trim();
    if (address && (address.startsWith('0x') || address.endsWith('.eth'))) {
      setWalletAddress(address);
      navigate(`/wrapped/${address}`, { replace: true });
    }
  }, [inputAddress, navigate]);

  const goToSlide = useCallback((index) => {
    if (index >= 0 && index < availableSlides.length && index !== currentSlide) {
      setSlideDirection(index > currentSlide ? 'next' : 'prev');
      setCurrentSlide(index);
    }
  }, [availableSlides.length, currentSlide]);

  const nextSlide = useCallback(() => {
    if (currentSlide < availableSlides.length - 1) {
      setSlideDirection('next');
      setCurrentSlide(prev => prev + 1);
    }
  }, [currentSlide, availableSlides.length]);

  const prevSlide = useCallback(() => {
    if (currentSlide > 0) {
      setSlideDirection('prev');
      setCurrentSlide(prev => prev - 1);
    }
  }, [currentSlide]);

  const handleClose = useCallback(() => {
    setWalletAddress('');
    setInputAddress('');
    setCurrentSlide(0);
    navigate('/wrapped');
  }, [navigate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide, handleClose]);

  // Touch/Swipe navigation
  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartX.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }

    touchStartX.current = null;
  }, [nextSlide, prevSlide]);

  // Address input screen
  if (!walletAddress) {
    return (
      <InputScreenContainer>
        <InputCard>
          <InputTitle>Monaliens</InputTitle>
          <InputSubtitle>Wrapped 2025</InputSubtitle>
          <InputDescription>
            Enter your wallet address to see your year in review
          </InputDescription>
          <form onSubmit={handleSubmit}>
            <AddressInput
              type="text"
              placeholder="0x... or ENS name"
              value={inputAddress}
              onChange={(e) => setInputAddress(e.target.value)}
              autoFocus
            />
            <SubmitButton type="submit" disabled={!inputAddress.trim()}>
              View My Wrapped
            </SubmitButton>
          </form>
        </InputCard>
      </InputScreenContainer>
    );
  }

  // Loading state
  if (loading) {
    return (
      <LoadingScreen>
        <LoadingSpinner />
        <LoadingText>Loading your wrapped...</LoadingText>
      </LoadingScreen>
    );
  }

  // Error state
  if (error) {
    return (
      <ErrorScreen>
        <ErrorTitle>No Data Found</ErrorTitle>
        <ErrorMessage>{error}</ErrorMessage>
        <RetryButton onClick={handleClose}>
          Try Another Address
        </RetryButton>
      </ErrorScreen>
    );
  }

  // Main wrapped experience
  return (
    <FullScreenContainer
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Render all slides, but only active one is visible */}
      {availableSlides.map((slideKey, index) => {
        const SlideComponent = slideComponents[slideKey];
        if (!SlideComponent) return null;

        return (
          <SlideComponent
            key={slideKey}
            data={data}
            active={index === currentSlide}
            direction={slideDirection}
          />
        );
      })}

      {/* Navigation Footer */}
      {availableSlides.length > 1 && (
        <NavigationFooter>
          <NavButton onClick={prevSlide} disabled={currentSlide === 0}>
            <ChevronLeft size={20} />
          </NavButton>

          <ProgressDots>
            {availableSlides.map((_, index) => (
              <ProgressDot
                key={index}
                $active={index === currentSlide}
                onClick={() => goToSlide(index)}
              />
            ))}
          </ProgressDots>

          <NavButton onClick={nextSlide} disabled={currentSlide === availableSlides.length - 1}>
            <ChevronRight size={20} />
          </NavButton>
        </NavigationFooter>
      )}
    </FullScreenContainer>
  );
};

export default WrappedPage;
