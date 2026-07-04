import React from 'react';
import styled from 'styled-components';
import { COLOR_CONFIG, INPUT_CONFIG, MODAL_CONFIG } from '../data/modalConfig';
import { FORM_FIELDS } from '../data/formConfig';

const Container = styled.div`
  margin-bottom: ${MODAL_CONFIG.spacing.section}px;
`;

const SectionTitle = styled.h3`
  font-family: 'Lexend', sans-serif;
  margin: 0 0 16px 0;
  color: ${COLOR_CONFIG.text.primary};
  font-size: 18px;
  font-weight: 600;
`;

const FormGroup = styled.div`
  font-family: 'Lexend', sans-serif;
  margin-bottom: 20px;
  
  label {
    display: block;
    margin-bottom: 8px;
    color: ${COLOR_CONFIG.text.primary};
    font-size: 14px;
    font-weight: 600;
    
    .required {
      color: ${COLOR_CONFIG.text.error};
      margin-left: 4px;
    }
  }
`;

const Input = styled.input`
  font-family: 'Lexend', sans-serif;
  width: 100%;
  padding: ${INPUT_CONFIG.padding};
  border: ${INPUT_CONFIG.borderWidth}px solid ${props => props.$hasError ? COLOR_CONFIG.border.error : COLOR_CONFIG.border.default};
  border-radius: ${MODAL_CONFIG.borderRadius.input}px;
  font-size: ${INPUT_CONFIG.fontSize}px;
  background: ${COLOR_CONFIG.background.white};
  transition: all 0.2s ease;
  box-sizing: border-box;
  
  &:focus {
    outline: none;
    border-color: ${COLOR_CONFIG.border.focus};
    box-shadow: 0 0 0 3px rgba(105, 48, 195, 0.1);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: ${COLOR_CONFIG.background.muted};
  }
  
  &::placeholder {
    color: ${COLOR_CONFIG.text.muted};
  }
  
  /* Prevent mouse wheel from changing number inputs */
  &[type="number"] {
    -moz-appearance: textfield;
    
    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  }
`;

const TextArea = styled.textarea`
  font-family: 'Lexend', sans-serif;
  width: 100%;
  padding: ${INPUT_CONFIG.padding};
  border: ${INPUT_CONFIG.borderWidth}px solid ${props => props.$hasError ? COLOR_CONFIG.border.error : COLOR_CONFIG.border.default};
  border-radius: ${MODAL_CONFIG.borderRadius.input}px;
  font-size: ${INPUT_CONFIG.fontSize}px;
  background: ${COLOR_CONFIG.background.white};
  transition: all 0.2s ease;
  min-height: ${INPUT_CONFIG.textarea.minHeight}px;
  resize: ${INPUT_CONFIG.textarea.resize};
  box-sizing: border-box;
  
  &:focus {
    outline: none;
    border-color: ${COLOR_CONFIG.border.focus};
    box-shadow: 0 0 0 3px rgba(105, 48, 195, 0.1);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: ${COLOR_CONFIG.background.muted};
  }
  
  &::placeholder {
    color: ${COLOR_CONFIG.text.muted};
  }
`;

const ErrorText = styled.div`
  font-family: 'Lexend', sans-serif;
  color: ${COLOR_CONFIG.text.error};
  font-size: 12px;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  
  &::before {
    content: "⚠";
    font-size: 10px;
  }
`;

const HelperText = styled.div`
  font-family: 'Lexend', sans-serif;
  color: ${COLOR_CONFIG.text.muted};
  font-size: 12px;
  margin-top: 4px;
  font-style: italic;
`;

const CharacterCount = styled.div`
  font-family: 'Lexend', sans-serif;
  text-align: right;
  font-size: 12px;
  color: ${props => props.$isOverLimit ? COLOR_CONFIG.text.error : COLOR_CONFIG.text.muted};
  margin-top: 4px;
`;

/**
 * Basic info form component
 * @param {Object} props - Component props
 * @param {Object} props.formData - Form data
 * @param {Object} props.errors - Form errors
 * @param {Function} props.onFieldChange - Field change handler
 * @param {boolean} props.disabled - Whether form is disabled
 * @returns {JSX.Element} Basic info form
 */
export const BasicInfoForm = ({
  formData,
  errors = {},
  onFieldChange,
  disabled = false
}) => {
  const titleConfig = FORM_FIELDS.title;
  const descriptionConfig = FORM_FIELDS.description;
  
  const handleInputChange = (field, value) => {
    if (onFieldChange) {
      onFieldChange(field, value);
    }
  };

  // Prevent mouse wheel from changing number inputs
  const handleWheelPrevent = (e) => {
    e.target.blur();
  };

  const getCharacterCount = (value, maxLength) => {
    const currentLength = value ? value.length : 0;
    return `${currentLength}/${maxLength}`;
  };

  const isOverLimit = (value, maxLength) => {
    return value && value.length > maxLength;
  };

  return (
    <Container>
      <SectionTitle>Basic Information</SectionTitle>
      
      {/* Title Field */}
      <FormGroup>
        <label htmlFor="title">
          {titleConfig.label}
          {titleConfig.required && <span className="required">*</span>}
        </label>
        <Input
          id="title"
          name="title"
          type={titleConfig.type}
          value={formData.title || ''}
          onChange={(e) => handleInputChange('title', e.target.value)}
          onWheel={titleConfig.type === 'number' ? handleWheelPrevent : undefined}
          placeholder={titleConfig.placeholder}
          disabled={disabled}
          $hasError={Boolean(errors.title)}
          maxLength={titleConfig.validation.maxLength}
        />
        {errors.title && (
          <ErrorText>{errors.title}</ErrorText>
        )}
        <CharacterCount 
          $isOverLimit={isOverLimit(formData.title, titleConfig.validation.maxLength)}
        >
          {getCharacterCount(formData.title, titleConfig.validation.maxLength)}
        </CharacterCount>
      </FormGroup>

      {/* Description Field */}
      <FormGroup>
        <label htmlFor="description">
          {descriptionConfig.label}
          {descriptionConfig.required && <span className="required">*</span>}
        </label>
        <TextArea
          id="description"
          name="description"
          value={formData.description || ''}
          onChange={(e) => handleInputChange('description', e.target.value)}
          placeholder={descriptionConfig.placeholder}
          disabled={disabled}
          $hasError={Boolean(errors.description)}
          maxLength={descriptionConfig.validation.maxLength}
          rows={4}
        />
        {errors.description && (
          <ErrorText>{errors.description}</ErrorText>
        )}
        {descriptionConfig.helperText && !errors.description && (
          <HelperText>{descriptionConfig.helperText}</HelperText>
        )}
        <CharacterCount 
          $isOverLimit={isOverLimit(formData.description, descriptionConfig.validation.maxLength)}
        >
          {getCharacterCount(formData.description, descriptionConfig.validation.maxLength)}
        </CharacterCount>
      </FormGroup>
    </Container>
  );
};

export default BasicInfoForm; 