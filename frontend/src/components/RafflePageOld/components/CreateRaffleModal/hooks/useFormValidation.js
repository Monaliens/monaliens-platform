import { useState, useCallback, useMemo } from 'react';
import { 
  validateForm, 
  validateField, 
  shouldShowField, 
  getFieldError, 
  hasErrors, 
  getErrorMessages,
  getFormCompletionPercentage
} from '../utils/formValidator';
import { PRIZE_TYPES } from '../../../utils/constants';
import { scrollToError } from '../utils/modalHelpers';

/**
 * Custom hook for form validation orchestration
 * @param {Object} formData - Current form data
 * @param {Object} errors - Current validation errors
 * @param {Function} setErrors - Function to update errors
 * @returns {Object} Validation state and handlers
 */
export const useFormValidation = (formData, errors, setErrors) => {
  const [isValidating, setIsValidating] = useState(false);
  const [lastValidationTime, setLastValidationTime] = useState(null);

  // Validate entire form
  const validateEntireForm = useCallback(async () => {
    setIsValidating(true);
    
    try {
      const validation = validateForm(formData);
      setErrors(validation.errors);
      setLastValidationTime(Date.now());
      
      // Scroll to first error if validation fails
      if (!validation.isValid) {
        const firstErrorField = Object.keys(validation.errors)[0];
        if (firstErrorField) {
          setTimeout(() => scrollToError(firstErrorField), 100);
        }
      }
      
      return validation;
    } finally {
      setIsValidating(false);
    }
  }, [formData, setErrors]);

  // Validate single field
  const validateSingleField = useCallback((fieldName, value = null) => {
    const fieldValue = value !== null ? value : formData[fieldName];
    const error = validateField(fieldName, fieldValue, formData);
    
    // Update errors for this field
    const newErrors = { ...errors };
    if (error) {
      newErrors[fieldName] = error;
    } else {
      delete newErrors[fieldName];
    }
    
    setErrors(newErrors);
    return !error;
  }, [formData, errors, setErrors]);

  // Check if field should be visible
  const isFieldVisible = useCallback((fieldName) => {
    return shouldShowField(fieldName, formData);
  }, [formData]);

  // Get error for specific field
  const getError = useCallback((fieldName) => {
    return getFieldError(errors, fieldName);
  }, [errors]);

  // Check if specific field has error
  const hasFieldError = useCallback((fieldName) => {
    return Boolean(getError(fieldName));
  }, [getError]);

  // Clear error for specific field
  const clearFieldError = useCallback((fieldName) => {
    if (errors[fieldName]) {
      const newErrors = { ...errors };
      delete newErrors[fieldName];
      setErrors(newErrors);
    }
  }, [errors, setErrors]);

  // Clear all errors
  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, [setErrors]);

  // Get validation summary
  const getValidationSummary = useCallback(() => {
    const errorMessages = getErrorMessages(errors);
    const totalFields = Object.keys(formData).length;
    const fieldsWithErrors = Object.keys(errors).length;
    const completionPercentage = getFormCompletionPercentage(formData);
    
    return {
      isValid: !hasErrors(errors),
      totalErrors: fieldsWithErrors,
      errorMessages,
      totalFields,
      fieldsWithErrors,
      completionPercentage,
      canSubmit: !hasErrors(errors) && completionPercentage === 100
    };
  }, [errors, formData]);

  // Validate on field change with debouncing
  const validateFieldOnChange = useCallback((fieldName, value) => {
    // Clear existing timeout for this field
    clearTimeout(window[`validation_timeout_${fieldName}`]);
    
    // Set new timeout for validation
    window[`validation_timeout_${fieldName}`] = setTimeout(() => {
      validateSingleField(fieldName, value);
    }, 300); // 300ms debounce
  }, [validateSingleField]);

  // Validate required fields only
  const validateRequiredFields = useCallback(() => {
    const requiredFields = [
      // 'title',        // REMOVED - using mock data
      // 'description',  // REMOVED - using mock data
      'ticketPrice',
      'maxTotalTickets',
      'maxTicketsPerWallet',
      'duration'
    ];
    
    // Add selectedAsset only for NFT type
    if (formData.prizeType === PRIZE_TYPES.NFT) {
      requiredFields.push('selectedAsset');
    }
    
    // Add prize amount for TOKEN type
    if (formData.prizeType === PRIZE_TYPES.TOKEN) {
      requiredFields.push('prizeAmount');
    }
    
    const requiredErrors = {};
    let hasRequiredErrors = false;
    
    requiredFields.forEach(field => {
      const error = validateField(field, formData[field], formData);
      if (error) {
        requiredErrors[field] = error;
        hasRequiredErrors = true;
      }
    });
    
    return {
      isValid: !hasRequiredErrors,
      errors: requiredErrors,
      missingFields: Object.keys(requiredErrors)
    };
  }, [formData]);

  // Check if form is ready for submission
  const isFormReady = useCallback(() => {
    const validation = validateRequiredFields();
    const summary = getValidationSummary();
    
    console.log('🔍 isFormReady debug:', {
      validation,
      summary,
      result: validation.isValid && summary.canSubmit
    });
    
    return validation.isValid && summary.canSubmit;
  }, [validateRequiredFields, getValidationSummary]);

  // Get validation warnings (non-blocking issues)
  const getValidationWarnings = useCallback(() => {
    const warnings = [];
    
    // Check for potential issues that don't block submission
    // Title and description warnings REMOVED - using mock data
    // if (formData.title && formData.title.length < 5) {
    //   warnings.push('Title is quite short - consider adding more detail');
    // }
    
    // if (formData.description && formData.description.length < 20) {
    //   warnings.push('Description is short - provide more details to attract participants');
    // }
    
    if (formData.prizeType === 'token' && formData.prizeAmount) {
      const amount = parseFloat(formData.prizeAmount);
      if (amount < 0.01) {
        warnings.push('Prize amount is very small - consider offering more to attract participants');
      }
    }
    
    if (formData.ticketPrice) {
      const price = parseFloat(formData.ticketPrice);
      if (price > 10) {
        warnings.push('Ticket price is quite high - this might reduce participation');
      }
    }
    
    return warnings;
  }, [formData]);

  // Validate and highlight errors
  const validateAndHighlight = useCallback(async () => {
    const validation = await validateEntireForm();
    
    if (!validation.isValid) {
      // Add visual highlight to error fields
      Object.keys(validation.errors).forEach(fieldName => {
        const field = document.querySelector(`[name="${fieldName}"], [data-field="${fieldName}"]`);
        if (field) {
          field.classList.add('validation-error');
          setTimeout(() => {
            field.classList.remove('validation-error');
          }, 3000);
        }
      });
    }
    
    return validation;
  }, [validateEntireForm]);

  // Memoized computed values
  const computedValues = useMemo(() => {
    const summary = getValidationSummary();
    const warnings = getValidationWarnings();
    const requiredValidation = validateRequiredFields();
    
    return {
      isValid: summary.isValid,
      canSubmit: summary.canSubmit,
      hasAnyErrors: summary.totalErrors > 0,
      completionPercentage: summary.completionPercentage,
      errorCount: summary.totalErrors,
      warningCount: warnings.length,
      isFormComplete: summary.completionPercentage === 100,
      hasRequiredErrors: !requiredValidation.isValid,
      missingRequiredFields: requiredValidation.missingFields
    };
  }, [getValidationSummary, getValidationWarnings, validateRequiredFields]);

  return {
    // State
    isValidating,
    lastValidationTime,
    errors,
    
    // Validation actions
    validateEntireForm,
    validateSingleField,
    validateFieldOnChange,
    validateAndHighlight,
    
    // Field utilities
    isFieldVisible,
    getError,
    hasFieldError,
    clearFieldError,
    clearAllErrors,
    
    // Validation checks
    validateRequiredFields,
    isFormReady,
    
    // Information getters
    getValidationSummary,
    getValidationWarnings,
    
    // Computed values
    ...computedValues
  };
}; 