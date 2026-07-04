import { useState, useCallback } from 'react';
import { INITIAL_FORM_DATA } from '../data/formConfig';
import { 
  handleInputChange, 
  handleAssetSelect, 
  handleDurationSelect, 
  handlePrizeTypeChange,
  clearFieldError,
  resetForm,
  getFormSummary as getFormSummaryHelper
} from '../utils/formHelpers';
import { validateRealTime } from '../utils/formValidator';

/**
 * Custom hook for managing Create Raffle form state
 * @returns {Object} Form state and handlers
 */
export const useCreateRaffleForm = () => {
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState({});

  // Handle input changes with real-time validation
  const updateField = useCallback((field, value) => {
    const newFormData = handleInputChange(formData, field, value);
    setFormData(newFormData);
    
    // Clear error for this field and run real-time validation
    const newErrors = validateRealTime(newFormData, errors, field);
    setErrors(newErrors);
  }, [formData, errors]);

  // Handle asset selection
  const selectAsset = useCallback((asset) => {
    const newFormData = handleAssetSelect(formData, asset);
    setFormData(newFormData);
    
    // Clear asset-related errors
    const newErrors = validateRealTime(newFormData, errors, 'selectedAsset');
    setErrors(newErrors);
  }, [formData, errors]);

  // Handle duration selection
  const selectDuration = useCallback((hours) => {
    const newFormData = handleDurationSelect(formData, hours);
    setFormData(newFormData);
    
    // Clear duration errors
    const newErrors = clearFieldError(errors, 'duration');
    setErrors(newErrors);
  }, [formData, errors]);

  // Handle prize type change
  const changePrizeType = useCallback((newPrizeType) => {
    const newFormData = handlePrizeTypeChange(formData, newPrizeType);
    setFormData(newFormData);
    
    // Clear all errors when changing prize type
    setErrors({});
  }, [formData]);

  // Clear specific field error
  const clearError = useCallback((field) => {
    const newErrors = clearFieldError(errors, field);
    setErrors(newErrors);
  }, [errors]);

  // Reset entire form
  const resetFormData = useCallback((prizeType) => {
    const newFormData = resetForm(prizeType);
    setFormData(newFormData);
    setErrors({});
  }, []);

  // Reset form (alias for resetFormData)
  const resetFormAlias = useCallback((prizeType) => {
    const newFormData = resetForm(prizeType);
    setFormData(newFormData);
    setErrors({});
  }, []);

  // Set form errors (for validation results)
  const setFormErrors = useCallback((newErrors) => {
    setErrors(newErrors);
  }, []);

  // Bulk update form data
  const updateFormData = useCallback((updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // Update multiple fields (alias for updateFormData)
  const updateMultipleFields = useCallback((updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // Get current form values
  const getFormData = useCallback(() => formData, [formData]);
  const getErrors = useCallback(() => errors, [errors]);
  
  // Get form summary
  const getFormSummary = useCallback(() => {
    return getFormSummaryHelper(formData);
  }, [formData]);

  return {
    // State
    formData,
    errors,
    
    // Handlers
    updateField,
    updateMultipleFields,
    selectAsset,
    selectDuration,
    changePrizeType,
    clearError,
    resetForm: resetFormAlias,
    resetFormData,
    setFormErrors,
    updateFormData,
    
    // Getters
    getFormData,
    getErrors,
    getFormSummary
  };
}; 