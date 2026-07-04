import React from 'react';
import styled from 'styled-components';
import { Trophy } from 'lucide-react';
import RoleBadges from './RoleBadge';
import { useTournamentBoost } from '../hooks/useTournamentBoost';
import {
  Header,
  ProfileSection,
  ProfileImageWrapper,
  ProfileImage,
  ProfileInfo,
  ProfileName,
  ProfileUsername,
} from '../styles';

// Tournament Stats Styles
const TournamentSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;

  @media (max-width: 768px) {
    display: none;
  }
`;

const TournamentCard = styled.div`
  background: var(--modal-bg);
  backdrop-filter: blur(8px);
  border: 2px solid rgba(105, 48, 195, 0.2);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 180px;
`;

const TournamentTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  color: #6930c3;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  svg {
    width: 14px;
    height: 14px;
  }
`;

const StatsRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
`;

const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const StatLabel = styled.span`
  font-size: 10px;
  color: var(--text-secondary);
  text-transform: uppercase;
`;

const StatValue = styled.span`
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
`;

const BoostRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(105, 48, 195, 0.1);
`;

const CollectionLogo = styled.img`
  width: 24px;
  height: 24px;
  border-radius: 6px;
  object-fit: cover;
`;

const BoostInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const BoostLabel = styled.span`
  font-size: 10px;
  color: var(--text-secondary);
`;

const BoostValue = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
`;

const MultiplierBadge = styled.span`
  font-size: 11px;
  font-weight: 700;
  color: var(--text-light);
  background: linear-gradient(135deg, #6930c3 0%, #8b5cf6 100%);
  padding: 2px 6px;
  border-radius: 4px;
`;

/**
 * ProfileHeader Component
 * Displays Discord profile information with banner and roles
 *
 * @param {Object} props - Component props
 * @param {string} props.displayName - Discord global name (large)
 * @param {string} props.username - Discord username (small, @username)
 * @param {string} props.displayImage - Discord avatar URL
 * @param {string} props.bannerImage - Discord banner URL (optional)
 * @param {Array} props.roles - Array of Discord roles from backend
 * @param {string} props.discordId - Discord user ID for tournament data
 */
const ProfileHeader = ({
  displayName,
  username,
  displayImage,
  bannerImage,
  roles,
  discordId,
}) => {
  const {
    pnlRank,
    volumeRank,
    activeMultiplier,
    activeCollection,
    activeCollectionImage,
    loading,
  } = useTournamentBoost(discordId);

  const hasBoost = activeMultiplier && activeCollection;
  const hasRanks = pnlRank !== null || volumeRank !== null;

  return (
    <Header $bannerUrl={bannerImage}>
      <ProfileSection>
        <ProfileImageWrapper>
          <ProfileImage src={displayImage} alt="Profile" />
        </ProfileImageWrapper>
        <ProfileInfo>
          <ProfileName>{displayName}</ProfileName>
          {username && <ProfileUsername>@{username}</ProfileUsername>}
          <RoleBadges roles={roles} />
        </ProfileInfo>
      </ProfileSection>

      {/* Tournament Stats - Right Side */}
      {!loading && (hasBoost || hasRanks) && (
        <TournamentSection>
          <TournamentCard>
            <TournamentTitle>
              <Trophy />
              Tournament
            </TournamentTitle>

            {hasRanks && (
              <StatsRow>
                <StatItem>
                  <StatLabel>PnL</StatLabel>
                  <StatValue>#{pnlRank || '-'}</StatValue>
                </StatItem>
                <StatItem>
                  <StatLabel>Volume</StatLabel>
                  <StatValue>#{volumeRank || '-'}</StatValue>
                </StatItem>
              </StatsRow>
            )}

            {hasBoost && (
              <BoostRow>
                {activeCollectionImage && (
                  <CollectionLogo src={activeCollectionImage} alt={activeCollection} />
                )}
                <BoostInfo>
                  <BoostLabel>Active Boost</BoostLabel>
                  <BoostValue>
                    {activeCollection}
                    <MultiplierBadge>{activeMultiplier}x</MultiplierBadge>
                  </BoostValue>
                </BoostInfo>
              </BoostRow>
            )}
          </TournamentCard>
        </TournamentSection>
      )}
    </Header>
  );
};

export default ProfileHeader;
