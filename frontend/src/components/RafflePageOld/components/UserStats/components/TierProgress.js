import React from 'react';
import {
  ProgressSection,
  ProgressLabel,
  ProgressBar,
  ProgressFill,
  ProgressText
} from '../styles';
import { LABELS } from '../data/statsConfig';

const TierProgress = ({ tierProgress }) => {
  // Don't render if user is at max tier or no next tier
  if (!tierProgress.nextTier || tierProgress.isMaxTier) {
    return null;
  }

  return (
    <ProgressSection>
      <ProgressLabel>
        {LABELS.progressToNextTier} {tierProgress.nextTier} ({tierProgress.required} {LABELS.moreActivitiesNeeded})
      </ProgressLabel>
      <ProgressBar>
        <ProgressFill percentage={tierProgress.progress} />
      </ProgressBar>
      <ProgressText>
        <span>{Math.round(tierProgress.progress)}{LABELS.percentComplete}</span>
        <span>{tierProgress.nextTier} {LABELS.tier}</span>
      </ProgressText>
    </ProgressSection>
  );
};

export default TierProgress; 