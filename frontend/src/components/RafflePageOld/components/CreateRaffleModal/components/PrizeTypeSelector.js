import React from 'react';
import styled from 'styled-components';
import { COLOR_CONFIG, BUTTON_CONFIG, MODAL_CONFIG } from '../data/modalConfig';
import { PRIZE_TYPE_OPTIONS } from '../data/formConfig';

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

const Description = styled.p`
  margin: 0 0 16px 0;
  color: ${COLOR_CONFIG.text.secondary};
  font-size: 14px;
  line-height: 1.5;
`;

const ToggleContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const TypeButton = styled.button`
  font-family: 'Lexend', sans-serif;
  width: 100%;
  padding: 16px 20px;
  border: 2px solid ${props => props.$active ? COLOR_CONFIG.primary : COLOR_CONFIG.border.default};
  border-radius: ${MODAL_CONFIG.borderRadius.button}px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => props.$active ? 'rgba(105, 48, 195, 0.1)' : COLOR_CONFIG.background.white};
  color: ${props => props.$active ? COLOR_CONFIG.primary : COLOR_CONFIG.text.muted};
  display: flex;
  align-items: center;
  gap: 16px;
  text-align: left;
  
  &:hover {
    border-color: ${COLOR_CONFIG.primary};
    background: rgba(105, 48, 195, 0.05);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const TypeIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: ${props => props.$active ? COLOR_CONFIG.primary : COLOR_CONFIG.text.muted};
  color: ${COLOR_CONFIG.text.white};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: bold;
  transition: all 0.2s ease;
  flex-shrink: 0;
`;

const TypeContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const TypeLabel = styled.div`
  font-family: 'Lexend', sans-serif;
  font-size: 16px;
  font-weight: 600;
  color: inherit;
`;

const TypeDescription = styled.div`
  font-family: 'Lexend', sans-serif;
  font-size: 12px;
  color: ${COLOR_CONFIG.text.muted};
  line-height: 1.3;
`;

const ErrorText = styled.div`
  font-family: 'Lexend', sans-serif;
  color: ${COLOR_CONFIG.text.error};
  font-size: 12px;
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  
  &::before {
    content: "⚠";
    font-size: 10px;
  }
`;

/**
 * Prize type selector component
 * @param {Object} props - Component props
 * @param {string} props.selectedType - Currently selected prize type
 * @param {Function} props.onTypeChange - Type change handler
 * @param {boolean} props.disabled - Whether selector is disabled
 * @returns {JSX.Element} Prize type selector
 */
export const PrizeTypeSelector = ({ 
  selectedType,
  onTypeChange,
  disabled = false
}) => {
  // Calculate the selected index for the slider position
  const selectedIndex = PRIZE_TYPE_OPTIONS.findIndex(option => option.value === selectedType);
  
  return (
    <Container>
      <SectionTitle>Prize Type</SectionTitle>
      <Description>
        Choose what type of prize you want to raffle
      </Description>
      
      <ToggleContainer>
        {PRIZE_TYPE_OPTIONS.map((option) => (
          <TypeButton
            key={option.value}
            type="button"
            $active={selectedType === option.value}
            onClick={() => onTypeChange(option.value)}
            disabled={disabled}
          >
            <TypeIcon $active={selectedType === option.value}>
              {option.icon}
            </TypeIcon>
            <TypeContent>
              <TypeLabel>{option.label}</TypeLabel>
              <TypeDescription>{option.description}</TypeDescription>
            </TypeContent>
          </TypeButton>
        ))}
      </ToggleContainer>
    </Container>
  );
};

export default PrizeTypeSelector; 