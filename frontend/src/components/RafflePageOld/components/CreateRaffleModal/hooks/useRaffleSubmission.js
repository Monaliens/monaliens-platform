import { useState, useCallback } from 'react';
import { usePrivyOptimized } from '../../../../../context';
// Removed Privy import - using usePrivyOptimized from context instead
import { prepareSubmissionData, resetForm } from '../utils/formHelpers';
import { validateForm } from '../utils/formValidator';

import { LOADING_CONFIG, ERROR_CONFIG } from '../data/assetConfig';
import { INITIAL_FORM_DATA } from '../data/formConfig';

/**
 * Custom hook for handling raffle submission with Privy integration
 * @param {Function} onSuccess - Success callback
 * @param {Function} onError - Error callback  
 * @param {Object} privyRaffle - Privy raffle hook instance
 * @returns {Object} Submission state and handlers
 */
export const useRaffleSubmission = (onSuccess, onError, privyRaffle) => {
  const { authenticated, user, connectors } = usePrivyOptimized();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStep, setSubmissionStep] = useState(null);
  const [submissionError, setSubmissionError] = useState(null);
  const [lastSubmissionTime, setLastSubmissionTime] = useState(null);

  // Get active wallet
  const activeWallet = connectors && connectors.length > 0 ? connectors[0] : null;

  // Reset submission state
  const resetSubmissionState = useCallback(() => {
    setIsSubmitting(false);
    setSubmissionStep(null);
    setSubmissionError(null);
  }, []);

  // Handle submission step updates
  const updateSubmissionStep = useCallback((step) => {
    setSubmissionStep(step);
    console.log('Submission step:', step);
  }, []);

  // Validate prerequisites for submission
  const validatePrerequisites = useCallback(() => {
    if (!authenticated) {
      throw new Error('Please connect your wallet first');
    }

    if (!user?.wallet?.address) {
      throw new Error('Wallet address not found');
    }

    if (!activeWallet) {
      throw new Error('No active wallet found');
    }

    if (!privyRaffle) {
      throw new Error('Raffle service not available');
    }

    return true;
  }, [authenticated, user, activeWallet, privyRaffle]);

  // Submit raffle with full flow
  const submitRaffle = useCallback(async (formData) => {
    console.log('=== DEBUG: Starting Privy raffle creation ===');
    console.log('Form data:', formData);
    console.log('Selected asset:', formData.selectedAsset);
    console.log('Prize type:', formData.prizeType);

    // Reset previous state
    resetSubmissionState();
    setIsSubmitting(true);
    setLastSubmissionTime(Date.now());

    try {
      // Step 1: Validate prerequisites
      updateSubmissionStep('Validating prerequisites...');
      validatePrerequisites();

      // Step 2: Validate form data
      updateSubmissionStep('Validating form data...');
      const validation = validateForm(formData);
      if (!validation.isValid) {
        console.log('=== DEBUG: Form validation failed ===');
        console.log('Errors:', validation.errors);
        throw new Error('Please fix the form errors before submitting');
      }

      console.log('=== DEBUG: Form validation passed ===');

      // Step 3: Prepare submission data
      updateSubmissionStep('Preparing transaction...');
      const submissionData = prepareSubmissionData(formData);
      console.log('Prepared submission data:', submissionData);

      // Step 4: Use Privy raffle hook to create raffle
      updateSubmissionStep('Creating raffle transaction...');
      const result = await privyRaffle.createRaffle(formData);

      if (!result || !result.success) {
        throw new Error(result?.error || 'Raffle creation failed');
      }

      console.log('=== DEBUG: Privy raffle creation successful ===');
      console.log('Result:', result);

      // Step 5: Success handling
      updateSubmissionStep('Finalizing...');
      
      // Call success callback
      if (onSuccess) {
        onSuccess(result);
      }

      // Reset Privy raffle state
      if (privyRaffle.reset) {
        privyRaffle.reset();
      }

      console.log('=== DEBUG: Raffle creation completed successfully ===');
      
      return {
        success: true,
        result,
        submissionData
      };

    } catch (error) {
      console.error('=== DEBUG: Error in raffle submission ===', error);
      
      const errorMessage = error.message || ERROR_CONFIG.submission.unknown;
      setSubmissionError(errorMessage);
      
      // Call error callback
      if (onError) {
        onError(error);
      }

      return {
        success: false,
        error: errorMessage,
        originalError: error
      };
    } finally {
      setIsSubmitting(false);
      setSubmissionStep(null);
    }
  }, [
    validatePrerequisites,
    updateSubmissionStep,
    resetSubmissionState,
    privyRaffle,
    onSuccess,
    onError
  ]);

  // Quick submit with automatic validation
  const quickSubmit = useCallback(async (formData) => {
    // Auto-validate before submission
    const validation = validateForm(formData);
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      throw new Error(firstError || 'Form validation failed');
    }

    return await submitRaffle(formData);
  }, [submitRaffle]);

  // Cancel submission (if possible)
  const cancelSubmission = useCallback(() => {
    if (isSubmitting && !submissionStep?.includes('transaction')) {
      resetSubmissionState();
      console.log('Submission cancelled by user');
      return true;
    }
    return false; // Cannot cancel during transaction
  }, [isSubmitting, submissionStep, resetSubmissionState]);

  // Retry last submission
  const retrySubmission = useCallback(async (formData) => {
    if (isSubmitting) {
      throw new Error('Submission already in progress');
    }

    setSubmissionError(null);
    return await submitRaffle(formData);
  }, [isSubmitting, submitRaffle]);

  // Get submission status
  const getSubmissionStatus = useCallback(() => {
    if (isSubmitting) {
      return {
        status: 'submitting',
        step: submissionStep,
        canCancel: !submissionStep?.includes('transaction')
      };
    }

    if (submissionError) {
      return {
        status: 'error',
        error: submissionError,
        canRetry: true
      };
    }

    return {
      status: 'idle',
      canSubmit: true
    };
  }, [isSubmitting, submissionStep, submissionError]);

  // Check if can submit
  const canSubmit = useCallback(() => {
    try {
      validatePrerequisites();
      return !isSubmitting && !privyRaffle?.loading;
    } catch {
      return false;
    }
  }, [validatePrerequisites, isSubmitting, privyRaffle]);

  // Get submission progress
  const getSubmissionProgress = useCallback(() => {
    if (!isSubmitting) return 0;

    const steps = LOADING_CONFIG.submission.steps;
    const currentStepIndex = steps.findIndex(step => 
      submissionStep?.toLowerCase().includes(step.toLowerCase().split(' ')[0])
    );

    if (currentStepIndex === -1) return 0;
    
    return Math.round(((currentStepIndex + 1) / steps.length) * 100);
  }, [isSubmitting, submissionStep]);

  // Clear error
  const clearSubmissionError = useCallback(() => {
    setSubmissionError(null);
  }, []);

  return {
    // State
    isSubmitting,
    submissionStep,
    submissionError,
    lastSubmissionTime,
    
    // Computed state
    canSubmit: canSubmit(),
    submissionStatus: getSubmissionStatus(),
    submissionProgress: getSubmissionProgress(),
    
    // Actions
    submitRaffle,
    quickSubmit,
    cancelSubmission,
    retrySubmission,
    
    // State management
    resetSubmissionState,
    clearSubmissionError,
    
    // Utilities
    validatePrerequisites,
    getSubmissionStatus,
    
    // Privy integration status
    isPrivyReady: Boolean(privyRaffle && authenticated && activeWallet),
    privyLoading: privyRaffle?.loading || false,
    userAddress: user?.wallet?.address || null
  };
}; 