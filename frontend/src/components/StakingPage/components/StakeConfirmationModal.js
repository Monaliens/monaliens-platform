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

const StakeConfirmationModal = ({ isOpen, onClose, onConfirm, nftCount }) => {
  const [isChecked, setIsChecked] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (isChecked) {
      onConfirm();
      setIsChecked(false); // Reset checkbox after confirm
    }
  };

  const handleClose = () => {
    setIsChecked(false); // Reset checkbox on close
    onClose();
  };

  return (
    <ModalOverlay onClick={handleClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <h3>Confirm Staking</h3>
          <p>You are about to stake {nftCount} NFT{nftCount > 1 ? 's' : ''}</p>
        </ModalHeader>

        <ModalBody>
          <p>
            After you stake your NFT, you won't be able to transfer or sell it until you unstake it.
          </p>
          <p>
            <strong>Unstaking takes 5 days.</strong>
          </p>
          <p>
            You will still be able to use Spin & Win while your NFTs are staked.
          </p>
        </ModalBody>

        <CheckboxContainer>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => setIsChecked(e.target.checked)}
          />
          <span>I understand and agree to the staking terms</span>
        </CheckboxContainer>

        <ModalActions>
          <ModalButton onClick={handleClose}>
            Cancel
          </ModalButton>
          <ModalButton
            $variant="primary"
            disabled={!isChecked}
            onClick={handleConfirm}
          >
            Confirm Stake ({nftCount})
          </ModalButton>
        </ModalActions>
      </ModalContent>
    </ModalOverlay>
  );
};

export default StakeConfirmationModal;
