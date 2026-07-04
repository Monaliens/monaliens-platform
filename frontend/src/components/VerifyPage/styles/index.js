import styled, { keyframes } from "styled-components";

// Animations
const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

// Page Container
export const PageContainer = styled.div`
  min-height: 100vh;
  padding: 40px 85px;
  max-width: 1600px;
  margin: 0 auto;

  @media (max-width: 768px) {
    padding: 25px;
  }
`;

// Header Components
export const Header = styled.div`
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 40px;
  padding: 100px 32px 24px 32px;
  background: ${props => props.$bannerUrl
    ? `linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%), url(${props.$bannerUrl})`
    : 'var(--bg-glass)'};
  background-size: cover;
  background-position: center;
  backdrop-filter: blur(4px);
  border: 2px solid var(--border-light);
  border-radius: 16px;
  box-shadow: 0 8px 24px var(--shadow-color);
  overflow: hidden;
  animation: ${fadeInUp} 0.6s ease-out forwards;
  opacity: 0;

  /* Add subtle overlay for better text readability */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: ${props => props.$bannerUrl
      ? 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 100%)'
      : 'none'};
    pointer-events: none;
  }

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 20px;
    padding: 80px 20px 20px 20px;
    align-items: flex-start;
  }
`;

export const ProfileSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  z-index: 1;
`;

export const ProfileImageWrapper = styled.div`
  position: relative;
`;

export const ProfileImage = styled.img`
  width: 90px;
  height: 90px;
  border-radius: 50%;
  border: 5px solid var(--bg-card);
  object-fit: cover;
  box-shadow: 0 4px 20px var(--shadow-color);
`;

export const ProfileInfo = styled.div``;

export const ProfileName = styled.h2`
  font-size: 26px;
  font-weight: 800;
  color: #ffffff;
  margin: 0;
  font-family: var(--font-primary);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8), 0 4px 16px rgba(0, 0, 0, 0.5);
  letter-spacing: -0.5px;
`;

export const ProfileUsername = styled.p`
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
  margin: 4px 0 8px 0;
  font-family: var(--font-primary);
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.7);
`;

export const ProfileStatus = styled.p`
  font-size: 13px;
  color: #ffffff;
  margin: 0;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--accent-green);
  padding: 5px 14px;
  border-radius: 14px;
  border: 2px solid var(--bg-glass);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
`;

// Card Components
export const WalletsCard = styled.div`
  background: var(--bg-glass);
  backdrop-filter: blur(8px);
  border: 2px solid var(--border-light);
  border-radius: 12px;
  box-shadow: 0 4px 15px var(--shadow-color);
  overflow: hidden;
  animation: ${fadeInUp} 0.6s ease-out 0.2s forwards;
  opacity: 0;
`;

export const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
  border-bottom: 2px solid var(--border-light);

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
`;

export const CardTitle = styled.div``;

export const Title = styled.h1`
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0 0 4px 0;
  font-family: var(--font-primary);
`;

export const Subtitle = styled.p`
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
  font-weight: 500;
`;

export const AddButton = styled.button`
  padding: 12px 24px;
  background: ${props => props.$disabled ? 'var(--bg-tertiary)' : 'var(--accent-primary)'};
  color: ${props => props.$disabled ? 'var(--text-tertiary)' : 'white'};
  border: ${props => props.$disabled ? '2px solid var(--border-light)' : 'none'};
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  font-family: var(--font-primary);
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.3s ease;
  box-shadow: ${props => props.$disabled ? 'none' : '0 4px 15px var(--shadow-color)'};

  &:hover:not(:disabled) {
    background: var(--accent-primary-hover);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px var(--shadow-color);
  }

  @media (max-width: 768px) {
    width: 100%;
  }
`;

// Container for wallet buttons (EVM + Solana)
export const WalletButtonsContainer = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;

  @media (max-width: 768px) {
    flex-direction: column;
    width: 100%;
  }
`;

// Wrapper for Solana wallet button with custom styling
export const SolanaButtonWrapper = styled.div`
  /* Override default Solana wallet adapter button styles */
  .wallet-adapter-button {
    background: var(--accent-primary) !important;
    border-radius: 8px !important;
    font-family: var(--font-primary) !important;
    font-weight: 700 !important;
    font-size: 14px !important;
    padding: 12px 24px !important;
    height: auto !important;
    transition: all 0.3s ease !important;
    box-shadow: 0 4px 15px var(--shadow-color) !important;

    &:hover {
      background: var(--accent-primary-hover) !important;
      transform: translateY(-2px) !important;
      box-shadow: 0 6px 20px var(--shadow-color) !important;
    }
  }

  .wallet-adapter-button-trigger {
    background: var(--accent-primary) !important;
  }

  .wallet-adapter-dropdown {
    font-family: var(--font-primary) !important;
  }

  .wallet-adapter-dropdown-list {
    background: var(--bg-card) !important;
    backdrop-filter: blur(8px) !important;
    border: 2px solid var(--border-light) !important;
    border-radius: 12px !important;
  }

  .wallet-adapter-dropdown-list-item {
    font-family: var(--font-primary) !important;
    color: var(--text-primary) !important;

    &:hover {
      background: var(--bg-tertiary) !important;
    }
  }

  @media (max-width: 768px) {
    width: 100%;

    .wallet-adapter-button {
      width: 100% !important;
      justify-content: center !important;
    }
  }
`;

export const CardBody = styled.div`
  padding: 16px 24px;
`;

// Loading Components
export const LoadingContainer = styled.div`
  text-align: center;
  padding: 80px 20px;
`;

export const Spinner = styled.div`
  display: inline-block;
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-light);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

export const LoadingText = styled.p`
  margin-top: 16px;
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 600;
`;

// Empty State
export const EmptyStateContainer = styled.div`
  text-align: center;
  padding: 80px 20px;
`;

export const EmptyIcon = styled.div`
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  background: var(--bg-tertiary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 32px;
    height: 32px;
    color: var(--text-tertiary);
  }
`;

export const EmptyTitle = styled.p`
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px 0;
  font-family: var(--font-primary);
`;

export const EmptySubtitle = styled.p`
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
`;

// Wallet List
export const WalletListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const WalletItemContainer = styled.div`
  background: var(--bg-glass);
  border: 2px solid var(--border-light);
  border-radius: 8px;
  transition: all 0.3s ease;
  overflow: hidden;
  animation: ${fadeInUp} 0.5s ease-out forwards;
  animation-delay: ${props => props.$index * 0.08}s;
  opacity: 0;

  &:hover {
    background: var(--bg-card);
    border-color: var(--border-color);
    box-shadow: 0 4px 12px var(--shadow-color);
  }
`;

export const WalletHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
`;

export const WalletInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
`;

// Wallet Type Badge (SOL/MON)
export const WalletTypeBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: ${props => props.$isSolana
    ? 'linear-gradient(135deg, rgba(153, 69, 255, 0.15) 0%, rgba(20, 241, 149, 0.15) 100%)'
    : 'var(--bg-tertiary)'};
  border: 2px solid ${props => props.$isSolana
    ? 'rgba(153, 69, 255, 0.3)'
    : 'var(--border-light)'};
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  color: ${props => props.$isSolana ? '#9945FF' : 'var(--accent-primary)'};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;

  svg {
    width: 14px;
    height: 14px;
  }
`;

export const WalletDetails = styled.div`
  flex: 1;
`;

export const WalletAddress = styled.div`
  font-size: 14px;
  font-weight: 600;
  font-family: 'Courier New', monospace;
  color: var(--text-primary);
  margin-bottom: 4px;
  text-decoration: none;
  transition: color 0.2s ease;
  word-break: break-all;

  &:hover {
    color: var(--accent-primary);
  }
`;

export const WalletStatus = styled.div`
  font-size: 12px;
  color: ${props => props.$hasNFTs ? '#16a34a' : '#dc2626'};
  font-weight: 600;

  &::before {
    content: '${props => props.$hasNFTs ? '✓' : '✗'} ';
  }
`;

export const WalletActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;

  @media (max-width: 768px) {
    width: 100%;
  }
`;

export const DeleteButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
  border: 2px solid rgba(220, 38, 38, 0.2);
  border-radius: 8px;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(220, 38, 38, 0.2);
    border-color: rgba(220, 38, 38, 0.4);
    transform: scale(1.05);
  }

  @media (max-width: 768px) {
    width: 48px;
    height: 48px;
  }
`;

export const ExpandButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--bg-tertiary);
  color: var(--accent-primary);
  border: 2px solid var(--border-light);
  border-radius: 8px;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: var(--bg-secondary);
    border-color: var(--border-color);
    transform: scale(1.05);
  }

  svg {
    transition: transform 0.3s ease;
    transform: rotate(${props => props.$isExpanded ? '180deg' : '0deg'});
  }

  @media (max-width: 768px) {
    width: 48px;
    height: 48px;
  }
`;

export const NFTGridContainer = styled.div`
  padding: 0 24px 20px 24px;
  border-top: 2px solid var(--border-light);
  background: var(--bg-secondary);
  overflow: hidden;
  max-height: ${props => props.$isExpanded ? '500px' : '0'};
  opacity: ${props => props.$isExpanded ? '1' : '0'};
  transition: max-height 0.4s ease-out, opacity 0.3s ease-out;
  padding: ${props => props.$isExpanded ? '0 24px 20px 24px' : '0 24px'};
`;

export const NFTGrid = styled.div`
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 20px 0;

  /* Custom scrollbar */
  &::-webkit-scrollbar {
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: var(--bg-tertiary);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--border-light);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: var(--border-color);
  }
`;

const nftSlideIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
`;

export const NFTCard = styled.div`
  flex: 0 0 150px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--bg-card);
  border: 2px solid var(--border-light);
  border-radius: 8px;
  padding: 12px;
  transition: all 0.3s ease;
  cursor: pointer;
  animation: ${nftSlideIn} 0.4s ease-out forwards;
  animation-delay: ${props => props.$index * 0.05}s;
  opacity: 0;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 6px 20px var(--shadow-color);
    border-color: var(--border-color);
  }
`;

export const NFTImage = styled.img`
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 6px;
  background: var(--bg-tertiary);
`;

export const NFTName = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-primary);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const NFTLoadingText = styled.div`
  padding: 40px 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
`;

export const NFTEmptyText = styled.div`
  padding: 40px 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
`;

// Waiting State
export const WaitingStateContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
`;

export const WaitingIcon = styled.div`
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  background: var(--bg-glass-gradient);
  border: 2px solid var(--border-light);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 40px;
    height: 40px;
    color: var(--accent-primary);
  }
`;

export const WaitingTitle = styled.h1`
  font-size: 32px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0 0 12px 0;
  font-family: var(--font-primary);
`;

export const WaitingSubtitle = styled.p`
  font-size: 18px;
  color: var(--text-secondary);
  margin: 0 0 32px 0;
  font-weight: 500;
`;

export const WaitingIndicator = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background: rgba(251, 191, 36, 0.1);
  border: 2px solid rgba(251, 191, 36, 0.2);
  border-radius: 8px;

  .pulse {
    width: 10px;
    height: 10px;
    background: #fbbf24;
    border-radius: 50%;
    animation: ${pulse} 2s ease-in-out infinite;
  }

  span {
    font-size: 14px;
    color: var(--text-primary);
    font-weight: 600;
  }
`;

// Primary Wallet Badge
export const PrimaryBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.2) 100%);
  border: 2px solid rgba(251, 191, 36, 0.4);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  color: #b45309;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  svg {
    color: #f59e0b;
  }
`;

// Set Primary Wallet Button
export const SetPrimaryButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--bg-tertiary);
  border: 2px solid var(--border-light);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.15) 100%);
    border-color: rgba(251, 191, 36, 0.3);
    color: #b45309;

    svg {
      color: #f59e0b;
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    transition: color 0.3s ease;
  }
`;
