import React, { useState, useCallback } from 'react';
import { renderIcon } from '../utils/iconRenderer';
import { downloadAsPNG } from '../utils/exportUtils';
import {
  LeftPanel,
  SelectedAttribute,
  AttributeName,
  AttributeValue,
  ActionButtons,
  RandomizeButton,
  ResetButton,
  DownloadButton
} from '../styles';

// Enhanced attribute selector component with accessibility and UX improvements
export const AttributeSelector = ({
  selectedAttributes,
  getSelectedName,
  resetSelections,
  randomizeSelections
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  // Attribute configuration with proper labels and order
  const attributeConfig = [
    { key: 'head', label: 'Head', icon: 'head' },
    { key: 'eyes', label: 'Eyes', icon: 'eyes' },
    { key: 'mouth', label: 'Mouth', icon: 'mouth' },
    { key: 'clothes', label: 'Clothes', icon: 'clothes' },
    { key: 'hands', label: 'Hands', icon: 'hands' },
    { key: 'background', label: 'Background', icon: 'background' }
  ];

  // Enhanced download handler with error handling
  const handleDownload = useCallback(async () => {
    // Check if character has at least one attribute
    const hasAttributes = Object.values(selectedAttributes).some(attr => attr);
    
    if (!hasAttributes) {
      setDownloadError('Please select at least one character attribute before downloading.');
      setTimeout(() => setDownloadError(null), 5000);
      return;
    }

    try {
      setIsDownloading(true);
      setDownloadError(null);
      
      await downloadAsPNG(selectedAttributes);
      
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadError('Download failed. Please try again.');
      setTimeout(() => setDownloadError(null), 5000);
    } finally {
      setIsDownloading(false);
    }
  }, [selectedAttributes]);

  // Simplified reset handler - no confirmation
  const handleReset = useCallback(() => {
    resetSelections();
    
    // Focus feedback
    const button = document.activeElement;
    if (button) {
      button.style.backgroundColor = '#6930c3';
      button.style.color = 'white';
      button.textContent = 'Reset Complete!';
      setTimeout(() => {
        button.style.backgroundColor = '';
        button.style.color = '';
        button.textContent = 'Reset to Default';
      }, 1500);
    }
  }, [resetSelections]);

  // Smooth & instant randomize handler ✨
  const handleRandomize = useCallback(() => {
    const button = document.activeElement;
    if (button && !button.classList.contains('randomizing')) {
      // Add tactile feedback for mobile devices
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
      
      // Add randomizing class for animation
      button.classList.add('randomizing');
      
      // Trigger randomization instantly - no delay!
      randomizeSelections();
      
      // Remove animation class after animation completes
      setTimeout(() => {
        button.classList.remove('randomizing');
      }, 600);
    }
  }, [randomizeSelections]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e, action) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  }, []);

  return (
    <LeftPanel role="region" aria-label="Selected Character Attributes">
      {/* Header */}
      <div style={{
        marginBottom: '15px',
        textAlign: 'center',
        borderBottom: '2px solid var(--border-light)',
        paddingBottom: '10px'
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '16px',
          fontWeight: '700',
          color: 'var(--text-primary)'
        }}>
          Current Selection
        </h3>
      </div>

      {/* Selected attributes list */}
      <div role="list" aria-label="Selected character attributes">
        {attributeConfig.map(({ key, label, icon }) => {
          const attributeName = getSelectedName(key);
          const isSelected = selectedAttributes[key];
          
          // Truncate long attribute names to fit the fixed width
          const truncatedName = attributeName.length > 9 
            ? attributeName.substring(0, 9) + '...' 
            : attributeName;
          
          return (
            <SelectedAttribute 
              key={key}
              role="listitem"
              style={{
                opacity: isSelected ? 1 : 0.6,
                transition: 'opacity 0.2s ease'
              }}
            >
              <div aria-hidden="true">
                {renderIcon(icon)}
              </div>
              <AttributeName>{label}</AttributeName>
              <AttributeValue 
                title={attributeName}
                aria-label={`${label}: ${attributeName}`}
              >
                {truncatedName}
              </AttributeValue>
            </SelectedAttribute>
          );
        })}
      </div>
      
      {/* Action buttons */}
      <ActionButtons role="group" aria-label="Character actions">
        <RandomizeButton 
          onClick={handleRandomize}
          onKeyDown={(e) => handleKeyDown(e, handleRandomize)}
          aria-label="Randomize all character attributes"
          title="Generate a random character"
          tabIndex={0}
        >
          <svg 
            width="16" 
            height="16" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="6" height="6" rx="1"/>
            <rect x="15" y="3" width="6" height="6" rx="1"/>
            <rect x="3" y="15" width="6" height="6" rx="1"/>
            <rect x="15" y="15" width="6" height="6" rx="1"/>
            <circle cx="6" cy="6" r="1" fill="currentColor"/>
            <circle cx="18" cy="6" r="1" fill="currentColor"/>
            <circle cx="6" cy="18" r="1" fill="currentColor"/>
            <circle cx="18" cy="18" r="1" fill="currentColor"/>
          </svg>
          RANDOMIZE
        </RandomizeButton>
        
        <ResetButton 
          onClick={handleReset}
          onKeyDown={(e) => handleKeyDown(e, handleReset)}
          aria-label="Reset all attributes to default"
          title="Reset to default character"
          tabIndex={0}
        >
          Reset to Default
        </ResetButton>
        
        <DownloadButton 
          onClick={handleDownload}
          onKeyDown={(e) => handleKeyDown(e, handleDownload)}
          disabled={isDownloading}
          aria-label={isDownloading ? 'Downloading character...' : 'Download character as PNG'}
          title="Download your character as a high-quality PNG image"
          tabIndex={0}
          style={{
            opacity: isDownloading ? 0.7 : 1,
            cursor: isDownloading ? 'not-allowed' : 'pointer'
          }}
        >
          {isDownloading ? (
            <>
              <div 
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #fff',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginRight: '8px'
                }}
                aria-hidden="true"
              />
              DOWNLOADING...
            </>
          ) : (
            <>
              <svg 
                width="16" 
                height="16" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M12 16l-5-5h3V4h4v7h3l-5 5z" fill="currentColor" />
                <path d="M20 18H4v2h16v-2z" fill="currentColor" />
              </svg>
              DOWNLOAD
            </>
          )}
        </DownloadButton>
      </ActionButtons>

      {/* Error display */}
      {downloadError && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            marginTop: '10px',
            padding: '8px 12px',
            backgroundColor: 'rgba(231, 76, 60, 0.1)',
            color: '#e74c3c',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '500',
            textAlign: 'center',
            border: '1px solid rgba(231, 76, 60, 0.2)'
          }}
        >
          {downloadError}
        </div>
      )}
    </LeftPanel>
  );
}; 