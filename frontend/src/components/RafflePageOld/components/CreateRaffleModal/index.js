import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import usePrivyRaffle from '../../hooks/usePrivyRaffle';
import { usePrivyOptimized } from '../../../../context';
import styled from 'styled-components';

// Custom hooks
import { useCreateRaffleForm } from './hooks/useCreateRaffleForm';
import { useAssetManagement } from './hooks/useAssetManagement';
import { useFormValidation } from './hooks/useFormValidation';
import { useRaffleSubmission } from './hooks/useRaffleSubmission';

// Components
import ModalHeader from './components/ModalHeader';
import PrizeTypeSelector from './components/PrizeTypeSelector';
import AssetSelector from './components/AssetSelector';
// import BasicInfoForm from './components/BasicInfoForm'; // Removed - using mock data
import PrizeConfigForm from './components/PrizeConfigForm';
import DurationSelector from './components/DurationSelector';
import LoadingSpinner from './components/LoadingSpinner';

// Configuration
import { COLOR_CONFIG, MODAL_CONFIG } from './data/modalConfig';

// Styled components
import {
  ModalOverlay,
  ModalContainer,
  ModalContent,
  FormContainer,
  ModalFooter,
  ActionButtons,
  PrimaryButton,
  SecondaryButton,
  ProgressContainer,
  ProgressBar,
  ProgressFill,
  ProgressText,
  StatusMessage,
  StepIndicator,
  PreviewSection,
  PreviewTitle,
  PreviewContent,
  PreviewImage,
  PreviewInfo
} from './styles';

// Monad Native Token Display Component
const MonadTokenDisplay = styled.div`
  font-family: 'Lexend', sans-serif;
  margin-bottom: ${MODAL_CONFIG.spacing.section}px;
`;

const TokenDisplayTitle = styled.h3`
  font-family: 'Lexend', sans-serif;
  margin: 0 0 16px 0;
  color: ${COLOR_CONFIG.text.primary};
  font-size: 18px;
  font-weight: 600;
`;

const TokenCard = styled.div`
  font-family: 'Lexend', sans-serif;
  border: 2px solid ${COLOR_CONFIG.primary};
  border-radius: ${MODAL_CONFIG.borderRadius.card}px;
  padding: 20px;
  background: linear-gradient(135deg, rgba(105, 48, 195, 0.05) 0%, rgba(105, 48, 195, 0.02) 100%);
  display: flex;
  align-items: center;
  gap: 16px;
`;

const TokenImage = styled.img`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
  background: white;
  padding: 8px;
  box-shadow: 0 4px 12px rgba(105, 48, 195, 0.2);
`;

const TokenInfo = styled.div`
  font-family: 'Lexend', sans-serif;
  flex: 1;
`;

const TokenName = styled.div`
  font-family: 'Lexend', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: ${COLOR_CONFIG.text.primary};
  margin-bottom: 4px;
`;

const TokenSymbol = styled.div`
  font-family: 'Lexend', sans-serif;
  font-size: 14px;
  color: ${COLOR_CONFIG.primary};
  font-weight: 600;
  margin-bottom: 4px;
`;

const TokenDescription = styled.div`
  font-family: 'Lexend', sans-serif;
  font-size: 12px;
  color: ${COLOR_CONFIG.text.muted};
  line-height: 1.4;
`;

const TokenBadge = styled.div`
  font-family: 'Lexend', sans-serif;
  background: ${COLOR_CONFIG.primary};
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  align-self: flex-start;
`;

/**
 * Monad Native Token Display Component
 */
const MonadTokenDisplayComponent = () => {
  return (
    <MonadTokenDisplay>
      <TokenDisplayTitle>Prize Token</TokenDisplayTitle>
      <TokenCard>
        <TokenImage 
          src="/assets/images/monad.png" 
          alt="Monad Token"
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
        <TokenInfo>
          <TokenName>Monad</TokenName>
          <TokenSymbol>MON</TokenSymbol>
          <TokenDescription>
            Native token of the Monad blockchain. Fast, secure, and decentralized.
          </TokenDescription>
        </TokenInfo>
        <TokenBadge>Native</TokenBadge>
      </TokenCard>
    </MonadTokenDisplay>
  );
};

/**
 * Create Raffle Modal Component
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onSuccess - Success callback
 * @param {Function} props.onError - Error callback
 * @returns {JSX.Element} Create raffle modal
 */
const CreateRaffleModal = ({
  isOpen,
  onClose,
  onSuccess,
  onError
}) => {
  const privyRaffle = usePrivyRaffle();
  const { user } = usePrivyOptimized();
  const [isClosing, setIsClosing] = useState(false);

  // Custom hooks
  const {
    formData,
    errors,
    updateField,
    updateMultipleFields,
    resetForm,
    getFormSummary
  } = useCreateRaffleForm();

  // Get wallet address from active wallet
  const walletAddress = privyRaffle?.activeWallet?.address || null;
  
  // Debug logging
  // console.log('CreateRaffleModal Debug:', {
  //   privyRaffle: !!privyRaffle,
  //   activeWallet: !!privyRaffle?.activeWallet,
  //   walletAddress,
  //   isOpen,
  //   userAddress: privyRaffle?.userAddress
  // });

  const {
    assets,
    loading: assetsLoading,
    error: assetsError,
    getAssetsForPrizeType,
    fetchAssets,
    refreshAssets
  } = useAssetManagement(walletAddress, isOpen);

  const {
    validateEntireForm,
    validateFieldOnChange,
    isFormReady,
    getValidationSummary,
    clearAllErrors
  } = useFormValidation(formData, errors, (newErrors) => {
    updateMultipleFields({ errors: newErrors });
  });

  const {
    isSubmitting,
    submissionError,
    canSubmit,
    submitRaffle,
    clearSubmissionError
  } = useRaffleSubmission(onSuccess, onError, privyRaffle);

  // Get current assets based on prize type
  const currentAssets = getAssetsForPrizeType(formData.prizeType) || [];

  // Handle form field changes with validation
  const handleFieldChange = useCallback((field, value) => {
    updateField(field, value);
    validateFieldOnChange(field, value);
  }, [updateField, validateFieldOnChange]);

  // Handle prize type change
  const handlePrizeTypeChange = useCallback((prizeType) => {
    updateMultipleFields({
      prizeType,
      selectedAsset: null,
      prizeAmount: ''
    });
    clearAllErrors();
  }, [updateMultipleFields, clearAllErrors]);

  // Handle asset selection
  const handleAssetSelect = useCallback((asset) => {
    updateField('selectedAsset', asset);
  }, [updateField]);

  // Handle duration selection
  const handleDurationSelect = useCallback((hours) => {
    updateMultipleFields({
      duration: hours,
      useCustomDuration: false,
      customDuration: ''
    });
  }, [updateMultipleFields]);

  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    // Clear previous submission errors
    clearSubmissionError();
    
    // Validate form before submission
    const validation = await validateEntireForm();
    if (!validation.isValid) {
      return;
    }

    // Submit form
    await submitRaffle(formData);
  }, [validateEntireForm, submitRaffle, formData, clearSubmissionError]);

  // Handle modal close
  const handleClose = useCallback(() => {
    if (!isSubmitting && !isClosing) {
      setIsClosing(true);
      
      // Wait for animation to complete before calling onClose
      setTimeout(() => {
        resetForm();
        clearAllErrors();
        clearSubmissionError();
        onClose();
        setIsClosing(false);
      }, 300); // Match animation duration
    }
  }, [isSubmitting, isClosing, resetForm, clearAllErrors, clearSubmissionError, onClose]);

  // Handle overlay click
  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }, [handleClose]);

  if (!isOpen && !isClosing) return null;

  const validationSummary = getValidationSummary();
  const canSubmitForm = canSubmit && isFormReady();

  const modalContent = (
    <ModalOverlay $isClosing={isClosing} onClick={handleOverlayClick}>
      <ModalContainer $isClosing={isClosing}>
        <ModalHeader 
          title="Create Raffle"
          onClose={handleClose}
          disabled={isSubmitting}
        />
        
        <ModalContent>
          {isSubmitting && (
            <ProgressContainer>
              <ProgressBar>
                <ProgressFill $percentage={75} />
              </ProgressBar>
              <ProgressText>Creating raffle...</ProgressText>
              <StepIndicator>
                <div className="step-icon">
                  <LoadingSpinner />
                </div>
                Processing...
              </StepIndicator>
            </ProgressContainer>
          )}

          {submissionError && (
            <StatusMessage className="error">
              ⚠ {submissionError}
            </StatusMessage>
          )}

          <FormContainer onSubmit={handleSubmit}>
            <PrizeTypeSelector
              selectedType={formData.prizeType}
              onTypeChange={handlePrizeTypeChange}
              disabled={isSubmitting}
            />

            {formData.prizeType === 'NFT' && (
              <AssetSelector
                assets={currentAssets}
                loading={assetsLoading}
                error={assetsError}
                selectedAsset={formData.selectedAsset}
                onAssetSelect={handleAssetSelect}
                prizeType={formData.prizeType}
                disabled={isSubmitting}
              />
            )}

            {formData.prizeType === 'TOKEN' && (
              <MonadTokenDisplayComponent />
            )}

            {/* BasicInfoForm removed - using mock data for title and description */}

            <PrizeConfigForm
              formData={formData}
              errors={errors}
              onFieldChange={handleFieldChange}
              disabled={isSubmitting}
              walletAddress={walletAddress}
            />

            <DurationSelector
              formData={formData}
              errors={errors}
              onDurationSelect={handleDurationSelect}
              onFieldChange={handleFieldChange}
              disabled={isSubmitting}
            />
          </FormContainer>
        </ModalContent>

        <ModalFooter>
          <ActionButtons>
            <SecondaryButton
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </SecondaryButton>
            
            <PrimaryButton
              type="submit"
              onClick={handleSubmit}
              disabled={!canSubmitForm || isSubmitting}
              $loading={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner />
                  Creating...
                </>
              ) : (
                'Create Raffle'
              )}
            </PrimaryButton>
          </ActionButtons>
        </ModalFooter>
      </ModalContainer>
    </ModalOverlay>
  );

  return createPortal(modalContent, document.body);
};

export default CreateRaffleModal; 