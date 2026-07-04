import React from 'react';
import {
  PrefillProgressWrapper,
  PrefillProgressCard,
  PrefillProgressStep,
  PrefillProgressBullet,
  PrefillProgressText,
  PrefillProgressTitle,
  PrefillProgressSubtitle
} from './prefillStyles';

const PrefillProgress = ({ visible, steps, stepStates }) => {
  if (!visible || !stepStates) return null;

  return (
    <PrefillProgressWrapper>
      <PrefillProgressCard>
        {steps.map((step) => {
          const state = stepStates[step.key] || 'pending';
          const bullet = state === 'done' ? '✓' : state === 'active' ? '●' : state === 'error' ? '!' : '○';

          return (
            <PrefillProgressStep key={step.key} $state={state} $step={step.key}>
              <PrefillProgressBullet $state={state} $step={step.key}>{bullet}</PrefillProgressBullet>
              <PrefillProgressText>
                <PrefillProgressTitle>{step.title}</PrefillProgressTitle>
                <PrefillProgressSubtitle>{step.subtitle}</PrefillProgressSubtitle>
              </PrefillProgressText>
            </PrefillProgressStep>
          );
        })}
      </PrefillProgressCard>
    </PrefillProgressWrapper>
  );
};

export default PrefillProgress;
