import React, { useState } from 'react';
import {
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  CheckboxContainer,
  ModalActions,
  ModalButton,
} from '../styles';

const UnstakeConfirmationModal = ({ isOpen, onClose, onConfirm, nftCount }) => {
  const [isChecked, setIsChecked] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (isChecked) {
      onConfirm();
      setIsChecked(false);
    }
  };

  const handleClose = () => {
    setIsChecked(false);
    onClose();
  };

  return (
    <ModalOverlay onClick={handleClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <h3>Confirm Unstaking</h3>
          <p>You are about to unstake {nftCount} NFT{nftCount > 1 ? 's' : ''}</p>
        </ModalHeader>

        <ModalBody>
          <p>
            <strong style={{ color: '#dc2626' }}>Unstaking takes 5 days.</strong>
          </p>
          <p style={{ color: '#dc2626', fontWeight: '600' }}>
            All earned points from these NFTs will be lost.
          </p>
        </ModalBody>

        <CheckboxContainer>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => setIsChecked(e.target.checked)}
          />
          <span>I understand that earned points will be lost</span>
        </CheckboxContainer>

        <ModalActions>
          <ModalButton onClick={handleClose}>
            Cancel
          </ModalButton>
          <ModalButton
            $variant="primary"
            disabled={!isChecked}
            onClick={handleConfirm}
            style={{ background: isChecked ? '#dc2626' : undefined }}
          >
            Confirm Unstake ({nftCount})
          </ModalButton>
        </ModalActions>
      </ModalContent>
    </ModalOverlay>
  );
};

export default UnstakeConfirmationModal;
