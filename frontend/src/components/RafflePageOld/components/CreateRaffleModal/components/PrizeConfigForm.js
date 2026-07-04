import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { COLOR_CONFIG, INPUT_CONFIG, MODAL_CONFIG, GRID_CONFIG } from '../data/modalConfig';
import { FORM_FIELDS } from '../data/formConfig';
import { PRIZE_TYPES } from '../../../utils/constants';
import { fetchUserTokens } from '../utils/assetFetcher';

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

const BalanceInfo = styled.div`
  font-family: 'Lexend', sans-serif;
  color: ${COLOR_CONFIG.text.secondary};
  font-size: 12px;
  margin-top: 4px;
  padding: 6px 8px;
  background: ${COLOR_CONFIG.background.card};
  border-radius: ${MODAL_CONFIG.borderRadius.button}px;
  border: 1px solid ${COLOR_CONFIG.border.default};
  display: flex;
  align-items: center;
  gap: 4px;
  
  &::before {
    content: "ℹ";
    color: ${COLOR_CONFIG.primary};
    font-weight: bold;
  }
`;

const MaxButton = styled.button`
  font-family: 'Lexend', sans-serif;
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: ${COLOR_CONFIG.primary};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    background: ${COLOR_CONFIG.primaryDark || '#5a2c8a'};
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const InputContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

/**
 * Prize configuration form component
 * @param {Object} props - Component props
 * @param {Object} props.formData - Form data
 * @param {Object} props.errors - Form errors
 * @param {Function} props.onFieldChange - Field change handler
 * @param {boolean} props.disabled - Whether form is disabled
 * @param {string} props.walletAddress - User wallet address
 * @returns {JSX.Element} Prize configuration form
 */
export const PrizeConfigForm = ({
  formData,
  errors = {},
  onFieldChange,
  disabled = false,
  walletAddress = null
}) => {
  const [monadBalance, setMonadBalance] = useState('0.0');
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState('');
  
  const prizeAmountConfig = FORM_FIELDS.prizeAmount;
  const ticketPriceConfig = FORM_FIELDS.ticketPrice;
  const maxTicketsConfig = FORM_FIELDS.maxTicketsPerWallet;
  
  // Prevent mouse wheel from changing number inputs
  const handleWheelPrevent = (e) => {
    e.target.blur();
  };
  
  // Fetch user's MONAD balance when TOKEN is selected
  useEffect(() => {
    const fetchBalance = async () => {
      if (formData.prizeType === PRIZE_TYPES.TOKEN && walletAddress) {
        setLoadingBalance(true);
        setBalanceError('');
        try {
          const tokens = await fetchUserTokens(walletAddress);
          const monadToken = tokens.find(token => token.isNative || token.symbol === 'MON');
          if (monadToken) {
            setMonadBalance(monadToken.balance);
          }
        } catch (error) {
          console.error('Error fetching MONAD balance:', error);
          setMonadBalance('0.0');
          setBalanceError('Failed to load balance');
        } finally {
          setLoadingBalance(false);
        }
      }
    };

    fetchBalance();
  }, [formData.prizeType, walletAddress]);
  
  const handleInputChange = (field, value) => {
    // Prize amount için balance kontrolü ve otomatik düzeltme
    if (field === 'prizeAmount' && formData.prizeType === PRIZE_TYPES.TOKEN) {
      const requestedAmount = parseFloat(value) || 0;
      const balance = parseFloat(monadBalance) || 0;
      const maxAllowed = balance * 0.98;
      
      // Eğer girilen değer max'tan fazlaysa, otomatik olarak max'a ayarla
      if (requestedAmount > maxAllowed) {
        value = maxAllowed.toFixed(2);
        setBalanceError('');
      } else if (requestedAmount > balance) {
        setBalanceError(`Amount exceeds your balance (${balance.toFixed(2)} MON)`);
      } else {
        setBalanceError('');
      }
    }
    
    if (onFieldChange) {
      onFieldChange(field, value);
    }
  };

  // Handle numeric input restrictions
  const handleKeyPress = (e) => {
    // Sadece sayılar, nokta ve silme tuşlarına izin ver
    if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
      e.preventDefault();
    }
    // Eksi işareti girmeye izin verme
    if (e.key === '-') {
      e.preventDefault();
    }
  };

  // Handle integer input restrictions (for max tickets)
  const handleIntegerKeyPress = (e) => {
    // Sadece sayılar ve silme tuşlarına izin ver (nokta yok)
    if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
      e.preventDefault();
    }
    // Eksi işareti girmeye izin verme
    if (e.key === '-') {
      e.preventDefault();
    }
  };

  // Calculate max amount (98% of balance) - 2 decimal places
  const calculateMaxAmount = () => {
    const balance = parseFloat(monadBalance) || 0;
    const maxAmount = balance * 0.98; // 98% of balance (2% less)
    return maxAmount.toFixed(2); // 2 decimal places instead of 6
  };

  // Set max amount - no warning
  const setMaxAmount = () => {
    const maxAmount = calculateMaxAmount();
    setBalanceError(''); // Clear any balance error
    handleInputChange('prizeAmount', maxAmount);
  };

  const showPrizeAmount = formData.prizeType === PRIZE_TYPES.TOKEN;
  const selectedAsset = formData.selectedAsset;
  
  // TOKEN durumunda selectedAsset kontrolü yapmayalım, çünkü Monad native token otomatik kullanılıyor
  const isPrizeAmountDisabled = disabled || (formData.prizeType === PRIZE_TYPES.NFT && !selectedAsset);

  return (
    <Container>
      <SectionTitle>Prize Configuration</SectionTitle>
      
      {/* Prize Amount Field (only for tokens) */}
      {showPrizeAmount && (
        <FormGroup>
          <label htmlFor="prizeAmount">
            {prizeAmountConfig.label}
            {prizeAmountConfig.required && <span className="required">*</span>}
          </label>
          <InputContainer>
            <Input
              id="prizeAmount"
              name="prizeAmount"
              type={prizeAmountConfig.type}
              step={prizeAmountConfig.step}
              min={prizeAmountConfig.min}
              max={calculateMaxAmount()}
              value={formData.prizeAmount || ''}
              onChange={(e) => handleInputChange('prizeAmount', e.target.value)}
              onWheel={prizeAmountConfig.type === 'number' ? handleWheelPrevent : undefined}
              placeholder={prizeAmountConfig.placeholder}
              disabled={isPrizeAmountDisabled || loadingBalance}
              $hasError={Boolean(errors.prizeAmount || balanceError)}
            />
            {!loadingBalance && parseFloat(monadBalance) > 0 && (
              <MaxButton
                type="button"
                onClick={setMaxAmount}
                disabled={isPrizeAmountDisabled}
              >
                MAX
              </MaxButton>
            )}
          </InputContainer>
          
          {/* Balance Info for TOKEN */}
          {formData.prizeType === PRIZE_TYPES.TOKEN && (
            <BalanceInfo>
              {loadingBalance ? (
                'Loading balance...'
              ) : (
                <>
                  Available: {parseFloat(monadBalance).toFixed(2)} MON | Max recommended: {calculateMaxAmount()} MON (98% of balance)
                </>
              )}
            </BalanceInfo>
          )}
          
          {/* Balance Info for NFT */}
          {formData.prizeType === PRIZE_TYPES.NFT && selectedAsset && selectedAsset.balance && (
            <BalanceInfo>
              Available: {selectedAsset.balance} {selectedAsset.symbol}
            </BalanceInfo>
          )}
          
          {formData.prizeType === PRIZE_TYPES.TOKEN && !loadingBalance && (
            <HelperText>
              Enter the amount of MON tokens to raffle as prize (Maximum: {calculateMaxAmount()} MON)
            </HelperText>
          )}
          
          {/* Show balance error first, then form validation error */}
          {balanceError && (
            <ErrorText>{balanceError}</ErrorText>
          )}
          {!balanceError && errors.prizeAmount && (
            <ErrorText>{errors.prizeAmount}</ErrorText>
          )}
        </FormGroup>
      )}

      {/* Ticket Price and Max Tickets Row */}
      <FormRow>
        {/* Ticket Price Field */}
        <FormGroup>
          <label htmlFor="ticketPrice">
            {ticketPriceConfig.label}
            {ticketPriceConfig.required && <span className="required">*</span>}
          </label>
          <Input
            id="ticketPrice"
            name="ticketPrice"
            type={ticketPriceConfig.type}
            step={ticketPriceConfig.step}
            min={ticketPriceConfig.min}
            value={formData.ticketPrice || ''}
            onChange={(e) => handleInputChange('ticketPrice', e.target.value)}
            onKeyPress={handleKeyPress}
            onWheel={ticketPriceConfig.type === 'number' ? handleWheelPrevent : undefined}
            placeholder={ticketPriceConfig.placeholder}
            disabled={disabled}
            $hasError={Boolean(errors.ticketPrice)}
          />
          {ticketPriceConfig.helperText && !errors.ticketPrice && (
            <HelperText>{ticketPriceConfig.helperText}</HelperText>
          )}
          {errors.ticketPrice && (
            <ErrorText>{errors.ticketPrice}</ErrorText>
          )}
        </FormGroup>

        {/* Max Total Tickets Field */}
        <FormGroup>
          <label htmlFor="maxTotalTickets">
            Max Total Tickets
            <span className="required">*</span>
          </label>
          <Input
            id="maxTotalTickets"
            name="maxTotalTickets"
            type="number"
            min="0"
            max="10000"
            value={formData.maxTotalTickets || ''}
            onChange={(e) => {
              const value = e.target.value;
              const numValue = parseInt(value);
              
              // Auto-correct if over 10000
              if (!isNaN(numValue) && numValue > 10000) {
                handleInputChange('maxTotalTickets', '10000');
              } else {
                handleInputChange('maxTotalTickets', value);
              }
              
              // Auto-adjust maxTicketsPerWallet if it exceeds 40% of total
              if (formData.maxTicketsPerWallet && numValue > 0) {
                const maxPerWallet = Math.floor(numValue * 0.4);
                const currentPerWallet = parseInt(formData.maxTicketsPerWallet);
                if (currentPerWallet > maxPerWallet) {
                  handleInputChange('maxTicketsPerWallet', maxPerWallet.toString());
                }
              }
            }}
            onKeyPress={handleIntegerKeyPress}
            onWheel={handleWheelPrevent}
            placeholder="e.g., 100 (0 = unlimited)"
            disabled={disabled}
            $hasError={Boolean(errors.maxTotalTickets)}
          />
          {!errors.maxTotalTickets && (
            <HelperText>Total tickets available (0 = unlimited, max 10,000)</HelperText>
          )}
          {errors.maxTotalTickets && (
            <ErrorText>{errors.maxTotalTickets}</ErrorText>
          )}
        </FormGroup>

        {/* Max Tickets Per Wallet Field */}
        <FormGroup>
          <label htmlFor="maxTicketsPerWallet">
            Max Tickets Per Person
            <span className="required">*</span>
          </label>
          <Input
            id="maxTicketsPerWallet"
            name="maxTicketsPerWallet"
            type={maxTicketsConfig.type}
            min={maxTicketsConfig.min}
            max={formData.maxTotalTickets && formData.maxTotalTickets > 0 ? Math.floor(formData.maxTotalTickets * 0.4) : maxTicketsConfig.max}
            value={formData.maxTicketsPerWallet || ''}
            onChange={(e) => {
              const value = e.target.value;
              const numValue = parseInt(value);
              const totalTickets = parseInt(formData.maxTotalTickets) || 0;
              
              if (totalTickets > 0) {
                const maxAllowed = Math.floor(totalTickets * 0.4);
                
                // Auto-correct if exceeds 40% of total
                if (!isNaN(numValue) && numValue > maxAllowed) {
                  handleInputChange('maxTicketsPerWallet', maxAllowed.toString());
                } else {
                  handleInputChange('maxTicketsPerWallet', value);
                }
              } else {
                // No total limit, use config max
                if (!isNaN(numValue) && numValue > maxTicketsConfig.max) {
                  handleInputChange('maxTicketsPerWallet', maxTicketsConfig.max.toString());
                } else {
                  handleInputChange('maxTicketsPerWallet', value);
                }
              }
            }}
            onKeyPress={handleIntegerKeyPress}
            onWheel={maxTicketsConfig.type === 'number' ? handleWheelPrevent : undefined}
            placeholder="e.g., 10"
            disabled={disabled}
            $hasError={Boolean(errors.maxTicketsPerWallet)}
          />
          {!errors.maxTicketsPerWallet && (
            <HelperText>
              {formData.maxTotalTickets && formData.maxTotalTickets > 0
                ? `Max per person: ${Math.floor(formData.maxTotalTickets * 0.4)} (40% of total)`
                : maxTicketsConfig.helperText
              }
            </HelperText>
          )}
          {errors.maxTicketsPerWallet && (
            <ErrorText>{errors.maxTicketsPerWallet}</ErrorText>
          )}
        </FormGroup>
      </FormRow>
    </Container>
  );
};

export default PrizeConfigForm; 