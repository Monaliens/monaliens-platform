import React from 'react';
import {
  StepSlot,
  StepCard,
  StepTitle,
  StepDescription,
  HelperText
} from '../styles';

const CounterOfferStep = ({ prefillLabel, targetOfferId }) => {
  const label = prefillLabel || (targetOfferId ? `Offer #${targetOfferId}` : 'original offer');

  return (
    <StepSlot data-active="true">
      <StepCard>
        <StepTitle>Counter Offer</StepTitle>
        <StepDescription>
          You are preparing a counter offer. Requested items stay locked to match the original trade; choose what you will give in return.
        </StepDescription>
        <HelperText>
          Target offer: {label}
        </HelperText>
      </StepCard>
    </StepSlot>
  );
};

export default CounterOfferStep;
