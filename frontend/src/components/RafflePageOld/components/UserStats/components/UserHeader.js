import React from 'react';
import {
  StatsHeader,
  UserInfo,
  Avatar,
  UserDetails,
  TierBadge
} from '../styles';
import { LABELS } from '../data/statsConfig';

const UserHeader = ({ displayName, userInfo, tier }) => {
  return (
    <StatsHeader>
      <UserInfo>
        <Avatar avatar={userInfo.avatar}>
          {!userInfo.avatar && displayName.charAt(0).toUpperCase()}
        </Avatar>
        <UserDetails>
          <h3>{displayName}</h3>
          <p>
            {userInfo.isVerified ? `${userInfo.verificationIcon || '✅'} ${LABELS.verified}` : LABELS.unverified} • 
            {LABELS.memberSince} {userInfo.memberSince}
          </p>
        </UserDetails>
      </UserInfo>
      <TierBadge tier={tier}>
        {tier} {LABELS.memberSuffix}
      </TierBadge>
    </StatsHeader>
  );
};

export default UserHeader; 