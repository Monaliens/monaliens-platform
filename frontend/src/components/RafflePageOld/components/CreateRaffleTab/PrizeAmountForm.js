import React from 'react';
import styled from 'styled-components';
import { COLOR_CONFIG, INPUT_CONFIG, MODAL_CONFIG } from '../CreateRaffleModal/data/modalConfig';

const Container = styled.div`
  font-family: 'Lexend', sans-serif;
  width: 100%;
`;

const SectionTitle = styled.h4`
  font-family: 'Lexend', sans-serif;
  margin: 0 0 16px 0;
  color: ${COLOR_CONFIG.text.primary};
  font-size: 16px;
  font-weight: 600;
`;

const FormGroup = styled.div`
  font-family: 'Lexend', sans-serif;
  margin-bottom: 12px;
  
  label {
    display: block;
    margin-bottom: 4px;
    color: ${COLOR_CONFIG.text.primary};
    font-size: 13px;
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
  
  /* Hide number input arrows */
  &[type="number"]::-webkit-outer-spin-button,
  &[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  
  &[type="number"] {
    -moz-appearance: textfield;
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
  }
`;

const HelperText = styled.div`
  font-family: 'Lexend', sans-serif;
  color: ${COLOR_CONFIG.text.muted};
  font-size: 11px;
  margin-top: 2px;
`;

const BalanceDisplay = styled.div`
  font-family: 'Lexend', sans-serif;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border: 2px solid ${COLOR_CONFIG.border.default};
  border-radius: ${MODAL_CONFIG.borderRadius.input}px;
  padding: 12px 16px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const BalanceLabel = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: ${COLOR_CONFIG.text.primary};
`;

const BalanceValue = styled.span`
  font-size: 14px;
  font-weight: 700;
  color: ${COLOR_CONFIG.primary};
`;

/**
 * Prize Amount Form Component
 */
const PrizeAmountForm = ({
  formData,
  errors,
  onFieldChange,
  disabled = false,
  userBalance = null
}) => {
  const maxBalance = userBalance ? parseFloat(userBalance) : 0;
  
  const handleAmountChange = (value) => {
    // If user enters more than max balance, set it to max balance
    if (value && formData.prizeType === 'TOKEN' && userBalance) {
      const numValue = parseFloat(value);
      const balance = parseFloat(userBalance);
      
      if (!isNaN(numValue) && !isNaN(balance)) {
        // Reserve 2% for gas fees
        const maxSafeAmount = balance * 0.98;
        if (numValue > maxSafeAmount) {
          // Auto-correct to max safe amount
          onFieldChange('prizeAmount', maxSafeAmount.toFixed(6));
          return;
        }
      }
    }
    
    // Normal input
    onFieldChange('prizeAmount', value);
  };

  return (
    <Container>
      <SectionTitle>Prize Amount</SectionTitle>
      
      {formData.prizeType === 'TOKEN' && userBalance && (
        <BalanceDisplay>
          <BalanceLabel>Your MON Balance:</BalanceLabel>
          <BalanceValue>{parseFloat(userBalance).toFixed(6)} MON</BalanceValue>
        </BalanceDisplay>
      )}
      
      <FormGroup>
        <label>
          {formData.prizeType === 'TOKEN' ? 'Token Amount' : 'Prize Value'}
          <span className="required">*</span>
        </label>
        <Input
          type="number"
          step="0.000001"
          min="0"
          max={formData.prizeType === 'TOKEN' ? maxBalance : undefined}
          placeholder={formData.prizeType === 'TOKEN' ? 'Enter MON amount (e.g., 100)' : 'Enter prize value'}
          value={formData.prizeAmount || ''}
          onChange={(e) => handleAmountChange(e.target.value)}
          onKeyDown={(e) => {
            // Prevent minus sign
            if (e.key === '-' || e.key === 'e' || e.key === 'E') {
              e.preventDefault();
            }
          }}
          onWheel={(e) => {
            // Prevent scroll from changing value
            e.target.blur();
          }}
          disabled={disabled}
          $hasError={!!errors.prizeAmount}
        />
        {errors.prizeAmount && (
          <ErrorText>{errors.prizeAmount}</ErrorText>
        )}
        {!errors.prizeAmount && formData.prizeType === 'TOKEN' && (
          <HelperText>
            Max: {maxBalance.toFixed(2)} MON
          </HelperText>
        )}
      </FormGroup>
    </Container>
  );
};

export default PrizeAmountForm;