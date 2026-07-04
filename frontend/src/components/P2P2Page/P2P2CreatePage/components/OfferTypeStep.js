import React from 'react';
import {
  StepSlot,
  StepCard,
  StepTitle,
  StepDescription,
  ToggleGroup,
  ToggleButton
} from '../styles';

const OfferTypeStep = ({ offerType, onChange, disabled = false }) => {
  return (
    <StepSlot data-active="true">
      <StepCard>
        <StepTitle>Choose Offer Type</StepTitle>
        <StepDescription>How do you want to handle trading?</StepDescription>

        <ToggleGroup>
          <ToggleButton
            $active={offerType === 'OPEN'}
            onClick={() => !disabled && onChange('OPEN')}
            disabled={disabled}
            style={{
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
              pointerEvents: disabled ? 'none' : 'auto'
            }}
          >
            <div className="title">Open Offer</div>
            <div className="description">Anyone can propose what to trade</div>
          </ToggleButton>

          <ToggleButton
            $active={offerType === 'SPECIFIC'}
            onClick={() => !disabled && onChange('SPECIFIC')}
            disabled={disabled}
            style={{
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
              pointerEvents: disabled ? 'none' : 'auto'
            }}
          >
            <div className="title">Specific Request</div>
            <div className="description">Request specific assets that you want to receive</div>
          </ToggleButton>
        </ToggleGroup>
      </StepCard>
    </StepSlot>
  );
};

export default OfferTypeStep;
