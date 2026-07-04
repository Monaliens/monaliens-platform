import React, { memo, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import styled, { keyframes, css } from 'styled-components';
import { User, Zap } from 'lucide-react';
import { usePrivyOptimized, useBalanceFlash, useGameWallet } from '../../../context';
import GameWalletModal from '../../GameWallet/GameWalletModal';
import monadIcon from '../../../assets/images/monad.png';

const winFlash = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }
  20% { box-shadow: 0 0 20px 8px rgba(22, 163, 74, 0.6); }
  40% { box-shadow: 0 0 30px 12px rgba(22, 163, 74, 0.4); }
  100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }
`;

const loseFlash = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
  20% { box-shadow: 0 0 20px 8px rgba(220, 38, 38, 0.6); }
  40% { box-shadow: 0 0 30px 12px rgba(220, 38, 38, 0.4); }
  100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
`;

const profileIconCss = `
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--bg-glass);
  border-radius: 50%;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.2s ease;
  border: none;
  padding: 0;
  cursor: pointer;

  &:hover {
    background: var(--bg-glass-hover);
    color: var(--accent-primary);
  }

  svg {
    width: 20px;
    height: 20px;
  }

  @media (max-width: 768px) {
    display: none;
  }
`;

const ProfileIcon = styled(Link)`
  ${profileIconCss}
`;

const ProfileIconInactive = styled.span`
  ${profileIconCss}
  cursor: not-allowed;
  opacity: 0.5;

  &:hover {
    background: var(--bg-glass);
    color: var(--text-secondary);
  }
`;

const AppKitButton = styled.div`
  border-radius: 12px;

  @media (max-width: 1200px) {
    ${props =>
      props.$prominentConnect
        ? css`
            flex: 0 0 auto;
            width: auto;
            max-width: none;
            overflow: visible;

            appkit-button {
              display: block;
              width: auto !important;
              max-width: none !important;
              min-width: 0;
              box-sizing: border-box;
              --wui-font-size-medium: 13px;
              --wui-font-size-large: 13px;
              --wui-font-size-small: 12px;
            }
          `
        : css`
            flex: 0 1 auto;
            min-width: 0;
            max-width: min(340px, 100%);
            overflow: hidden;

            appkit-button {
              display: block;
              width: auto;
              max-width: 100%;
              min-width: 0;
              box-sizing: border-box;
              --wui-font-size-medium: 12px;
              --wui-font-size-large: 12px;
              --wui-font-size-small: 11px;
            }
          `}
  }

  ${props => props.$flashState === 'win' && css`
    animation: ${winFlash} 1.5s ease-out;
  `}

  ${props => props.$flashState === 'lose' && css`
    animation: ${loseFlash} 1.5s ease-out;
  `}

  appkit-button {
    --w3m-accent: #6930c3;

    /* Override ALL w3m color variables */
    --w3m-color-fg-1: #000000;
    --w3m-color-fg-2: #000000;
    --w3m-color-fg-3: #000000;
    --w3m-color-fg-075: #000000;
    --w3m-color-fg-100: #000000;
    --w3m-color-fg-125: #000000;
    --w3m-color-fg-150: #000000;
    --w3m-color-fg-175: #000000;
    --w3m-color-fg-200: #000000;
    --w3m-color-fg-225: #000000;
    --w3m-color-fg-250: #000000;
    --w3m-color-fg-275: #000000;
    --w3m-color-fg-300: #000000;

    /* Override ALL wui color variables */
    --wui-color-fg-1: #000000;
    --wui-color-fg-2: #000000;
    --wui-color-fg-3: #000000;
    --wui-color-fg-075: #000000;
    --wui-color-fg-100: #000000;
    --wui-color-fg-125: #000000;
    --wui-color-fg-150: #000000;
    --wui-color-fg-175: #000000;
    --wui-color-fg-200: #000000;
    --wui-color-fg-225: #000000;
    --wui-color-fg-250: #000000;
    --wui-color-fg-275: #000000;
    --wui-color-fg-300: #000000;

    /* Force all text elements to black */
    *,
    wui-text,
    w3m-text,
    w3m-balance-text,
    w3m-address-text,
    w3m-network-text {
      color: #000000 !important;
      font-weight: 600 !important;
    }
  }

  ${props =>
    props.$prominentConnect &&
    css`
      border-radius: 14px;

      appkit-button {
        --w3m-accent: #7c3aed !important;
        --apkt-accent: #7c3aed !important;
        border-radius: 14px !important;
        box-shadow: none !important;

        *,
        wui-text,
        w3m-text,
        w3m-balance-text,
        w3m-address-text,
        w3m-network-text {
          color: #ffffff !important;
          font-weight: 600 !important;
        }
      }

      &:hover appkit-button {
        filter: brightness(0.96);
      }
    `}
`;

// Game Wallet Display - aligned width with measured appkit-button (Jan 2026 header layout)
const GameWalletDisplay = styled.button`
  cursor: pointer;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  position: relative;
  outline: none;
  border: none;
  text-decoration: none;
  margin: 0;
  box-sizing: border-box;
  font-style: normal;
  text-rendering: optimizespeed;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  backface-visibility: hidden;

  background: var(--bg-secondary, #e5e5e5);
  gap: 2px;
  padding: 4px;
  color: var(--text-secondary, #6b7280);
  border-radius: 16px;
  height: 32px;
  transition: filter 0.15s ease, background-color 0.15s ease;
  font-family: var(--font-primary, 'Lexend', system-ui, sans-serif);
  border: 2px solid #7c3aed;
  white-space: nowrap;
  min-width: fit-content;
  max-width: 100%;

  &:hover {
    filter: brightness(0.97);
  }

  @media (max-width: 1200px) {
    flex: 0 1 auto;
    min-width: 0;
    width: auto;
    max-width: min(420px, 100%);
    gap: 6px;
  }

  @media (max-width: 480px) {
    height: 30px;
    padding: 2px 4px;
    border-radius: 12px;
    gap: 2px;
  }
`;

const GameIconBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  @media (max-width: 480px) {
    width: 20px;
    height: 20px;
  }
`;

const GameWalletAddress = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: inherit;
  margin-left: 2px;
  margin-right: 0;
  white-space: nowrap;
  text-align: left;
  line-height: 1.2;

  @media (max-width: 1200px) {
    font-size: 14px;
    font-weight: 600;
    min-width: 0;
    flex: 1 1 0;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 0;
    margin-left: 2px;
  }

  @media (max-width: 480px) {
    font-size: 14px;
  }
`;

const GameWalletBalance = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  border-radius: 16px;
  padding-left: 6px;
  padding-right: 6px;
  background: var(--bg-tertiary, #d4d4d4);
  color: var(--text-primary, #1f2937);
  font-size: 14px;
  font-weight: 600;
  transition: background-color 0.2s ease-out;
  white-space: nowrap;
  flex-shrink: 0;

  @media (max-width: 1200px) {
    font-size: 14px;
    padding-left: 6px;
    padding-right: 6px;
    border-radius: 12px;
  }

  @media (max-width: 480px) {
    font-size: 13px;
    padding-left: 5px;
    padding-right: 5px;
  }
`;

const zapPulse = keyframes`
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.06);
  }
`;

const GameModeToggle = styled.button`
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  outline: none;
  border: 2px solid #7c3aed;
  background: ${props => props.$active
    ? 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)'
    : 'transparent'};
  border-radius: 12px;
  width: 40px;
  height: 40px;
  transition: all 0.3s ease-out;
  color: ${props => props.$active ? 'white' : '#7c3aed'};
  box-shadow: none;

  ${props => props.$active && css`
    border-color: transparent;
  `}

  &:hover {
    background: ${props => props.$active
      ? 'linear-gradient(135deg, #6d28d9 0%, #9333ea 100%)'
      : 'rgba(124, 58, 237, 0.15)'};
    transform: scale(1.05);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  svg {
    width: 20px;
    height: 20px;
    ${props => props.$active && css`
      animation: ${zapPulse} 1.5s ease-in-out infinite;
    `}
  }

  @media (max-width: 1200px) {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: 10px;
  }

  @media (max-width: 480px) {
    width: 34px;
    height: 34px;

    svg {
      width: 18px;
      height: 18px;
    }
  }
`;

const WalletControlsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;

  @media (max-width: 1200px) {
    flex: 0 1 auto;
    min-width: 0;
    gap: 6px;
    justify-content: flex-end;
  }

  @media (max-width: 480px) {
    gap: 4px;
  }
`;

const WalletWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;

  @media (max-width: 768px) {
    gap: 4px;
  }

  @media (max-width: 1200px) {
    flex: 0 1 auto;
    min-width: 0;
    ${props =>
      props.$disconnectCompact &&
      css`
        justify-content: flex-end;
      `}
  }
`;

/**
 * WalletControls — layout restored from 0715daa (Jan 2026): game pill replaces connect slot width;
 * Zap toggle on the right of the slot. TEE availability + maintenance profile preserved.
 */
const WalletControls = memo(({ onProfileDisabledClick }) => {
  const { isConnected } = usePrivyOptimized();
  const { flashState } = useBalanceFlash();
  const {
    isGameMode,
    toggleGameMode,
    displayAddress: gameDisplayAddress,
    formattedBalance,
    isActivating,
    hasGameWallet,
    teeAvailable,
  } = useGameWallet();

  const appKitRef = useRef(null);
  const [appKitWidth, setAppKitWidth] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCompactHeader, setIsCompactHeader] = useState(() =>
    typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 1200px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1200px)');
    const onChange = () => setIsCompactHeader(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const measureWidth = () => {
      if (appKitRef.current) {
        const appKitButton = appKitRef.current.querySelector('appkit-button');
        if (appKitButton) {
          const width = appKitButton.offsetWidth;
          if (width > 0) {
            setAppKitWidth(width);
          }
        }
      }
    };

    const timer = setTimeout(measureWidth, 500);
    window.addEventListener('resize', measureWidth);

    if (hasGameWallet) {
      const remeasureTimer = setTimeout(measureWidth, 100);
      return () => {
        clearTimeout(timer);
        clearTimeout(remeasureTimer);
        window.removeEventListener('resize', measureWidth);
      };
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', measureWidth);
    };
  }, [isConnected, hasGameWallet]);

  const handleSwitchClick = async () => {
    if (isActivating) return;
    await toggleGameMode();
  };

  const canShowGameToggle =
    isConnected &&
    (teeAvailable === true || hasGameWallet || teeAvailable === null);
  const gameToggleDisabled =
    isActivating ||
    (teeAvailable === false && !hasGameWallet) ||
    teeAvailable === null;

  const gameWalletPillWidth =
    appKitWidth && !isCompactHeader ? { width: appKitWidth } : undefined;

  return (
    <WalletControlsRow>
      <WalletWrapper $disconnectCompact={isCompactHeader && !isConnected}>
        <AppKitButton
          className={isConnected ? 'header-appkit-slot--account' : undefined}
          $prominentConnect={!isConnected}
          $flashState={flashState}
          ref={appKitRef}
          style={isGameMode && hasGameWallet ? { position: 'absolute', visibility: 'hidden', pointerEvents: 'none' } : undefined}
        >
          <appkit-button />
        </AppKitButton>

        {isGameMode && hasGameWallet && (
          <GameWalletDisplay
            type="button"
            style={gameWalletPillWidth}
            onClick={() => setIsModalOpen(true)}
            title="Game wallet — fund / withdraw"
          >
            <GameIconBox>
              <img src={monadIcon} alt="" />
            </GameIconBox>
            <GameWalletAddress>{gameDisplayAddress}</GameWalletAddress>
            <GameWalletBalance>{formattedBalance} MON</GameWalletBalance>
          </GameWalletDisplay>
        )}

        {canShowGameToggle && (
          <GameModeToggle
            type="button"
            onClick={handleSwitchClick}
            $active={isGameMode}
            disabled={gameToggleDisabled}
            aria-pressed={isGameMode}
            aria-label={isGameMode ? 'Switch to main wallet' : 'Switch to game wallet'}
            title={
              teeAvailable === false && !hasGameWallet
                ? 'Game wallet (TEE) is not available'
                : teeAvailable === null
                  ? 'Checking game wallet service…'
                  : isGameMode
                    ? 'Switch to main wallet'
                    : 'Switch to game wallet'
            }
          >
            <Zap />
          </GameModeToggle>
        )}
      </WalletWrapper>

      {onProfileDisabledClick ? (
        <ProfileIconInactive
          role="button"
          tabIndex={0}
          onClick={onProfileDisabledClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onProfileDisabledClick();
            }
          }}
        >
          <User />
        </ProfileIconInactive>
      ) : (
        <ProfileIcon to="/profile">
          <User />
        </ProfileIcon>
      )}

      <GameWalletModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </WalletControlsRow>
  );
});

WalletControls.displayName = 'WalletControls';

export default WalletControls;
