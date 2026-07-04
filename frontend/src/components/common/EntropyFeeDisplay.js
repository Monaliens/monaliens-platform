import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { Edit3, Check, X } from 'lucide-react';
import { getEntropyFeeLimit, setEntropyFeeLimit } from '../../utils/entropyFeeSettings';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.5rem;
  margin-left: auto;
  margin-right: auto;
  width: fit-content;
`;

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  position: relative;
`;

const LimitDisplay = styled.div`
  font-size: 0.75rem;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  width: 100%;
`;

const FeeText = styled.span`
  color: var(--text-tertiary);
`;

const EditButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    color: var(--accent-primary);
    background: var(--border-light);
  }
`;

const EditContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  animation: expandIn 0.2s ease-out;

  @keyframes expandIn {
    from {
      opacity: 0;
      transform: translateX(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
`;

const Separator = styled.span`
  color: var(--border-color);
  margin: 0 0.25rem;
`;

const LimitLabel = styled.span`
  color: var(--text-secondary);
  font-size: 0.7rem;
`;

const LimitInput = styled.input`
  width: 50px;
  padding: 3px 6px;
  border: 1px solid var(--input-border);
  border-radius: 4px;
  font-size: 0.7rem;
  font-family: inherit;
  background: var(--input-bg);
  color: var(--text-primary);
  text-align: center;

  &:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 2px var(--shadow-color);
  }
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: ${props => props.$variant === 'save' ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)'};
  border: 1px solid ${props => props.$variant === 'save' ? 'rgba(22, 163, 74, 0.3)' : 'rgba(220, 38, 38, 0.3)'};
  border-radius: 4px;
  color: ${props => props.$variant === 'save' ? '#16a34a' : '#dc2626'};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.$variant === 'save' ? 'rgba(22, 163, 74, 0.2)' : 'rgba(220, 38, 38, 0.2)'};
    transform: scale(1.05);
  }
`;

const Tooltip = styled.div`
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 8px;
  background: var(--bg-tooltip);
  color: var(--text-tooltip);
  font-size: 0.65rem;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  margin-bottom: 4px;

  ${EditButton}:hover & {
    opacity: 1;
  }
`;

const EditButtonWrapper = styled.div`
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 0.45rem;
  display: flex;
  align-items: center;
`;

/**
 * EntropyFeeDisplay - Shows entropy fee with inline edit for custom limit
 * @param {Object} props
 * @param {string} props.entropyFee - Current entropy fee in MON (formatted string)
 */
const EntropyFeeDisplay = ({ entropyFee }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [limitValue, setLimitValue] = useState(() => getEntropyFeeLimit());
  const inputRef = useRef(null);

  // Sync limit value when localStorage changes (from other components)
  useEffect(() => {
    const handleLimitChange = (e) => {
      setLimitValue(e.detail);
    };

    window.addEventListener('entropyFeeLimitChanged', handleLimitChange);
    return () => window.removeEventListener('entropyFeeLimitChanged', handleLimitChange);
  }, []);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleEditClick = () => {
    setLimitValue(getEntropyFeeLimit());
    setIsEditing(true);
  };

  const handleSave = () => {
    const numValue = parseFloat(limitValue);
    if (!isNaN(numValue) && numValue > 0) {
      setEntropyFeeLimit(numValue);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setLimitValue(getEntropyFeeLimit());
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const feeValue = entropyFee ? parseFloat(entropyFee).toFixed(2) : '0.00';
  const currentLimit = typeof limitValue === 'number' ? limitValue : getEntropyFeeLimit();

  return (
    <Wrapper>
      <Container>
        <FeeText>Entropy Fee: {feeValue} MON</FeeText>

        {!isEditing ? (
          <EditButtonWrapper>
            <EditButton onClick={handleEditClick} title="Set custom fee limit">
              <Edit3 size={12} />
              <Tooltip>Set custom fee limit</Tooltip>
            </EditButton>
          </EditButtonWrapper>
        ) : (
          <EditContainer>
            <Separator>|</Separator>
            <LimitLabel>Max:</LimitLabel>
            <LimitInput
              ref={inputRef}
              type="number"
              step="0.1"
              min="0.1"
              value={limitValue}
              onChange={(e) => setLimitValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <LimitLabel>MON</LimitLabel>
            <ActionButton $variant="save" onClick={handleSave} title="Save">
              <Check size={12} />
            </ActionButton>
            <ActionButton $variant="cancel" onClick={handleCancel} title="Cancel">
              <X size={12} />
            </ActionButton>
          </EditContainer>
        )}
      </Container>

      {!isEditing && (
        <LimitDisplay>
          Custom limit: {currentLimit} MON
        </LimitDisplay>
      )}
    </Wrapper>
  );
};

export default EntropyFeeDisplay;
