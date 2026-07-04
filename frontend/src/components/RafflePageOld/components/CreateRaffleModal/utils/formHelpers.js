import { INITIAL_FORM_DATA } from '../data/formConfig';
import { PRIZE_TYPES } from '../../../utils/constants';

/**
 * Handle input field changes with type conversion
 * @param {Object} formData - Current form data
 * @param {string} field - Field name to update
 * @param {any} value - New value
 * @returns {Object} Updated form data
 */
export const handleInputChange = (formData, field, value) => {
  return {
    ...formData,
    [field]: value
  };
};

/**
 * Handle asset selection
 * @param {Object} formData - Current form data
 * @param {Object} asset - Selected asset
 * @returns {Object} Updated form data
 */
export const handleAssetSelect = (formData, asset) => {
  return {
    ...formData,
    selectedAsset: asset
  };
};

/**
 * Handle duration selection from presets
 * @param {Object} formData - Current form data
 * @param {number} hours - Duration in hours
 * @returns {Object} Updated form data
 */
export const handleDurationSelect = (formData, hours) => {
  return {
    ...formData,
    duration: hours,
    useCustomDuration: false,
    customDuration: ''
  };
};

/**
 * Handle prize type change with form reset
 * @param {Object} formData - Current form data
 * @param {string} newPrizeType - New prize type
 * @returns {Object} Updated form data
 */
export const handlePrizeTypeChange = (formData, newPrizeType) => {
  return {
    ...INITIAL_FORM_DATA,
    prizeType: newPrizeType
  };
};

/**
 * Clear form errors for a specific field
 * @param {Object} errors - Current errors
 * @param {string} field - Field to clear error for
 * @returns {Object} Updated errors
 */
export const clearFieldError = (errors, field) => {
  const newErrors = { ...errors };
  delete newErrors[field];
  return newErrors;
};

/**
 * Reset form to initial state
 * @param {string} prizeType - Prize type to reset to (optional)
 * @returns {Object} Reset form data
 */
export const resetForm = (prizeType = PRIZE_TYPES.TOKEN) => {
  return {
    ...INITIAL_FORM_DATA,
    prizeType
  };
};

/**
 * Get final duration value (considers custom duration flag)
 * @param {Object} formData - Form data
 * @returns {number} Final duration in hours
 */
export const getFinalDuration = (formData) => {
  if (formData.useCustomDuration) {
    const customDuration = parseInt(formData.customDuration) || 0;
    const unit = formData.customDurationUnit || 'hours';
    
    console.log('🔍 getFinalDuration debug:', {
      customDuration,
      unit,
      formData: formData
    });
    
    // Convert minutes to hours
    const result = unit === 'minutes' ? customDuration / 60 : customDuration;
    console.log('🔍 getFinalDuration result:', result);
    return result;
  }
  
  console.log('🔍 getFinalDuration preset:', formData.duration);
  return formData.duration;
};

/**
 * Prepare form data for submission
 * @param {Object} formData - Form data to prepare
 * @returns {Object} Prepared data for API submission
 */
export const prepareSubmissionData = (formData) => {
  const finalDuration = getFinalDuration(formData);
  
  // Generate meaningful title and description based on raffle content
  const generateTitle = () => {
    if (formData.prizeType === PRIZE_TYPES.TOKEN) {
      return `${formData.prizeAmount} MON Token Raffle`;
    } else if (formData.selectedAsset?.name) {
      return `${formData.selectedAsset.name} NFT Raffle`;
    }
    return 'NFT Raffle';
  };

  const generateDescription = () => {
    if (formData.prizeType === PRIZE_TYPES.TOKEN) {
      return `Win ${formData.prizeAmount} MON tokens! Ticket price: ${formData.ticketPrice} MON. Max ${formData.maxTicketsPerWallet} tickets per wallet.`;
    } else if (formData.selectedAsset) {
      return `Win this exclusive NFT! Ticket price: ${formData.ticketPrice} MON. Max ${formData.maxTicketsPerWallet} tickets per wallet.`;
    }
    return `Exciting NFT raffle! Ticket price: ${formData.ticketPrice} MON.`;
  };

  const submissionData = {
    title: generateTitle(),
    description: generateDescription(),
    prizeType: formData.prizeType,
    ticketPrice: parseFloat(formData.ticketPrice),
    maxTicketsPerWallet: parseInt(formData.maxTicketsPerWallet),
    duration: finalDuration,
    endTime: new Date(Date.now() + finalDuration * 60 * 60 * 1000).toISOString()
  };

  // Add prize-specific data
  if (formData.prizeType === PRIZE_TYPES.TOKEN) {
    submissionData.prize = {
      type: 'token',
      contractAddress: 'native', // Native MON token
      amount: parseFloat(formData.prizeAmount),
      symbol: 'MON',
      decimals: 18
    };
  } else {
    submissionData.prize = {
      type: 'nft',
      contractAddress: formData.selectedAsset.contractAddress,
      tokenId: formData.selectedAsset.tokenId,
      name: formData.selectedAsset.name,
      image: formData.selectedAsset.image
    };
  }

  return submissionData;
};

/**
 * Check if form is ready for submission
 * @param {Object} formData - Form data to check
 * @returns {boolean} Whether form is ready
 */
export const isFormReady = (formData) => {
  // Title and description are auto-generated, so not required for form readiness
  const requiredFields = [
    'prizeType',
    'ticketPrice',
    'maxTicketsPerWallet',
    'duration'
  ];

  // Add selectedAsset only for NFT type
  if (formData.prizeType === PRIZE_TYPES.NFT) {
    requiredFields.push('selectedAsset');
  }

  // Add prize amount for tokens
  if (formData.prizeType === PRIZE_TYPES.TOKEN) {
    requiredFields.push('prizeAmount');
  }

  // Check all required fields are filled
  const hasAllFields = requiredFields.every(field => {
    const value = formData[field];
    return value !== null && value !== undefined && value !== '';
  });

  // Check duration is valid
  const finalDuration = getFinalDuration(formData);
  const hasValidDuration = finalDuration && finalDuration > 0;

  return hasAllFields && hasValidDuration;
};

/**
 * Get form summary for preview
 * @param {Object} formData - Form data
 * @returns {Object} Summary object
 */
export const getFormSummary = (formData) => {
  const finalDuration = getFinalDuration(formData);
  
  // For TOKEN raffle, create a mock asset object
  let asset = formData.selectedAsset;
  if (formData.prizeType === PRIZE_TYPES.TOKEN) {
    asset = {
      name: 'Monad',
      symbol: 'MON',
      decimals: 18,
      address: 'native',
      isNative: true
    };
  }
  
  return {
    title: formData.title,
    description: formData.description,
    prizeType: formData.prizeType,
    asset: asset,
    prizeAmount: formData.prizeType === PRIZE_TYPES.TOKEN ? formData.prizeAmount : null,
    ticketPrice: formData.ticketPrice,
    maxTicketsPerWallet: formData.maxTicketsPerWallet,
    duration: finalDuration,
    durationText: formatDuration(finalDuration),
    endTime: new Date(Date.now() + finalDuration * 60 * 60 * 1000)
  };
};

/**
 * Format duration for display
 * @param {number} hours - Duration in hours
 * @returns {string} Formatted duration string
 */
export const formatDuration = (hours) => {
  if (!hours || hours < 1) {
    return '0 hours';
  }

  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  if (hours < 168) { // Less than a week
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    let result = `${days} day${days !== 1 ? 's' : ''}`;
    if (remainingHours > 0) {
      result += ` ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
    }
    return result;
  }

  if (hours < 720) { // Less than a month
    const weeks = Math.floor(hours / 168);
    const remainingDays = Math.floor((hours % 168) / 24);
    
    let result = `${weeks} week${weeks !== 1 ? 's' : ''}`;
    if (remainingDays > 0) {
      result += ` ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
    }
    return result;
  }

  // More than a month
  const months = Math.floor(hours / 720);
  const remainingWeeks = Math.floor((hours % 720) / 168);
  
  let result = `${months} month${months !== 1 ? 's' : ''}`;
  if (remainingWeeks > 0) {
    result += ` ${remainingWeeks} week${remainingWeeks !== 1 ? 's' : ''}`;
  }
  return result;
};

/**
 * Scroll modal content to top
 */
export const scrollModalToTop = () => {
  const modalContent = document.querySelector('[data-modal-content]');
  if (modalContent) {
    modalContent.scrollTop = 0;
  }
};

/**
 * Trigger modal close animation
 * @param {Function} onClose - Close callback
 */
export const triggerCloseAnimation = (onClose) => {
  const modalContent = document.querySelector('[data-modal-content]');
  if (modalContent) {
    modalContent.style.animation = 'slideOutToRight 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards';
    setTimeout(() => {
      onClose();
    }, 300);
  } else {
    onClose();
  }
}; 