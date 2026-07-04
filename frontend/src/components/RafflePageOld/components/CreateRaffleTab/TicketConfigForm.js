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

const FormRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
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

/**
 * Ticket Configuration Form Component
 */
const TicketConfigForm = ({
  formData,
  errors,
  onFieldChange,
  disabled = false
}) => {
  return (
    <Container>
      <SectionTitle>Ticket Configuration</SectionTitle>
      
      <FormRow>
        <FormGroup>
          <label>
            Ticket Price (MON)
            <span className="required">*</span>
          </label>
          <Input
            type="number"
            step="0.000001"
            min="0"
            placeholder="e.g., 1"
            value={formData.ticketPrice || ''}
            onChange={(e) => onFieldChange('ticketPrice', e.target.value)}
            onKeyDown={(e) => {
              // Prevent minus sign and invalid characters
              if (e.key === '-' || e.key === 'e' || e.key === 'E') {
                e.preventDefault();
              }
            }}
            onWheel={(e) => {
              // Prevent scroll from changing value
              e.target.blur();
            }}
            disabled={disabled}
            $hasError={!!errors.ticketPrice}
          />
          {errors.ticketPrice && (
            <ErrorText>{errors.ticketPrice}</ErrorText>
          )}
          {!errors.ticketPrice && (
            <HelperText>
              Price per ticket in MON tokens
            </HelperText>
          )}
        </FormGroup>

        <FormGroup>
          <label>
            Max Total Tickets
            <span className="required">*</span>
          </label>
          <Input
            type="number"
            min="10"
            max="10000"
            placeholder="e.g., 100 (min 10)"
            value={formData.maxTotalTickets || ''}
            onChange={(e) => {
              const value = e.target.value;
              const numValue = parseInt(value);
              
              // Auto-correct if over 10000
              if (!isNaN(numValue) && numValue > 10000) {
                onFieldChange('maxTotalTickets', '10000');
              } else {
                onFieldChange('maxTotalTickets', value);
              }
              
              // Auto-adjust maxTicketsPerWallet if it exceeds 40% of total
              if (formData.maxTicketsPerWallet && numValue > 0) {
                const maxPerWallet = Math.floor(numValue * 0.4);
                const currentPerWallet = parseInt(formData.maxTicketsPerWallet);
                if (currentPerWallet > maxPerWallet) {
                  onFieldChange('maxTicketsPerWallet', maxPerWallet.toString());
                }
              }
            }}
            onKeyDown={(e) => {
              // Prevent minus sign, decimal point and invalid characters for integers
              if (e.key === '-' || e.key === '.' || e.key === 'e' || e.key === 'E') {
                e.preventDefault();
              }
            }}
            onWheel={(e) => {
              // Prevent scroll from changing value
              e.target.blur();
            }}
            disabled={disabled}
            $hasError={!!errors.maxTotalTickets}
          />
          {errors.maxTotalTickets && (
            <ErrorText>{errors.maxTotalTickets}</ErrorText>
          )}
          {!errors.maxTotalTickets && (
            <HelperText>
              Total tickets available (min 10, max 10,000)
            </HelperText>
          )}
        </FormGroup>

        <FormGroup>
          <label>
            Max Tickets Per Person
            <span className="required">*</span>
          </label>
          <Input
            type="number"
            min="1"
            max={formData.maxTotalTickets && formData.maxTotalTickets > 0 ? Math.floor(formData.maxTotalTickets * 0.4) : 1000}
            placeholder="e.g., 10"
            value={formData.maxTicketsPerWallet || ''}
            onChange={(e) => {
              const value = e.target.value;
              const numValue = parseInt(value);
              const totalTickets = parseInt(formData.maxTotalTickets) || 0;
              
              if (totalTickets > 0) {
                const maxAllowed = Math.floor(totalTickets * 0.4);
                
                // Auto-correct if exceeds 40% of total
                if (!isNaN(numValue) && numValue > maxAllowed) {
                  onFieldChange('maxTicketsPerWallet', maxAllowed.toString());
                } else {
                  onFieldChange('maxTicketsPerWallet', value);
                }
              } else {
                // No total limit, use old max of 1000
                if (!isNaN(numValue) && numValue > 1000) {
                  onFieldChange('maxTicketsPerWallet', '1000');
                } else {
                  onFieldChange('maxTicketsPerWallet', value);
                }
              }
            }}
            onKeyDown={(e) => {
              // Prevent minus sign, decimal point and invalid characters for integers
              if (e.key === '-' || e.key === '.' || e.key === 'e' || e.key === 'E') {
                e.preventDefault();
              }
            }}
            onWheel={(e) => {
              // Prevent scroll from changing value
              e.target.blur();
            }}
            disabled={disabled}
            $hasError={!!errors.maxTicketsPerWallet}
          />
          {errors.maxTicketsPerWallet && (
            <ErrorText>{errors.maxTicketsPerWallet}</ErrorText>
          )}
          {!errors.maxTicketsPerWallet && (
            <HelperText>
              {formData.maxTotalTickets && formData.maxTotalTickets > 0
                ? `Max: ${Math.floor(formData.maxTotalTickets * 0.4)} (~40% of total tickets)`
                : '1-1,000'
              }
            </HelperText>
          )}
        </FormGroup>
      </FormRow>
    </Container>
  );
};

export default TicketConfigForm;