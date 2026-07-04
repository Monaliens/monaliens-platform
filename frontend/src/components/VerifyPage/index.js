import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { Wallet, Users, LogOut } from 'lucide-react';
import { usePrivyOptimized } from '../../context';
import { useDiscordAuth } from './hooks/useDiscordAuth';
import { useWalletManagement } from './hooks/useWalletManagement';
import { useSolanaWallet } from './hooks/useSolanaWallet';
import { useReferral } from './hooks/useReferral';
import SolanaWalletProvider from './components/SolanaWalletProvider';
import ProfileHeader from './components/ProfileHeader';
import WalletList from './components/WalletList';
import EmptyState from './components/EmptyState';
import LoadingState from './components/LoadingState';
import WaitingState from './components/WaitingState';
import ReferralSection from './components/ReferralSection';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import {
  PageContainer,
  WalletsCard,
  CardHeader,
  CardTitle,
  Title,
  AddButton,
  CardBody,
  WalletButtonsContainer,
  SolanaButtonWrapper,
} from './styles';

// Tab styles
const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const NavigationCard = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-glass);
  backdrop-filter: blur(8px);
  border: 2px solid var(--border-light);
  border-radius: 12px;
  padding: 8px;
  margin-bottom: 24px;
  animation: ${fadeInUp} 0.6s ease-out 0.15s forwards;
  opacity: 0;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 12px;
  }
`;

const TabsContainer = styled.div`
  display: flex;
  gap: 8px;

  @media (max-width: 768px) {
    width: 100%;
  }
`;

const Tab = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: ${props => props.$active
    ? 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary-hover) 100%)'
    : 'transparent'};
  color: ${props => props.$active ? 'white' : 'var(--text-secondary)'};
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  font-family: var(--font-primary);
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: ${props => props.$active
      ? 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary-hover) 100%)'
      : 'var(--bg-tertiary)'};
    color: ${props => props.$active ? 'white' : 'var(--accent-primary)'};
  }

  svg {
    width: 18px;
    height: 18px;
  }

  @media (max-width: 768px) {
    flex: 1;
    justify-content: center;
  }
`;

const LogoutButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: transparent;
  color: #dc2626;
  border: 2px solid rgba(220, 38, 38, 0.2);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-primary);
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(220, 38, 38, 0.1);
    border-color: rgba(220, 38, 38, 0.4);
  }

  svg {
    width: 16px;
    height: 16px;
  }

  @media (max-width: 768px) {
    width: 100%;
    justify-content: center;
  }
`;

const ContentContainer = styled.div`
  animation: ${fadeInUp} 0.6s ease-out 0.2s forwards;
  opacity: 0;
`;

/**
 * ProfilePageContent Component
 * Single page with Wallets and Referral tabs
 */
const ProfilePageContent = () => {
  // Check for pending referral code to determine initial tab
  const [activeTab, setActiveTab] = useState(() => {
    const pendingCode = localStorage.getItem('pendingReferralCode');
    return pendingCode ? 'referral' : 'wallets';
  });

  // Discord authentication hook
  const {
    discordUser,
    discordToken,
    displayName,
    username,
    displayImage,
    bannerImage,
    isAuthenticated,
    logout,
  } = useDiscordAuth();

  // Use global wallet state from Reown (Header wallet connection) - EVM
  const {
    walletAddress,
    authenticated: isWalletConnected,
    signMessage: signEvmMessage,
    isSigningMessage: isSigningEvmMessage,
  } = usePrivyOptimized();

  // Use Solana wallet state
  const {
    solanaAddress,
    isConnected: isSolanaConnected,
    isConnecting: isSolanaConnecting,
    signMessage: signSolanaMessage,
    isSigningMessage: isSigningSolanaMessage,
    selectedWallet: solanaWallet,
    connectWallet: connectSolanaWallet,
  } = useSolanaWallet();

  // Solana wallet modal
  const { setVisible: setSolanaModalVisible } = useWalletModal();

  // Wallet management hook
  const {
    userWallets,
    userRoles,
    isLoading: isLoadingWallets,
    addWallet,
    addSolanaWallet,
    removeWallet,
    isWalletAdded,
    isSolanaWalletAdded,
    primaryWallet,
    setAsPrimaryWallet,
    isPrimaryWallet,
    isSettingPrimary,
  } = useWalletManagement(discordUser, discordToken, walletAddress, solanaAddress);

  // Referral system hook
  const {
    referralCode,
    isCustomCode,
    isLoadingCode,
    hasUsedReferral,
    usedCode,
    stats,
    isLoadingStats,
    createCustomCode,
    applyCode,
    isCreatingCustom,
    isApplyingCode,
    error: referralError,
    clearError: clearReferralError,
  } = useReferral(discordUser, discordToken);

  // Show waiting state if not authenticated
  if (!isAuthenticated) {
    return (
      <PageContainer>
        <WaitingState />
      </PageContainer>
    );
  }

  // Check if current EVM wallet is already added
  const evmWalletAlreadyAdded = isWalletConnected && walletAddress && isWalletAdded(walletAddress);

  // Check if current Solana wallet is already added
  const solanaWalletAlreadyAdded = isSolanaConnected && solanaAddress && isSolanaWalletAdded(solanaAddress);

  const handleLogout = () => {
    logout();
  };

  return (
    <PageContainer>
      {/* Profile Header */}
      <ProfileHeader
        displayName={displayName}
        username={username}
        displayImage={displayImage}
        bannerImage={bannerImage}
        roles={userRoles}
        discordId={discordUser?.id}
      />

      {/* Navigation Tabs */}
      <NavigationCard>
        <TabsContainer>
          <Tab
            $active={activeTab === 'wallets'}
            onClick={() => setActiveTab('wallets')}
          >
            <Wallet />
            Wallets
          </Tab>
          <Tab
            $active={activeTab === 'referral'}
            onClick={() => setActiveTab('referral')}
          >
            <Users />
            Referral
          </Tab>
        </TabsContainer>
        <LogoutButton onClick={handleLogout}>
          <LogOut />
          Logout
        </LogoutButton>
      </NavigationCard>

      {/* Tab Content */}
      <ContentContainer>
        {activeTab === 'wallets' && (
          <WalletsCard>
            <CardHeader>
              <CardTitle>
                <Title>Wallets</Title>
              </CardTitle>
              <WalletButtonsContainer>
                {/* EVM Wallet Add Button */}
                {isWalletConnected && walletAddress && (
                  <AddButton
                    onClick={() => addWallet(walletAddress, signEvmMessage)}
                    disabled={evmWalletAlreadyAdded || isSigningEvmMessage}
                    $disabled={evmWalletAlreadyAdded || isSigningEvmMessage}
                  >
                    {isSigningEvmMessage ? 'Signing...' : evmWalletAlreadyAdded ? 'EVM Added' : '+ Add EVM'}
                  </AddButton>
                )}

                {/* Solana Wallet Section */}
                <SolanaButtonWrapper>
                  <AddButton
                    onClick={() => {
                      if (isSolanaConnected && solanaAddress) {
                        addSolanaWallet(solanaAddress, signSolanaMessage);
                      } else if (solanaWallet && !isSolanaConnected && !isSolanaConnecting) {
                        connectSolanaWallet();
                      } else {
                        setSolanaModalVisible(true);
                      }
                    }}
                    disabled={solanaWalletAlreadyAdded || isSigningSolanaMessage || isSolanaConnecting}
                    $disabled={solanaWalletAlreadyAdded || isSigningSolanaMessage || isSolanaConnecting}
                    $isSolana
                  >
                    {isSolanaConnecting ? 'Connecting...' : isSigningSolanaMessage ? 'Signing...' : solanaWalletAlreadyAdded ? 'Solana Added' : '+ Add Solana'}
                  </AddButton>
                </SolanaButtonWrapper>
              </WalletButtonsContainer>
            </CardHeader>

            <CardBody>
              {isLoadingWallets && <LoadingState />}
              {!isLoadingWallets && userWallets.length === 0 && <EmptyState />}
              {!isLoadingWallets && userWallets.length > 0 && (
                <WalletList
                  wallets={userWallets}
                  onRemove={removeWallet}
                  primaryWallet={primaryWallet}
                  onSetPrimary={setAsPrimaryWallet}
                  isPrimaryWallet={isPrimaryWallet}
                  isSettingPrimary={isSettingPrimary}
                />
              )}
            </CardBody>
          </WalletsCard>
        )}

        {activeTab === 'referral' && (
          <ReferralSection
            referralCode={referralCode}
            isCustomCode={isCustomCode}
            isLoadingCode={isLoadingCode}
            hasUsedReferral={hasUsedReferral}
            usedCode={usedCode}
            stats={stats}
            isLoadingStats={isLoadingStats}
            createCustomCode={createCustomCode}
            applyCode={applyCode}
            isCreatingCustom={isCreatingCustom}
            isApplyingCode={isApplyingCode}
            error={referralError}
            clearError={clearReferralError}
            primaryWallet={primaryWallet}
          />
        )}
      </ContentContainer>
    </PageContainer>
  );
};

/**
 * ProfilePage Component (formerly VerifyPage)
 * Main profile page wrapped with Solana wallet provider
 *
 * Features:
 * - Discord OAuth authentication (persisted to localStorage)
 * - Multi-wallet connection and management (EVM + Solana)
 * - NFT ownership verification
 * - Discord role assignment
 * - Navigation to Referral page
 */
const ProfilePage = () => {
  return (
    <SolanaWalletProvider>
      <ProfilePageContent />
    </SolanaWalletProvider>
  );
};

// Export as both ProfilePage and VerifyPage for backwards compatibility
export default ProfilePage;
export { ProfilePage };
