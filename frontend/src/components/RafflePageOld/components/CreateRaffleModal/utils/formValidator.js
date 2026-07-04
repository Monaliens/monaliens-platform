import { FORM_FIELDS, VALIDATION_RULES } from '../data/formConfig';
import { PRIZE_TYPES } from '../../../utils/constants';

/**
 * Comprehensive form validation
 * @param {Object} formData - Form data to validate
 * @returns {Object} Validation result with errors and isValid flag
 */
export const validateForm = (formData) => {
  const errors = {};

  // Title validation - REMOVED (using mock data)
  // const titleError = VALIDATION_RULES.validateText(
  //   formData.title, 
  //   FORM_FIELDS.title.validation
  // );
  // if (titleError) {
  //   errors.title = titleError;
  // }

  // Description validation - REMOVED (using mock data)
  // const descriptionError = VALIDATION_RULES.validateText(
  //   formData.description, 
  //   FORM_FIELDS.description.validation
  // );
  // if (descriptionError) {
  //   errors.description = descriptionError;
  // }

  // Asset selection validation
  const assetError = VALIDATION_RULES.validateAsset(
    formData.selectedAsset, 
    formData.prizeType
  );
  if (assetError) {
    errors.selectedAsset = assetError;
  }

  // Prize amount validation (only for tokens)
  if (formData.prizeType === PRIZE_TYPES.TOKEN) {
    if (!formData.prizeAmount || formData.prizeAmount.trim() === '') {
      errors.prizeAmount = 'Prize amount is required';
    } else {
      const prizeAmountError = VALIDATION_RULES.validateNumber(
        formData.prizeAmount, 
        FORM_FIELDS.prizeAmount.validation
      );
      if (prizeAmountError) {
        errors.prizeAmount = prizeAmountError;
      } else {
        // Additional validation for token amounts
        const amount = parseFloat(formData.prizeAmount);
        if (isNaN(amount) || amount <= 0) {
          errors.prizeAmount = 'Prize amount must be a positive number';
        } else if (amount < 0.000001) {
          errors.prizeAmount = 'Minimum prize amount is 0.000001 MON';
        } else {
          // Check balance if amount is valid
          const balanceError = VALIDATION_RULES.validateBalance(
            formData.prizeAmount, 
            formData.selectedAsset
          );
          if (balanceError) {
            errors.prizeAmount = balanceError;
          }
        }
      }
    }
  }

  // Ticket price validation
  const ticketPriceError = VALIDATION_RULES.validateNumber(
    formData.ticketPrice, 
    FORM_FIELDS.ticketPrice.validation,
    formData
  );
  if (ticketPriceError) {
    errors.ticketPrice = ticketPriceError;
  }

  // Max total tickets validation
  const maxTotalTicketsError = VALIDATION_RULES.validateNumber(
    formData.maxTotalTickets, 
    FORM_FIELDS.maxTotalTickets.validation,
    formData
  );
  if (maxTotalTicketsError) {
    errors.maxTotalTickets = maxTotalTicketsError;
  }

  // Max tickets per wallet validation (with 40% rule)
  const maxTicketsError = VALIDATION_RULES.validateNumber(
    formData.maxTicketsPerWallet, 
    FORM_FIELDS.maxTicketsPerWallet.validation,
    formData
  );
  if (maxTicketsError) {
    errors.maxTicketsPerWallet = maxTicketsError;
  }

  // Duration validation
  const durationError = validateDuration(formData);
  if (durationError) {
    errors.duration = durationError;
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

/**
 * Validate duration field (handles both preset and custom duration)
 * @param {Object} formData - Form data containing duration fields
 * @returns {string|null} Error message or null if valid
 */
export const validateDuration = (formData) => {
  // If using custom duration, validate custom field
  if (formData.useCustomDuration) {
    const customDuration = parseInt(formData.customDuration);
    const unit = formData.customDurationUnit || 'hours';
    
    if (!formData.customDuration || isNaN(customDuration) || customDuration < 1) {
      return unit === 'minutes' ? 'Duration must be at least 1 minute' : 'Duration must be at least 10 minutes';
    }
    
    // Convert to minutes for validation
    const durationInMinutes = unit === 'minutes' ? customDuration : customDuration * 60;
    
    if (durationInMinutes < 10) {
      return 'Duration must be at least 10 minutes';
    }
    
    const durationInHours = durationInMinutes / 60;
    if (durationInHours > 8760) { // 1 year in hours
      return 'Duration cannot exceed 1 year';
    }
    return null;
  }
  
  // If using preset duration, validate duration field
  const duration = formData.duration;
  if (!duration || isNaN(duration) || duration < 1) {
    return 'Please select a duration';
  }
  if (duration > 8760) { // 1 year in hours
    return 'Duration cannot exceed 1 year';
  }
  return null;
};

/**
 * Validate a single field
 * @param {string} fieldName - Name of the field to validate
 * @param {any} value - Value to validate
 * @param {Object} formData - Complete form data for context
 * @returns {string|null} Error message or null if valid
 */
export const validateField = (fieldName, value, formData) => {
  const fieldConfig = FORM_FIELDS[fieldName];
  
  if (!fieldConfig) {
    return null;
  }

  // Handle special cases
  switch (fieldName) {
    case 'title':
    case 'description':
      // Skip validation for title and description (using mock data)
      return null;
      
    case 'selectedAsset':
      return VALIDATION_RULES.validateAsset(value, formData.prizeType);
    
    case 'prizeAmount':
      if (formData.prizeType !== PRIZE_TYPES.TOKEN) {
        return null; // Not applicable for NFTs
      }
      const amountError = VALIDATION_RULES.validateNumber(value, fieldConfig.validation);
      if (amountError) return amountError;
      return VALIDATION_RULES.validateBalance(value, formData.selectedAsset);
    
    case 'duration':
    case 'customDuration':
      return validateDuration(formData);
    
    default:
      // Use appropriate validation based on field type
      if (fieldConfig.type === 'number') {
        return VALIDATION_RULES.validateNumber(value, fieldConfig.validation, formData);
      } else {
        return VALIDATION_RULES.validateText(value, fieldConfig.validation);
      }
  }
};

/**
 * Check if a specific field should be shown based on current form state
 * @param {string} fieldName - Name of the field
 * @param {Object} formData - Current form data
 * @returns {boolean} Whether the field should be shown
 */
export const shouldShowField = (fieldName, formData) => {
  const fieldConfig = FORM_FIELDS[fieldName];
  
  if (!fieldConfig || !fieldConfig.showFor) {
    return true; // Show by default if no conditions
  }

  return fieldConfig.showFor.includes(formData.prizeType);
};

/**
 * Get validation errors for display
 * @param {Object} errors - Validation errors object
 * @param {string} fieldName - Field name to get error for
 * @returns {string|null} Error message or null
 */
export const getFieldError = (errors, fieldName) => {
  return errors[fieldName] || null;
};

/**
 * Check if form has any errors
 * @param {Object} errors - Validation errors object
 * @returns {boolean} Whether form has errors
 */
export const hasErrors = (errors) => {
  return Object.keys(errors).length > 0;
};

/**
 * Get all error messages as an array
 * @param {Object} errors - Validation errors object
 * @returns {Array<string>} Array of error messages
 */
export const getErrorMessages = (errors) => {
  return Object.values(errors).filter(Boolean);
};

/**
 * Real-time validation for form fields
 * @param {Object} formData - Current form data
 * @param {Object} previousErrors - Previous validation errors
 * @param {string} changedField - Field that was just changed
 * @returns {Object} Updated errors object
 */
export const validateRealTime = (formData, previousErrors, changedField) => {
  const newErrors = { ...previousErrors };

  // Validate the changed field
  const fieldError = validateField(changedField, formData[changedField], formData);
  
  if (fieldError) {
    newErrors[changedField] = fieldError;
  } else {
    // Clear error if field is now valid
    delete newErrors[changedField];
  }

  // Handle dependent validations
  if (changedField === 'selectedAsset' && formData.prizeType === PRIZE_TYPES.TOKEN) {
    // Re-validate prize amount when asset changes
    const prizeAmountError = validateField('prizeAmount', formData.prizeAmount, formData);
    if (prizeAmountError) {
      newErrors.prizeAmount = prizeAmountError;
    } else {
      delete newErrors.prizeAmount;
    }
  }

  // Re-validate maxTicketsPerWallet when maxTotalTickets changes
  if (changedField === 'maxTotalTickets') {
    const maxTicketsError = validateField('maxTicketsPerWallet', formData.maxTicketsPerWallet, formData);
    if (maxTicketsError) {
      newErrors.maxTicketsPerWallet = maxTicketsError;
    } else {
      delete newErrors.maxTicketsPerWallet;
    }
  }

  if (changedField === 'useCustomDuration') {
    // Clear duration errors when switching between preset/custom
    delete newErrors.duration;
  }

  if (changedField === 'prizeType') {
    // Clear asset and prize amount errors when changing prize type
    delete newErrors.selectedAsset;
    delete newErrors.prizeAmount;
  }

  return newErrors;
};

/**
 * Get form completion percentage
 * @param {Object} formData - Current form data
 * @returns {number} Completion percentage (0-100)
 */
export const getFormCompletionPercentage = (formData) => {
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

  // Add prizeAmount for tokens
  if (formData.prizeType === PRIZE_TYPES.TOKEN) {
    requiredFields.push('prizeAmount');
  }

  const completedFields = requiredFields.filter(field => {
    const value = formData[field];
    
    // Special handling for duration field
    if (field === 'duration') {
      // If using custom duration, check if custom duration is filled
      if (formData.useCustomDuration) {
        return formData.customDuration && formData.customDuration !== '';
      } else {
        // If using preset duration, check duration field
        return value !== null && value !== undefined && value !== '';
      }
    }
    
    return value !== null && value !== undefined && value !== '';
  });

  return Math.round((completedFields.length / requiredFields.length) * 100);
};

// Balance validation for tokens
VALIDATION_RULES.validateBalance = (amount, asset, externalBalance = null) => {
  // TOKEN durumunda external balance kullan
  let availableBalance;
  let symbol = 'MON';
  
  if (externalBalance !== null) {
    availableBalance = parseFloat(externalBalance);
  } else if (asset && asset.balance) {
    availableBalance = parseFloat(asset.balance.replace(/,/g, ''));
    symbol = asset.symbol || 'MON';
  } else {
    return null; // Balance bilgisi yok
  }
  
  const requestedAmount = parseFloat(amount);
  
  if (isNaN(requestedAmount) || requestedAmount <= 0) {
    return null; // Amount validation başka yerde yapılır
  }
  
  // Balance'ın %98'inden fazla girilemez (2% güvenlik marjı)
  const maxAllowed = availableBalance * 0.98;
  
  if (requestedAmount > maxAllowed) {
    return `Prize amount cannot exceed 98% of your balance (Max: ${maxAllowed.toFixed(6)} ${symbol})`;
  }
  
  if (requestedAmount > availableBalance) {
    return `Prize amount cannot exceed your balance (${availableBalance.toFixed(6)} ${symbol})`;
  }
  
  return null;
} 