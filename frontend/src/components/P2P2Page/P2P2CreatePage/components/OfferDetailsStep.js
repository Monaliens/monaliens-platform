import React from 'react';
import {
  StepCard,
  StepTitle,
  StepDescription,
  HelperText,
  FormLabel,
  FormInput,
  FormTextarea,
  SummaryList,
  SummaryItem,
  SummaryBadge,
  SummaryItemLabel,
  SummaryRemoveButton,
  SummaryThumbnail,
  InlineError,
  ActionButton,
  StepScrollable,
  StepperContainer,
  StepperStep,
  StepperLine,
  StepperDot,
  StepperLabel,
  DurationSegmented,
  DurationSegmentedThumb,
  DurationSegmentedOption
} from '../styles';
import { shortenAddress } from '../utils/assetHelpers';

const OfferDetailsStep = ({
  isSpecificOffer,
  requestedAssetCount,
  counterContext,
  prefillLabel,
  requestedSummary,
  requestedNativeAmount,
  onRequestedNativeChange,
  onSaveRequestedNative,
  generatedTitle,
  generatedDescription,
  violatesCollectionConstraint,
  handleSummaryRemove,
  txLoading,
  handleCreateOffer,
  step,
  txHash,
  allowRequestedNativeEdit = true,
  allowSummaryRemoval = true,
  ctaLabel = 'Create Offer',
  isIndexing = false,
  disabled = false,
  validationError = false,
  duration = 86400,
  onDurationChange
}) => {
  const actionDisabled = txLoading || isIndexing || violatesCollectionConstraint || disabled;
  const actionLabel = txLoading ? 'Processing…' : isIndexing ? 'Waiting for indexer…' : ctaLabel;

  const durations = [
    { label: '12h', value: 43200 },
    { label: '24h', value: 86400 },
    { label: '3d', value: 259200 },
    { label: '1w', value: 604800 },
  ];

  return (
    <StepCard>
      <StepTitle>Offer Details</StepTitle>
      <StepDescription>
        {isSpecificOffer
          ? `You are requesting ${requestedAssetCount} ${requestedAssetCount === 1 ? 'item' : 'items'} in return`
          : 'Review and finalize your offer'}
      </StepDescription>
      {counterContext.targetOfferId ? (
        <HelperText>
          Countering {prefillLabel || `Offer #${counterContext.targetOfferId}`}
        </HelperText>
      ) : null}

      <StepScrollable>
        <div>
          <FormLabel>Title</FormLabel>
          <FormInput type="text" value={generatedTitle} readOnly />
        </div>

        <div>
          <FormLabel>Description</FormLabel>
          <FormTextarea value={generatedDescription} readOnly />
        </div>

        <div>
          <FormLabel>Offer Duration</FormLabel>
          <DurationSegmented>
            <DurationSegmentedThumb
              style={{
                transform: `translateX(${durations.findIndex(d => d.value === duration) * 100}%)`
              }}
            />
            {durations.map((d) => (
              <DurationSegmentedOption
                key={d.value}
                type="button"
                $active={duration === d.value}
                onClick={() => !disabled && onDurationChange && onDurationChange(d.value)}
                disabled={disabled}
              >
                {d.label}
              </DurationSegmentedOption>
            ))}
          </DurationSegmented>
          <HelperText>How long the offer remains active</HelperText>
        </div>

        <div>
          <FormLabel>Requested summary</FormLabel>
          {requestedSummary.length === 0 ? (
            <HelperText>No requested items yet.</HelperText>
          ) : (
            <SummaryList>
              {requestedSummary.map((item) => (
                <SummaryItem key={item.id}>
                  <SummaryBadge>
                    {item.type === 'collection' ? 'Collection' : item.type === 'token' ? (item.symbol || 'MON') : 'NFT'}
                  </SummaryBadge>
                  {item.thumbnail ? (
                    <SummaryThumbnail src={item.thumbnail} alt={item.label} />
                  ) : null}
                  <SummaryItemLabel>{item.label}</SummaryItemLabel>
                  {allowSummaryRemoval && item.type !== 'token' && (
                    <SummaryRemoveButton
                      type="button"
                      onClick={() => handleSummaryRemove(item.id)}
                      aria-label={`Remove ${item.label}`}
                    >
                      &times;
                    </SummaryRemoveButton>
                  )}
                </SummaryItem>
              ))}
            </SummaryList>
          )}
          {violatesCollectionConstraint && (
            <InlineError>You can only select one collection for a collection offer.</InlineError>
          )}
        </div>
      </StepScrollable>

      <ActionButton
        style={{
          marginTop: '16px',
          animation: validationError ? 'shake 0.6s ease-in-out' : 'none',
          background: validationError ? '#dc2626' : '',
          borderColor: validationError ? '#dc2626' : '',
          transition: validationError ? 'none' : 'all 0.3s ease'
        }}
        onClick={handleCreateOffer}
        disabled={actionDisabled}
      >
        {actionLabel}
      </ActionButton>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
          20%, 40%, 60%, 80% { transform: translateX(10px); }
        }
      `}</style>

      {(txLoading || step !== 'idle' || txHash) && (
        <div style={{ marginTop: 12 }}>
          <FormLabel>Transaction status</FormLabel>
          <StepperContainer>
            <StepperStep $active={step === 'preparing' || step === 'approving' || step === 'creating' || step === 'success'} $completed={step !== 'idle'}>
              <StepperDot />
              <StepperLabel>Prepare</StepperLabel>
            </StepperStep>
            <StepperLine />
            <StepperStep $active={step === 'approving' || step === 'creating' || step === 'success'} $completed={step === 'creating' || step === 'success'}>
              <StepperDot />
              <StepperLabel>Approvals</StepperLabel>
            </StepperStep>
            <StepperLine />
            <StepperStep $active={step === 'creating' || step === 'success'} $completed={step === 'success'}>
              <StepperDot />
              <StepperLabel>Create</StepperLabel>
            </StepperStep>
          </StepperContainer>

          {txHash && (
            <HelperText>
              Tx: <a href={`https://testnet.monadexplorer.com/tx/${txHash}`} target="_blank" rel="noreferrer">{shortenAddress(txHash)}</a>
            </HelperText>
          )}
        </div>
      )}
    </StepCard>
  );
};

export default OfferDetailsStep;
