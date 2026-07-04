import { createGlobalStyle } from 'styled-components';
import RecoletaFont from '../assets/fonts/Recoleta.otf';
import AvertaFont from '../assets/fonts/Averta.otf';
import LexendRegular from '../assets/fonts/Lexend-Regular.6da6431a76b62006dd10.ttf';
import LexendMedium from '../assets/fonts/Lexend-Medium.fe610661c5c535a4a394.ttf';
import LexendBold from '../assets/fonts/Lexend-Bold.db264efcc7fd48090485.ttf';
import LexendBlack from '../assets/fonts/Lexend-Black.0cd8deec7bfda86843a2.ttf';
import LexendVariable from '../assets/fonts/Lexend-VariableFont_wght.8c2b86fea1234bcd4234.ttf';
import LuckiestGuy from '../assets/fonts/LuckiestGuy-Regular.ttf';
import Mikan from '../assets/fonts/Mikan.ttf';

const GlobalStyles = createGlobalStyle`
  :root {
    --font-primary: 'Lexend', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-system: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

    /* Light mode colors (default) */
    --bg-primary: #f5f5f5;
    --bg-secondary: #ffffff;
    --bg-tertiary: #f3f3f3;
    --bg-card: rgba(255, 255, 255, 0.95);
    --bg-card-hover: rgba(255, 255, 255, 0.98);
    --bg-glass: rgba(255, 255, 255, 0.45);
    --bg-glass-hover: rgba(255, 255, 255, 0.65);
    --bg-overlay: rgba(247, 247, 247, 0.6);

    --text-primary: #1f2937;
    --text-secondary: #6b7280;
    --text-tertiary: #9ca3af;
    --text-light: #ffffff;
    --text-muted: #9ca3af;

    --border-color: rgba(105, 48, 195, 0.35);
    --border-color-hover: rgba(105, 48, 195, 0.55);
    --border-light: rgba(105, 48, 195, 0.1);

    --shadow-color: rgba(105, 48, 195, 0.1);
    --shadow-hover: rgba(105, 48, 195, 0.18);

    --accent-primary: #6930c3;
    --accent-secondary: #8b5cf6;
    --accent-blue: #2563eb;
    --accent-green: #16a34a;
    --accent-orange: #ea580c;
    --accent-red: #dc2626;

    --header-bg: #ffffff;
    --dropdown-bg: white;
    --scrollbar-track: #f1f1f1;
    --scrollbar-thumb: #888;
    --scrollbar-thumb-hover: #555;

    /* Additional UI colors */
    --overlay-bg: rgba(0, 0, 0, 0.5);
    --overlay-bg-heavy: rgba(0, 0, 0, 0.7);
    --input-bg: rgba(255, 255, 255, 0.95);
    --input-border: rgba(105, 48, 195, 0.2);
    --input-border-focus: #2563eb;
    --placeholder-color: #9ca3af;
    --selection-bg: #6930c3;
    --selection-text: white;
    --divider-color: rgba(105, 48, 195, 0.1);
    --card-border: rgba(105, 48, 195, 0.35);
    --success-bg: rgba(22, 163, 74, 0.1);
    --error-bg: rgba(220, 38, 38, 0.1);
    --warning-bg: rgba(234, 88, 12, 0.1);
    --info-bg: rgba(37, 99, 235, 0.1);
    --badge-bg: rgba(255, 255, 255, 0.9);
    --tooltip-bg: rgba(31, 41, 55, 0.95);
    --tooltip-text: #ffffff;
    --disabled-bg: #f3f4f6;
    --disabled-text: #9ca3af;
    --table-header-bg: rgba(105, 48, 195, 0.05);
    --table-row-hover: rgba(105, 48, 195, 0.03);
    --modal-bg: rgba(255, 255, 255, 0.98);
  }

  /* Dark mode colors */
  [data-theme="dark"] {
    --bg-primary: #0a0a0f;
    --bg-secondary: #12121a;
    --bg-tertiary: #1a1a24;
    --bg-card: rgba(18, 18, 26, 0.95);
    --bg-card-hover: rgba(25, 25, 35, 0.98);
    --bg-glass: rgba(18, 18, 26, 0.75);
    --bg-glass-hover: rgba(25, 25, 35, 0.85);
    --bg-overlay: rgba(10, 10, 15, 0.6);

    --text-primary: #f0f0f5;
    --text-secondary: #a0a0b0;
    --text-tertiary: #6b6b7b;
    --text-light: #ffffff;
    --text-muted: #6b6b7b;

    --border-color: rgba(130, 80, 200, 0.35);
    --border-color-hover: rgba(130, 80, 200, 0.55);
    --border-light: rgba(130, 80, 200, 0.15);

    --shadow-color: rgba(0, 0, 0, 0.3);
    --shadow-hover: rgba(130, 80, 200, 0.15);

    --accent-primary: #8b5cf6;
    --accent-secondary: #a78bfa;
    --accent-blue: #3b82f6;
    --accent-green: #22c55e;
    --accent-orange: #f97316;
    --accent-red: #ef4444;

    --header-bg: #12121a;
    --dropdown-bg: #1a1a24;
    --scrollbar-track: #1a1a24;
    --scrollbar-thumb: #3a3a4a;
    --scrollbar-thumb-hover: #5a5a6a;

    /* Additional UI colors - dark mode */
    --overlay-bg: rgba(0, 0, 0, 0.7);
    --overlay-bg-heavy: rgba(0, 0, 0, 0.85);
    --input-bg: rgba(25, 25, 35, 0.95);
    --input-border: rgba(130, 80, 200, 0.25);
    --input-border-focus: #8b5cf6;
    --placeholder-color: #6b6b7b;
    --selection-bg: #8b5cf6;
    --selection-text: white;
    --divider-color: rgba(130, 80, 200, 0.15);
    --card-border: rgba(130, 80, 200, 0.35);
    --success-bg: rgba(34, 197, 94, 0.15);
    --error-bg: rgba(239, 68, 68, 0.15);
    --warning-bg: rgba(249, 115, 22, 0.15);
    --info-bg: rgba(59, 130, 246, 0.15);
    --badge-bg: rgba(25, 25, 35, 0.9);
    --tooltip-bg: rgba(40, 40, 55, 0.95);
    --tooltip-text: #f0f0f5;
    --disabled-bg: #1a1a24;
    --disabled-text: #4a4a5a;
    --table-header-bg: rgba(130, 80, 200, 0.08);
    --table-row-hover: rgba(130, 80, 200, 0.05);
    --modal-bg: rgba(18, 18, 26, 0.98);
  }

  @font-face {
    font-family: 'Lexend';
    src: url(${LexendVariable}) format('truetype');
    font-weight: 100 900;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'Lexend';
    src: url(${LexendRegular}) format('truetype');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'Lexend';
    src: url(${LexendMedium}) format('truetype');
    font-weight: 500;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'Lexend';
    src: url(${LexendBold}) format('truetype');
    font-weight: 700;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'Lexend';
    src: url(${LexendBlack}) format('truetype');
    font-weight: 900;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'Recoleta';
    src: url(${RecoletaFont}) format('opentype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'Averta';
    src: url(${AvertaFont}) format('opentype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'Luckiest Guy';
    src: url(${LuckiestGuy}) format('truetype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'Mikan';
    src: url(${Mikan}) format('opentype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }

  /* Essential animations for loading states */
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    transition: background-color 0.3s ease, 
                border-color 0.3s ease,
                box-shadow 0.3s ease;
  }

  html {
    font-family: var(--font-system);
    -webkit-text-size-adjust: 100%;
    -ms-text-size-adjust: 100%;
  }

  /* Optimized font loading - prevent re-render cascade */
  .app-root {
    font-family: var(--font-system);
    transition: none;
  }

  .app-root.fonts-stable,
  .fonts-loaded {
    font-family: var(--font-primary) !important;
  }

  /* Only disable transitions for text elements, not layout elements */
  // .fonts-loaded h1,
  // .fonts-loaded h2,
  // .fonts-loaded h3,
  // .fonts-loaded h4,
  // .fonts-loaded h5,
  // .fonts-loaded h6,
  // .fonts-loaded p,
  // .fonts-loaded span,
  // .fonts-loaded div[class*="text"],
  // .fonts-loaded div[class*="label"],
  // .fonts-loaded div[class*="title"] {
  //   transition: none !important;
  // }

  body {
    font-family: var(--font-system);
    background-color: var(--bg-primary);
    color: var(--text-primary);
    min-height: 100vh;
    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    will-change: auto;
    transition: background-color 0.3s ease, 
                border-color 0.3s ease,
                box-shadow 0.3s ease;
  }

  /* Stable font loading without re-render cascade */
  body.fonts-loaded {
    font-family: var(--font-primary);
  }
  
  h1, h2, h3, h4, h5, h6 {
    font-family: inherit;
    font-weight: 700;
    font-synthesis: none;
    will-change: auto;
  }

  a {
    text-decoration: none;
    color: inherit;
  }

  button {
    cursor: pointer;
    border: none;
    outline: none;
    font-family: inherit;
    will-change: auto;
  }
  
  input, textarea, select {
    font-family: inherit;
  }

  /* Prevent styled-components re-compilation */
  [data-styled] {
    will-change: auto;
    transform: translateZ(0); /* GPU acceleration */
  }
  
  /* Prevent layout shifts */
  #root {
    min-height: 100vh;
    will-change: auto;
  }
  
  /* Placeholder structure */
  ::placeholder {
    color: var(--placeholder-color);
    opacity: 1;
  }

  /* Selection color */
  ::selection {
    background-color: var(--selection-bg);
    color: var(--selection-text);
  }
  
  /* Scrollbar customization */
  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
    border-radius: 10px;
  }

  ::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 10px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }

  /* Performance optimizations - prevent re-render cascades */
  .no-transitions * {
    transition: none !important;
    animation: none !important;
  }

  /* Disable transitions only during initial page load to prevent flash */
  /* Theme transitions are now enabled for smooth animated switching */

  /* Reown AppKit button - sync with app theme */
  [data-theme="dark"] w3m-button,
  [data-theme="dark"] w3m-account-button,
  [data-theme="dark"] w3m-connect-button,
  [data-theme="dark"] appkit-button,
  [data-theme="dark"] appkit-account-button {
    --wui-color-fg-100: #ffffff !important;
    --wui-color-fg-150: #ffffff !important;
    --wui-color-fg-200: #e0e0e0 !important;
    --w3m-color-fg-1: #ffffff !important;
  }

  [data-theme="dark"] w3m-button,
  [data-theme="dark"] w3m-account-button,
  [data-theme="dark"] w3m-connect-button,
  [data-theme="dark"] appkit-button,
  [data-theme="dark"] appkit-account-button {
    --wui-color-gray-glass-005: transparent !important;
    --wui-color-gray-glass-010: transparent !important;
    --wui-color-gray-glass-015: transparent !important;
    --wui-color-gray-glass-020: transparent !important;
    /* Hover state - keep text white */
    --wui-color-fg-100: #ffffff !important;
    --wui-color-fg-150: #ffffff !important;
    --wui-color-fg-200: #e0e0e0 !important;
  }

  [data-theme="light"] w3m-button,
  [data-theme="light"] w3m-account-button,
  [data-theme="light"] w3m-connect-button,
  [data-theme="light"] appkit-button,
  [data-theme="light"] appkit-account-button {
    --wui-color-fg-100: #000000 !important;
    --wui-color-fg-150: #000000 !important;
    --wui-color-fg-200: #333333 !important;
    --w3m-color-fg-1: #000000 !important;
    /* Remove hover purple effect */
    --wui-color-gray-glass-005: transparent !important;
    --wui-color-gray-glass-010: transparent !important;
    --wui-color-gray-glass-015: transparent !important;
    --wui-color-gray-glass-020: transparent !important;
    /* Remove logo border */
    --wui-color-gray-glass-002: transparent !important;
  }

  /* Compact header: shrink main wallet row only when connected (not Connect Wallet CTA). */
  @media (max-width: 1200px) {
    .header-appkit-slot--account appkit-button,
    appkit-account-button {
      max-width: 100% !important;
      min-width: 0 !important;
      box-sizing: border-box !important;
    }
  }

  /* Stable render performance */
  .stable-render * {
    transform: translateZ(0);
    backface-visibility: hidden;
    perspective: 1000px;
  }

  /* Build page specific optimizations */
  .build-page-optimized * {
    will-change: auto;
    transform: translateZ(0);
  }
`;

export default GlobalStyles; 