import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useWalletClient } from 'wagmi';

// Import hooks and components from old RafflePage
import usePrivyRaffle from '../../../RafflePageOld/hooks/usePrivyRaffle';
import { usePrivyOptimized } from '../../../../context';

// Import form hooks
import { useCreateRaffleForm } from '../../../RafflePageOld/components/CreateRaffleModal/hooks/useCreateRaffleForm';
import { useFormValidation } from '../../../RafflePageOld/components/CreateRaffleModal/hooks/useFormValidation';
import { useRaffleSubmission } from '../../../RafflePageOld/components/CreateRaffleModal/hooks/useRaffleSubmission';

// Import asset fetcher
import { fetchUserAssets } from '../../../RafflePageOld/components/CreateRaffleModal/utils/assetFetcher';

// Import components
import PrizeTypeSelector from '../../../RafflePageOld/components/CreateRaffleModal/components/PrizeTypeSelector';
import AssetSelector from '../../../RafflePageOld/components/CreateRaffleModal/components/AssetSelector';
import PrizeConfigForm from '../../../RafflePageOld/components/CreateRaffleModal/components/PrizeConfigForm';
import DurationSelector from '../../../RafflePageOld/components/CreateRaffleModal/components/DurationSelector';
import LoadingSpinner from '../../../RafflePageOld/components/CreateRaffleModal/components/LoadingSpinner';
import PrizeAmountForm from '../../../RafflePageOld/components/CreateRaffleTab/PrizeAmountForm';
import TicketConfigForm from '../../../RafflePageOld/components/CreateRaffleTab/TicketConfigForm';
import NFTListSelector from '../../../RafflePageOld/components/CreateRaffleTab/NFTListSelector';

// Import toast hook
import { useRaffleToast } from '../../../RafflePageOld/components/CreateRaffleTab/hooks/useRaffleToast';

// Import styles
import {
  CreateContainer,
  ScrollContainer,
  ContentWrapper,
  BackButton,
  StepsContainer,
  StepPanel,
  StepTitle,
  StepContent,
  SubmitSection,
  PrimaryButton,
  SecondaryButton,
  StatusMessage,
  GlobalInputStyles
} from './styles';

// Monad Token Display Component
const MonadTokenDisplay = () => (
  <div style={{
    border: '2px solid #6930c3',
    borderRadius: '16px',
    padding: '24px',
    background: 'linear-gradient(135deg, rgba(105, 48, 195, 0.08) 0%, rgba(105, 48, 195, 0.03) 100%)',
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
    marginBottom: '16px',
    boxShadow: '0 4px 16px rgba(105, 48, 195, 0.15)'
  }}>
    <img 
      src="/assets/images/monad.png" 
      alt="Monad Token"
      style={{
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        objectFit: 'cover',
        background: 'white',
        padding: '8px',
        boxShadow: '0 4px 12px rgba(105, 48, 195, 0.2)'
      }}
      onError={(e) => { e.target.style.display = 'none'; }}
    />
    <div style={{ flex: 1 }}>
      <div style={{
        fontSize: '18px',
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: '4px'
      }}>
        Monad
      </div>
      <div style={{
        fontSize: '14px',
        color: '#6930c3',
        fontWeight: '600'
      }}>
        MON
      </div>
    </div>
  </div>
);

/**
 * Create Raffle Page Component
 */
const CreateRafflePage = () => {
  const navigate = useNavigate();
  const privyRaffle = usePrivyRaffle();
  const { user, ready, login, connectors } = usePrivyOptimized();
  const { data: walletClient } = useWalletClient();

  // Create activeWallet to match RafflePage pattern
  const activeWallet = connectors?.find(wallet => wallet.address === user?.wallet?.address);
  const address = user?.wallet?.address || '';
  const isConnected = ready && !!user?.wallet?.address;

  // Toast handlers
  const { addSuccessToast, addErrorToast, addInfoToast } = useRaffleToast();

  // Custom hooks
  const {
    formData,
    errors,
    updateField,
    updateMultipleFields,
    resetForm
  } = useCreateRaffleForm();

  const walletAddress = address || null;

  // Asset state management
  const [assets, setAssets] = useState({ tokens: [], nfts: [] });
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState(null);

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
      setAssets({ tokens: [], nfts: [] });
    } finally {
      setAssetsLoading(false);
    }
  }, []);

  // State to trigger asset fetching (like RafflePage)
  const [triggerAssetFetch, setTriggerAssetFetch] = useState(false);

  // Trigger asset fetch when wallet connects
  useEffect(() => {
    if (isConnected && walletAddress) {
      setTriggerAssetFetch(true);
    }
  }, [isConnected, walletAddress]);

  // Trigger asset fetch when component mounts or wallet changes
  useEffect(() => {
    if (walletAddress && triggerAssetFetch) {
      console.log('Triggering asset fetch for:', walletAddress);
      
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

  // Helper function to create user-friendly error messages
  const getUserFriendlyError = (error) => {
    const errorStr = error.toString().toLowerCase();
    
    if (errorStr.includes('user rejected') || errorStr.includes('user denied')) {
      return 'Transaction cancelled by user';
    } else if (errorStr.includes('insufficient funds')) {
      return 'Insufficient balance to create raffle';
    } else if (errorStr.includes('network')) {
      return 'Network error. Please check your connection';
    } else if (errorStr.includes('gas')) {
      return 'Transaction failed due to gas issues';
    } else if (errorStr.includes('revert')) {
      return 'Smart contract error. Please try again';
    } else {
      return 'Failed to create raffle. Please try again';
    }
  };

  const {
    isSubmitting,
    submissionError,
    canSubmit,
    submitRaffle,
    clearSubmissionError
  } = useRaffleSubmission(
    () => {
      addSuccessToast('Raffle created successfully!');
      navigate('/raffle');
    },
    (error) => {
      const friendlyError = getUserFriendlyError(error);
      addErrorToast(friendlyError);
    },
    privyRaffle
  );

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

  // Event handlers
  const handleFieldChange = useCallback((field, value) => {
    updateField(field, value);
    validateFieldOnChange(field, value);
  }, [updateField, validateFieldOnChange]);

  const handlePrizeTypeChange = useCallback((prizeType) => {
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
    
    if (isSubmitting) {
      addErrorToast('Raffle creation already in progress');
      return;
    }
    
    addInfoToast('Creating raffle...');
    
    const validation = await validateEntireForm();
    if (!validation.isValid) {
      addErrorToast('Please fix form errors before submitting');
      return;
    }

    // Final safety check for required fields
    if (formData.prizeType === 'TOKEN' && (!formData.prizeAmount || parseFloat(formData.prizeAmount) <= 0)) {
      addErrorToast('Invalid prize amount');
      return;
    }

    if (formData.prizeType === 'NFT' && !formData.selectedAsset) {
      addErrorToast('Please select an NFT');
      return;
    }

    await submitRaffle(formData);
  }, [validateEntireForm, submitRaffle, formData, clearSubmissionError, addInfoToast, addErrorToast, isSubmitting]);

  const handleReset = useCallback(() => {
    resetForm();
    clearAllErrors();
    clearSubmissionError();
  }, [resetForm, clearAllErrors, clearSubmissionError]);

  const handleBack = () => {
    navigate('/raffle');
  };

  const canSubmitForm = canSubmit && isFormReady();
  
  // Debug logs - remove in production
  // console.log('🔍 Form Debug:', {
  //   canSubmit,
  //   isFormReady: isFormReady(),
  //   canSubmitForm,
  //   errors: Object.keys(errors).length > 0 ? errors : 'no errors'
  // });

  // Handle connect wallet
  const handleConnectWallet = useCallback(() => {
    login();
  }, [login]);

  // Loading state check
  if (!ready) {
    return (
      <CreateContainer>
        <ScrollContainer>
          <ContentWrapper>
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <h2>Loading...</h2>
            </div>
          </ContentWrapper>
        </ScrollContainer>
      </CreateContainer>
    );
  }

  return (
    <CreateContainer>
      <ScrollContainer>
        <ContentWrapper>
          <BackButton onClick={handleBack}>
            <ArrowLeft size={20} />
            Return
          </BackButton>

          {/* Wallet Connection Warning */}
          {!isConnected && (
            <StatusMessage className="error">
              <div style={{ textAlign: 'center' }}>
                <h3>Wallet Not Connected</h3>
                <p>Please connect your wallet to create raffles</p>
                <SecondaryButton onClick={handleConnectWallet} style={{ marginTop: '1rem' }}>
                  Connect Wallet
                </SecondaryButton>
              </div>
            </StatusMessage>
          )}

          {/* Removed inline error display - now using toast notifications */}

          {/* Only show steps if wallet is connected */}
          {isConnected && (
            <StepsContainer>
              {/* Step 1: Prize Type Selection */}
              <StepPanel $stepNumber="1" $isActive={true}>
                <StepTitle>Choose Prize Type</StepTitle>
                <StepContent $isActive={true}>
                  <GlobalInputStyles>
                    <PrizeTypeSelector
                      selectedType={formData.prizeType}
                      onTypeChange={handlePrizeTypeChange}
                      disabled={isSubmitting}
                    />
                  </GlobalInputStyles>
                </StepContent>
              </StepPanel>

            {/* Step 2: Asset Selection & Prize Amount */}
            <StepPanel $stepNumber="2" $isActive={!!formData.prizeType}>
              <StepTitle>
                {formData.prizeType === 'NFT' ? 'Select Asset' : 'Set Amount'}
              </StepTitle>
              <StepContent $isActive={!!formData.prizeType}>
                <GlobalInputStyles>
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
                      <MonadTokenDisplay />
                      <PrizeAmountForm
                        formData={formData}
                        errors={errors}
                        onFieldChange={handleFieldChange}
                        disabled={isSubmitting}
                        userBalance={assets.tokens?.[0]?.balance || '0'}
                      />
                    </>
                  )}
                </GlobalInputStyles>
              </StepContent>
            </StepPanel>

            {/* Step 3: Ticket Configuration */}
            <StepPanel $stepNumber="3" $isActive={formData.prizeType === 'TOKEN' ? !!formData.prizeAmount : !!formData.selectedAsset}>
              <StepTitle>Ticket Settings</StepTitle>
              <StepContent $isActive={formData.prizeType === 'TOKEN' ? !!formData.prizeAmount : !!formData.selectedAsset}>
                <GlobalInputStyles>
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
                </GlobalInputStyles>
              </StepContent>
            </StepPanel>

            {/* Step 4: Duration Configuration */}
            <StepPanel $stepNumber="4" $isActive={
              (formData.prizeType === 'TOKEN' && formData.prizeAmount && formData.ticketPrice && formData.maxTicketsPerWallet) ||
              (formData.prizeType === 'NFT' && formData.selectedAsset && formData.ticketPrice && formData.maxTicketsPerWallet)
            }>
              <StepTitle>Set Duration</StepTitle>
              <StepContent $isActive={
                (formData.prizeType === 'TOKEN' && formData.prizeAmount && formData.ticketPrice && formData.maxTicketsPerWallet) ||
                (formData.prizeType === 'NFT' && formData.selectedAsset && formData.ticketPrice && formData.maxTicketsPerWallet)
              }>
                <GlobalInputStyles>
                  {((formData.prizeType === 'TOKEN' && formData.prizeAmount && formData.ticketPrice && formData.maxTicketsPerWallet) ||
                    (formData.prizeType === 'NFT' && formData.selectedAsset && formData.ticketPrice && formData.maxTicketsPerWallet)) && (
                    <DurationSelector
                      formData={formData}
                      errors={errors}
                      onDurationSelect={handleDurationSelect}
                      onFieldChange={handleFieldChange}
                      onMultipleFieldsChange={updateMultipleFields}
                      disabled={isSubmitting}
                    />
                  )}
                </GlobalInputStyles>
              </StepContent>
            </StepPanel>
            </StepsContainer>
          )}

          {/* Only show submit section if wallet is connected */}
          {isConnected && (
            <SubmitSection>
            <SecondaryButton
              type="button"
              onClick={handleReset}
              disabled={isSubmitting}
            >
              Reset
            </SecondaryButton>
            
            <PrimaryButton
              type="submit"
              onClick={handleSubmit}
              disabled={!canSubmitForm || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner />
                  Creating...
                </>
              ) : (
                <>
                  <span>Create </span>
                  <span className="price-text">Raffle</span>
                </>
              )}
            </PrimaryButton>
            </SubmitSection>
          )}
        </ContentWrapper>
      </ScrollContainer>
    </CreateContainer>
  );
};

export default CreateRafflePage;