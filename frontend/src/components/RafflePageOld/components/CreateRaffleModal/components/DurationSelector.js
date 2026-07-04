import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { COLOR_CONFIG, BUTTON_CONFIG, MODAL_CONFIG, GRID_CONFIG, INPUT_CONFIG } from '../data/modalConfig';
import { DURATION_PRESETS } from '../data/assetConfig';
import { FORM_FIELDS } from '../data/formConfig';

const Container = styled.div`
  font-family: 'Lexend', sans-serif;
  margin-bottom: ${MODAL_CONFIG.spacing.section}px;
`;

const SectionTitle = styled.h3`
  font-family: 'Lexend', sans-serif;
  margin: 0 0 16px 0;
  color: ${COLOR_CONFIG.text.primary};
  font-size: 18px;
  font-weight: 600;
`;

const CustomDropdownContainer = styled.div`
  position: relative;
  width: 100%;
`;

const DropdownButton = styled.button`
  font-family: 'Lexend', sans-serif;
  width: 100%;
  padding: ${INPUT_CONFIG.padding};
  border: 2px solid rgba(105, 48, 195, 0.15);
  border-radius: 12px;
  font-size: ${INPUT_CONFIG.fontSize}px;
  font-weight: 500;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(105, 48, 195, 0.02) 100%);
  transition: all 0.3s ease;
  box-sizing: border-box;
  cursor: pointer;
  color: #1f2937;
  text-align: left;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  &:hover {
    border-color: rgba(105, 48, 195, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(105, 48, 195, 0.15);
  }
  
  &:focus {
    outline: none;
    border-color: #6930c3;
    box-shadow: 0 0 0 3px rgba(105, 48, 195, 0.1);
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: rgba(243, 244, 246, 0.5);
    transform: none;
  }
`;

const DropdownArrow = styled.div`
  width: 16px;
  height: 16px;
  transition: transform 0.3s ease;
  transform: ${props => props.$isOpen ? 'rotate(180deg)' : 'rotate(0deg)'};
  
  svg {
    width: 100%;
    height: 100%;
    stroke: #6930c3;
    stroke-width: 2;
  }
`;

const DropdownList = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #ffffff;
  border: 2px solid rgba(105, 48, 195, 0.2);
  border-radius: 12px;
  box-shadow: 0 8px 25px rgba(105, 48, 195, 0.2);
  z-index: 1000;
  margin-top: 4px;
  overflow: hidden;
  opacity: ${props => props.$isOpen ? 1 : 0};
  visibility: ${props => props.$isOpen ? 'visible' : 'hidden'};
  transform: translateY(${props => props.$isOpen ? '0' : '-10px'});
  transition: all 0.3s ease;
  max-height: 300px;
  overflow-y: auto;
  
  @media (max-width: 768px) {
    max-height: 200px; /* Reduced height on mobile */
    bottom: ${props => props.$openUpward ? '100%' : 'auto'};
    top: ${props => props.$openUpward ? 'auto' : '100%'};
    margin-bottom: ${props => props.$openUpward ? '4px' : '0'};
    margin-top: ${props => props.$openUpward ? '0' : '4px'};
    transform: translateY(${props => {
      if (!props.$isOpen) return props.$openUpward ? '10px' : '-10px';
      return '0';
    }});
  }
`;

const DropdownItem = styled.div`
  font-family: 'Lexend', sans-serif;
  padding: 12px 16px;
  color: #1f2937;
  font-weight: 500;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  &:hover {
    background: linear-gradient(135deg, rgba(105, 48, 195, 0.1) 0%, rgba(105, 48, 195, 0.05) 100%);
    color: #6930c3;
  }
  
  &.selected {
    background: linear-gradient(135deg, #6930c3 0%, #8b5cf6 100%);
    color: white;
    font-weight: 600;
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

const FormGroup = styled.div`
  margin-top: 16px;
  
  label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: ${COLOR_CONFIG.text.primary};
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 8px;
    cursor: pointer;
    
    input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: ${COLOR_CONFIG.primary};
    }
  }
`;

const CustomInput = styled.input`
  font-family: 'Lexend', sans-serif;
  width: 100%;
  padding: ${INPUT_CONFIG.padding};
  border: ${INPUT_CONFIG.borderWidth}px solid ${props => props.$hasError ? COLOR_CONFIG.border.error : COLOR_CONFIG.border.default};
  border-radius: ${MODAL_CONFIG.borderRadius.input}px;
  font-size: ${INPUT_CONFIG.fontSize}px;
  background: ${COLOR_CONFIG.background.white};
  transition: all 0.2s ease;
  margin-top: 8px;
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

const DurationInput = styled.input`
  font-family: 'Lexend', sans-serif;
  width: 100%;
  height: 40px;
  padding: 8px 12px;
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

/**
 * Duration selector component
 * @param {Object} props - Component props
 * @param {Object} props.formData - Form data
 * @param {Object} props.errors - Form errors
 * @param {Function} props.onDurationSelect - Duration selection handler
 * @param {Function} props.onFieldChange - Field change handler
 * @param {boolean} props.disabled - Whether selector is disabled
 * @returns {JSX.Element} Duration selector
 */
export const DurationSelector = ({
  formData,
  errors = {},
  onDurationSelect,
  onFieldChange,
  onMultipleFieldsChange,
  disabled = false
}) => {
  const customDurationConfig = FORM_FIELDS.customDuration;
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleDurationChange = (value) => {
    setIsOpen(false);
    
    if (value === -1) {
      // Custom duration selected
      if (onMultipleFieldsChange) {
        onMultipleFieldsChange({
          useCustomDuration: true,
          duration: null
        });
      } else if (onFieldChange) {
        onFieldChange('useCustomDuration', true);
        onFieldChange('duration', null);
      }
    } else if (value > 0) {
      // Preset duration selected
      if (onMultipleFieldsChange) {
        onMultipleFieldsChange({
          duration: value,
          useCustomDuration: false,
          customDuration: ''
        });
      } else if (onFieldChange) {
        onFieldChange('duration', value);
        onFieldChange('useCustomDuration', false);
        onFieldChange('customDuration', '');
      }
      if (onDurationSelect) {
        onDurationSelect(value);
      }
    }
  };

  const handleFieldChange = (field, value) => {
    if (onFieldChange) {
      onFieldChange(field, value);
    }
  };

  const getCurrentValue = () => {
    if (formData.useCustomDuration) {
      return -1; // Custom option value
    }
    return formData.duration || '';
  };

  const getDisplayText = () => {
    if (formData.useCustomDuration) {
      return 'Custom Duration';
    }
    
    const currentPreset = DURATION_PRESETS.find(preset => preset.value === formData.duration);
    return currentPreset ? `${currentPreset.label} ${currentPreset.unit}` : 'Select Duration';
  };

  return (
    <Container>
      <SectionTitle>Duration</SectionTitle>
      
      {/* Custom Duration Dropdown */}
      <CustomDropdownContainer ref={dropdownRef}>
        <DropdownButton
          onClick={(e) => {
            if (!disabled) {
              // Check if we need to open upward on mobile
              if (window.innerWidth <= 768) {
                const buttonRect = e.currentTarget.getBoundingClientRect();
                const spaceBelow = window.innerHeight - buttonRect.bottom;
                const spaceAbove = buttonRect.top;
                // If less than 250px space below and more space above, open upward
                setOpenUpward(spaceBelow < 250 && spaceAbove > spaceBelow);
              }
              setIsOpen(!isOpen);
            }
          }}
          disabled={disabled}
          type="button"
        >
          <span>{getDisplayText()}</span>
          <DropdownArrow $isOpen={isOpen}>
            <svg fill="none" viewBox="0 0 20 20">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l4 4 4-4"/>
            </svg>
          </DropdownArrow>
        </DropdownButton>
        
        <DropdownList $isOpen={isOpen} $openUpward={openUpward}>
          <DropdownItem
            className={getCurrentValue() === '' ? 'selected' : ''}
            onClick={() => handleDurationChange('')}
          >
            Select Duration
          </DropdownItem>
          {DURATION_PRESETS.map((preset, index) => (
            <DropdownItem
              key={index}
              className={getCurrentValue() === preset.value ? 'selected' : ''}
              onClick={() => handleDurationChange(preset.value)}
            >
              {preset.label} {preset.unit}
            </DropdownItem>
          ))}
          <DropdownItem
            className={getCurrentValue() === -1 ? 'selected' : ''}
            onClick={() => handleDurationChange(-1)}
          >
            Custom Duration
            {getCurrentValue() === -1 && <span style={{ fontSize: '12px' }}>✓</span>}
          </DropdownItem>
        </DropdownList>
      </CustomDropdownContainer>

      {/* Custom Duration Input */}
      {formData.useCustomDuration && (
        <FormGroup>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
            <div style={{ flex: '1' }}>
              <DurationInput
                type={customDurationConfig.type}
                min={formData.customDurationUnit === 'minutes' ? '10' : '1'}
                max={customDurationConfig.max}
                value={formData.customDuration || ''}
                onChange={(e) => handleFieldChange('customDuration', e.target.value)}
                onWheel={customDurationConfig.type === 'number' ? (e) => e.target.blur() : undefined}
                placeholder="Duration"
                disabled={disabled}
                $hasError={Boolean(errors.duration)}
              />
            </div>
            <div style={{ 
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              height: '42px',
              width: '80px',
              borderRadius: '10px',
              background: 'rgba(139, 92, 246, 0.08)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              padding: '4px'
            }}>
              {/* Sliding indicator */}
              <div style={{
                position: 'absolute',
                top: '4px',
                left: formData.customDurationUnit === 'minutes' ? '4px' : 'calc(50% + 2px)',
                width: 'calc(50% - 4px)',
                height: 'calc(100% - 8px)',
                background: '#8B5CF6',
                borderRadius: '6px',
                transition: 'left 0.3s ease',
                zIndex: 1
              }} />
              
              {/* M button */}
              <button
                type="button"
                onClick={() => handleFieldChange('customDurationUnit', 'minutes')}
                disabled={disabled}
                style={{
                  position: 'relative',
                  zIndex: 2,
                  padding: '0',
                  border: 'none',
                  background: 'transparent',
                  color: formData.customDurationUnit === 'minutes' ? 'white' : '#8B5CF6',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  transition: 'color 0.3s ease',
                  opacity: disabled ? 0.6 : 1,
                  width: '50%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  outline: 'none'
                }}
              >
                M
              </button>
              
              {/* H button */}
              <button
                type="button"
                onClick={() => handleFieldChange('customDurationUnit', 'hours')}
                disabled={disabled}
                style={{
                  position: 'relative',
                  zIndex: 2,
                  padding: '0',
                  border: 'none',
                  background: 'transparent',
                  color: formData.customDurationUnit === 'hours' ? 'white' : '#8B5CF6',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  transition: 'color 0.3s ease',
                  opacity: disabled ? 0.6 : 1,
                  width: '50%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  outline: 'none'
                }}
              >
                H
              </button>
            </div>
          </div>
          {errors.duration && (
            <ErrorText>{errors.duration}</ErrorText>
          )}
          {!errors.duration && (
            <HelperText>
              <div>Enter custom duration</div>
              <div>M = Minutes, H = Hours</div>
              <div>Min duration: 10 minutes</div>
            </HelperText>
          )}
        </FormGroup>
      )}
      
      {!formData.useCustomDuration && errors.duration && (
        <ErrorText>{errors.duration}</ErrorText>
      )}
      
      {!formData.useCustomDuration && !errors.duration && (
        <HelperText>
          Select a preset duration or choose custom duration
        </HelperText>
      )}
    </Container>
  );
};

export default DurationSelector; 