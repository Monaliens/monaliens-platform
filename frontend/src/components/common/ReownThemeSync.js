import { useEffect, useCallback, useRef } from 'react';
import { useAppKitTheme } from '@reown/appkit/react';
import { useTheme } from '../../context/ThemeContext';

// Retry delays in ms - try a few times then stop
const RETRY_DELAYS = [100, 300, 500, 1000];

/**
 * Component that syncs our app theme with Reown AppKit theme
 * Must be rendered inside both ThemeProvider and ReownContextProvider
 */
export const ReownThemeSync = () => {
  const { isDarkMode } = useTheme();
  const { setThemeMode } = useAppKitTheme();
  const timeoutsRef = useRef([]);

  // Force text color in Shadow DOM on hover
  // Returns true if successful, false if button not found
  const applyStyles = useCallback(() => {
    const appkitButton = document.querySelector('appkit-button');
    if (!appkitButton?.shadowRoot) return false;

    const accountButton = appkitButton.shadowRoot.querySelector('appkit-account-button');
    if (!accountButton?.shadowRoot) return false;

    const wuiAccountButton = accountButton.shadowRoot.querySelector('wui-account-button');
    if (!wuiAccountButton?.shadowRoot) return false;

    const button = wuiAccountButton.shadowRoot.querySelector('button');
    if (!button) return false;

    const textColor = isDarkMode ? '#ffffff' : '#000000';

    // Override hover styles and add purple border
    const style = document.createElement('style');
    style.textContent = `
      button {
        border: 2px solid #8b5cf6 !important;
        border-radius: 100px !important;
      }
      button:hover wui-text,
      button:hover wui-flex wui-text,
      wui-text {
        color: ${textColor} !important;
        --wui-color-fg-200: ${textColor} !important;
        --wui-color-fg-100: ${textColor} !important;
      }
    `;

    // Remove old style if exists
    const existingStyle = wuiAccountButton.shadowRoot.querySelector('style[data-theme-override]');
    if (existingStyle) existingStyle.remove();

    style.setAttribute('data-theme-override', 'true');
    wuiAccountButton.shadowRoot.appendChild(style);
    return true;
  }, [isDarkMode]);

  useEffect(() => {
    // Clear any pending retries from previous theme change
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    // Sync Reown theme with app theme
    setThemeMode(isDarkMode ? 'dark' : 'light');

    // Try to apply styles immediately
    if (applyStyles()) {
      return; // Success, no retries needed
    }

    // If button not ready yet, retry a few times with increasing delays
    RETRY_DELAYS.forEach((delay) => {
      const timeoutId = setTimeout(() => {
        applyStyles(); // Try again, ignore result
      }, delay);
      timeoutsRef.current.push(timeoutId);
    });

    // Cleanup timeouts on unmount or theme change
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, [isDarkMode, setThemeMode, applyStyles]);

  return null;
};

export default ReownThemeSync;
