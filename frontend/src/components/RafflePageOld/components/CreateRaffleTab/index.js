import React from 'react';
import HorizontalCreateRaffle from './HorizontalCreateRaffle';

/**
 * Create Raffle Tab Component - Now uses HorizontalCreateRaffle
 */
const CreateRaffleTab = ({ onSuccess, onError, userAddress, triggerAssetFetch, toastHandlers }) => {
  return (
    <HorizontalCreateRaffle 
      onSuccess={onSuccess} 
      onError={onError}
      userAddress={userAddress}
      triggerAssetFetch={triggerAssetFetch}
      toastHandlers={toastHandlers}
    />
  );
};

export default CreateRaffleTab;