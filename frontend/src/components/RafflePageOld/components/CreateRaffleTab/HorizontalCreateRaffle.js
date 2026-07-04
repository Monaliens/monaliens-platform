import React, { useCallback, useEffect, useState } from 'react';
import usePrivyRaffle from '../../hooks/usePrivyRaffle';
import { usePrivyOptimized } from '../../../../context';
import styled from 'styled-components';

// Custom hooks
import { useCreateRaffleForm } from '../CreateRaffleModal/hooks/useCreateRaffleForm';
import { useFormValidation } from '../CreateRaffleModal/hooks/useFormValidation';
import { useRaffleSubmission } from '../CreateRaffleModal/hooks/useRaffleSubmission';

// Asset fetcher
import { fetchUserAssets } from '../CreateRaffleModal/utils/assetFetcher';

// Components
import PrizeTypeSelector from '../CreateRaffleModal/components/PrizeTypeSelector';
import AssetSelector from '../CreateRaffleModal/components/AssetSelector';
import PrizeConfigForm from '../CreateRaffleModal/components/PrizeConfigForm';
import DurationSelector from '../CreateRaffleModal/components/DurationSelector';
import LoadingSpinner from '../CreateRaffleModal/components/LoadingSpinner';
import PrizeAmountForm from './PrizeAmountForm';
import TicketConfigForm from './TicketConfigForm';
import NFTListSelector from './NFTListSelector';

// Configuration
import { COLOR_CONFIG } from '../CreateRaffleModal/data/modalConfig';

// Styled components for horizontal layout
const HorizontalContainer = styled.div`
  font-family: 'Lexend', sans-serif;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  background: white;
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  min-height: 70vh;
`;

const StepsContainer = styled.div`
  display: flex;
  width: 100%;
  min-height: 600px;
  padding-top: 24px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    min-height: auto;
    padding-top: 16px;
  }
`;

const StepPanel = styled.div`
  flex: ${props => props.$stepNumber === '2' ? '1.5' : '1'};
  padding: 32px;
  border-right: ${props => props.$isLast ? 'none' : '2px solid #f1f5f9'};
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: 0; /* Allow flex shrinking */
  opacity: ${props => props.$isActive ? '1' : '0.5'};
  transform: ${props => props.$isActive ? 'scale(1)' : 'scale(0.98)'};
  transition: all 0.3s ease;
  
  &::before {
    content: '${props => props.$stepNumber}';
    position: absolute;
    top: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
    background: ${props => props.$isActive ? COLOR_CONFIG.primary : '#e2e8f0'};
    color: ${props => props.$isActive ? 'white' : '#64748b'};
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    transition: all 0.3s ease;
  }
  
  @media (max-width: 768px) {
    flex: 1;
    border-right: none;
    border-bottom: ${props => props.$isLast ? 'none' : '2px solid #f1f5f9'};
    padding: 24px 20px;
    
    &::before {
      top: 8px;
      right: 8px;
      width: 28px;
      height: 28px;
      font-size: 12px;
    }
  }
`;

const StepTitle = styled.h3`
  font-family: 'Lexend', sans-serif;
  color: ${COLOR_CONFIG.primary};
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 16px 0;
  
  @media (max-width: 768px) {
    font-size: 16px;
  }
`;

const StepContent = styled.div`
  font-family: 'Lexend', sans-serif;
  flex: 1;
  opacity: ${props => props.$isActive ? '1' : '0.6'};
  transform: ${props => props.$isActive ? 'translateY(0)' : 'translateY(10px)'};
  transition: all 0.4s ease 0.1s;
`;

const SubmitSection = styled.div`
  padding: 32px 40px;
  background: linear-gradient(to bottom, rgba(248, 250, 252, 0) 0%, #f8fafc 100%);
  border-top: 2px solid #e2e8f0;
  display: flex;
  justify-content: center;
  gap: 20px;
  
  @media (max-width: 768px) {
    padding: 24px 20px;
    flex-direction: column;
    gap: 12px;
  }
`;

const ActionButton = styled.button`
  font-family: 'Lexend', sans-serif;
  padding: 16px 32px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-width: 160px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
  }
  
  @media (max-width: 768px) {
    width: 100%;
    padding: 14px 24px;
  }
`;

const PrimaryButton = styled(ActionButton)`
  background: linear-gradient(135deg, ${COLOR_CONFIG.primary} 0%, #8b5cf6 100%);
  color: white;
  
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(105, 48, 195, 0.3);
  }
`;

const SecondaryButton = styled(ActionButton)`
  background: white;
  color: ${COLOR_CONFIG.text.primary};
  border: 2px solid #e2e8f0;
  
  &:hover:not(:disabled) {
    background: #f8fafc;
    border-color: ${COLOR_CONFIG.primary};
    transform: translateY(-1px);
  }
`;

const StatusMessage = styled.div`
  font-family: 'Lexend', sans-serif;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 24px;
  font-weight: 600;
  text-align: center;
  
  &.error {
    background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
    border: 2px solid #fecaca;
    color: #dc2626;
  }
  
  &.success {
    background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
    border: 2px solid #bbf7d0;
    color: #16a34a;
  }
`;

// Monad Token Display Component
const TokenDisplay = styled.div`
  border: 2px solid ${COLOR_CONFIG.primary};
  border-radius: 12px;
  padding: 20px;
  background: linear-gradient(135deg, rgba(105, 48, 195, 0.05) 0%, rgba(105, 48, 195, 0.02) 100%);
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
`;

const TokenImage = styled.img`
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
  background: white;
  padding: 6px;
  box-shadow: 0 4px 12px rgba(105, 48, 195, 0.2);
`;

const TokenInfo = styled.div`
  flex: 1;
`;

const TokenName = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: ${COLOR_CONFIG.text.primary};
  margin-bottom: 4px;
`;

const TokenSymbol = styled.div`
  font-size: 12px;
  color: ${COLOR_CONFIG.primary};
  font-weight: 600;
`;

const MonadTokenDisplayComponent = () => (
  <TokenDisplay>
    <TokenImage 
      src="/assets/images/monad.png" 
      alt="Monad Token"
      onError={(e) => { e.target.style.display = 'none'; }}
    />
    <TokenInfo>
      <TokenName>Monad</TokenName>
      <TokenSymbol>MON</TokenSymbol>
    </TokenInfo>
  </TokenDisplay>
);

/**
 * Horizontal Create Raffle Component
 */
const HorizontalCreateRaffle = ({ onSuccess, onError, userAddress, triggerAssetFetch, toastHandlers }) => {
  const privyRaffle = usePrivyRaffle();

  // Custom hooks
  const {
    formData,
    errors,
    updateField,
    updateMultipleFields,
    resetForm
  } = useCreateRaffleForm();

  // Extract toast handlers
  const { addSuccessToast, addErrorToast, addInfoToast } = toastHandlers || {};

  const walletAddress = privyRaffle?.activeWallet?.address || userAddress || null;

  // Asset state management
  const [assets, setAssets] = useState({ tokens: [], nfts: [] });
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState(null);

  // Debug wallet address
  console.log('HorizontalCreateRaffle - Wallet Address:', walletAddress);
  console.log('HorizontalCreateRaffle - PrivyRaffle:', !!privyRaffle);
  console.log('HorizontalCreateRaffle - Active Wallet:', !!privyRaffle?.activeWallet);

  // Debug assets
  console.log('HorizontalCreateRaffle - Assets:', assets);
  console.log('HorizontalCreateRaffle - Assets Loading:', assetsLoading);
  console.log('HorizontalCreateRaffle - Assets Error:', assetsError);

  // Fetch user assets function
  const fetchAssets = useCallback(async (address) => {
    if (!address) {
      console.log('No wallet address provided for asset fetching');
      return;
    }

    setAssetsLoading(true);
    setAssetsError(null);

    try {
      console.log('🔄 Fetching assets for address:', address);
      const result = await fetchUserAssets(address);
      
      console.log('✅ Assets fetched successfully:', result);
      setAssets(result);
    } catch (error) {
      console.error('❌ Error fetching assets:', error);
      setAssetsError('Failed to fetch assets');
      // Set fallback empty data
      setAssets({ tokens: [], nfts: [] });
    } finally {
      setAssetsLoading(false);
    }
  }, []);

  // Trigger asset fetch when component mounts, wallet changes, or when triggerAssetFetch changes
  useEffect(() => {
    if (walletAddress && triggerAssetFetch) {
      console.log('Triggering asset fetch for:', walletAddress);
      
      // Add cleanup to prevent race conditions
      let isCurrent = true;
      
      const fetchAssetsWithCleanup = async () => {
        try {
          await fetchAssets(walletAddress);
        } catch (error) {
          if (isCurrent) {
            console.error('Asset fetch error:', error);
          }
        }
      };
      
      fetchAssetsWithCleanup();
      
      return () => {
        isCurrent = false;
      };
    }
  }, [walletAddress, triggerAssetFetch, fetchAssets]);

  const {
    validateEntireForm,
    validateFieldOnChange,
    isFormReady,
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

  // Helper function to get assets for specific prize type
  const getAssetsForPrizeType = useCallback((prizeType) => {
    if (prizeType === 'TOKEN') {
      return assets.tokens || [];
    } else if (prizeType === 'NFT') {
      return assets.nfts || [];
    }
    return [];
  }, [assets]);

  // Get current assets based on prize type
  const currentAssets = getAssetsForPrizeType(formData.prizeType);

  // Refresh assets function
  const refreshAssets = useCallback(() => {
    if (walletAddress) {
      console.log('🔄 Refreshing assets...');
      fetchAssets(walletAddress);
    }
  }, [walletAddress, fetchAssets]);

  // Event handlers
  const handleFieldChange = useCallback((field, value) => {
    updateField(field, value);
    validateFieldOnChange(field, value);
  }, [updateField, validateFieldOnChange]);

  const handlePrizeTypeChange = useCallback((prizeType) => {
    // Reset entire form when switching between TOKEN and NFT
    resetForm();
    updateMultipleFields({
      prizeType,
      selectedAsset: null,
      prizeAmount: '',
      ticketPrice: '',
      maxTicketsPerWallet: '',
      duration: null,
      useCustomDuration: false,
      customDuration: ''
    });
    clearAllErrors();
  }, [resetForm, updateMultipleFields, clearAllErrors]);

  const handleAssetSelect = useCallback((asset) => {
    updateField('selectedAsset', asset);
  }, [updateField]);

  const handleDurationSelect = useCallback((hours) => {
    updateMultipleFields({
      duration: hours,
      useCustomDuration: false,
      customDuration: ''
    });
  }, [updateMultipleFields]);

  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();
    clearSubmissionError();
    
    // Prevent double submission
    if (isSubmitting) {
      if (addErrorToast) addErrorToast('Raffle creation already in progress');
      return;
    }
    
    // Add info toast when starting submission
    if (addInfoToast) addInfoToast('Creating raffle...');
    
    const validation = await validateEntireForm();
    if (!validation.isValid) {
      if (addErrorToast) addErrorToast('Please fix form errors before submitting');
      return;
    }

    // Final safety check for required fields
    if (formData.prizeType === 'TOKEN' && (!formData.prizeAmount || parseFloat(formData.prizeAmount) <= 0)) {
      if (addErrorToast) addErrorToast('Invalid prize amount');
      return;
    }

    if (formData.prizeType === 'NFT' && !formData.selectedAsset) {
      if (addErrorToast) addErrorToast('Please select an NFT');
      return;
    }

    await submitRaffle(formData);
  }, [validateEntireForm, submitRaffle, formData, clearSubmissionError, addInfoToast, addErrorToast, isSubmitting]);

  const handleReset = useCallback(() => {
    resetForm();
    clearAllErrors();
    clearSubmissionError();
  }, [resetForm, clearAllErrors, clearSubmissionError]);

  const canSubmitForm = canSubmit && isFormReady();

  // Effect to pass handleSubmit to parent 
  React.useEffect(() => {
    // Make handleSubmit available globally for header button
    window.raffleSubmitHandler = handleSubmit;
  }, [handleSubmit]);


  return (
    <HorizontalContainer>
      <StepsContainer>
      {/* Step 1: Prize Type Selection */}
      <StepPanel $stepNumber="1" $isActive={true}>
        <StepTitle>Choose Prize Type</StepTitle>
        <StepContent $isActive={true}>
          <PrizeTypeSelector
            selectedType={formData.prizeType}
            onTypeChange={handlePrizeTypeChange}
            disabled={isSubmitting}
          />
        </StepContent>
      </StepPanel>

      {/* Step 2: Asset Selection & Prize Amount */}
      <StepPanel $stepNumber="2" $isActive={!!formData.prizeType}>
        <StepTitle>
          {formData.prizeType === 'NFT' ? 'Select Asset' : 'Set Prize Amount'}
        </StepTitle>
        <StepContent $isActive={!!formData.prizeType}>
          {formData.prizeType === 'NFT' && (
            <NFTListSelector
              assets={currentAssets}
              loading={assetsLoading}
              error={assetsError}
              selectedAsset={formData.selectedAsset}
              onAssetSelect={handleAssetSelect}
              disabled={isSubmitting}
            />
          )}
          {formData.prizeType === 'TOKEN' && (
            <>
              <MonadTokenDisplayComponent />
              <PrizeAmountForm
                formData={formData}
                errors={errors}
                onFieldChange={handleFieldChange}
                disabled={isSubmitting}
                userBalance={assets.tokens?.[0]?.balance || '0'}
              />
            </>
          )}
        </StepContent>
      </StepPanel>

      {/* Step 3: Prize/Ticket Configuration */}
      <StepPanel $stepNumber="3" $isActive={formData.prizeType === 'TOKEN' ? !!formData.prizeAmount : !!formData.selectedAsset}>
        <StepTitle>
          {formData.prizeType === 'TOKEN' ? 'Ticket Settings' : 'Prize Configuration'}
        </StepTitle>
        <StepContent $isActive={formData.prizeType === 'TOKEN' ? !!formData.prizeAmount : !!formData.selectedAsset}>
          {formData.prizeType === 'TOKEN' && formData.prizeAmount && (
            <TicketConfigForm
              formData={formData}
              errors={errors}
              onFieldChange={handleFieldChange}
              disabled={isSubmitting}
            />
          )}
          {formData.prizeType === 'NFT' && formData.selectedAsset && (
            <PrizeConfigForm
              formData={formData}
              errors={errors}
              onFieldChange={handleFieldChange}
              disabled={isSubmitting}
              walletAddress={walletAddress}
            />
          )}
        </StepContent>
      </StepPanel>

      {/* Step 4: Duration Configuration */}
      <StepPanel $stepNumber="4" $isActive={
        (formData.prizeType === 'TOKEN' && formData.prizeAmount && formData.ticketPrice && formData.maxTicketsPerWallet) ||
        (formData.prizeType === 'NFT' && formData.selectedAsset && formData.ticketPrice && formData.maxTicketsPerWallet)
      } $isLast={true}>
        <StepTitle>Set Duration</StepTitle>
        <StepContent $isActive={
          (formData.prizeType === 'TOKEN' && formData.prizeAmount && formData.ticketPrice && formData.maxTicketsPerWallet) ||
          (formData.prizeType === 'NFT' && formData.selectedAsset && formData.ticketPrice && formData.maxTicketsPerWallet)
        }>
          {((formData.prizeType === 'TOKEN' && formData.prizeAmount && formData.ticketPrice && formData.maxTicketsPerWallet) ||
            (formData.prizeType === 'NFT' && formData.selectedAsset && formData.ticketPrice && formData.maxTicketsPerWallet)) && (
            <DurationSelector
              formData={formData}
              errors={errors}
              onDurationSelect={handleDurationSelect}
              onFieldChange={handleFieldChange}
              disabled={isSubmitting}
            />
          )}
        </StepContent>
      </StepPanel>
    </StepsContainer>
    </HorizontalContainer>
  );
};

export default HorizontalCreateRaffle;