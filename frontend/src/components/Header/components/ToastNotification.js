import React, { memo } from 'react';
import { ToastContainer, Toast } from '../styles';

const ToastNotification = memo(({ toasts }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <ToastContainer>
      {toasts.map(toast => (
        <Toast key={toast.id}>
          {toast.message}
        </Toast>
      ))}
    </ToastContainer>
  );
});

ToastNotification.displayName = 'ToastNotification';

export default ToastNotification; 