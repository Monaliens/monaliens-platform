import React from 'react';
import { ModalContent as StyledModalContent } from '../styles';

const ModalContent = ({ children }) => {
  return (
    <StyledModalContent>
      {children}
    </StyledModalContent>
  );
};

export default ModalContent; 