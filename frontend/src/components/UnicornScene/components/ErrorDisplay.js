import React from 'react';

// Error display component for UnicornStudio errors
export const ErrorDisplay = ({ error }) => {
  if (!error) return null;

  return (
    <div
      style={{
        color: 'red',
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(255,255,255,0.8)',
        padding: '10px',
        borderRadius: '5px',
        zIndex: '2000',
        fontSize: '12px',
        maxWidth: '80%',
        wordWrap: 'break-word'
      }}
    >
      {error}
    </div>
  );
}; 