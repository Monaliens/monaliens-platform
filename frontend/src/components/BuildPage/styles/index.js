import styled, { keyframes, css } from 'styled-components';

// Animations
export const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

export const slideUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
`;

// SMOOTH & CONTINUOUS RANDOMIZE ANIMATIONS! ✨
const smoothSpin = keyframes`
  0% { 
    transform: rotate(0deg) scale(1);
  }
  50% { 
    transform: rotate(180deg) scale(1.05);
  }
  100% { 
    transform: rotate(360deg) scale(1);
  }
`;

const softGlow = keyframes`
  0% { 
    background: linear-gradient(135deg, #6930c3, #8b5cf6);
    box-shadow: 0 4px 15px rgba(105, 48, 195, 0.3);
  }
  50% { 
    background: linear-gradient(135deg, #8b5cf6, #a855f7);
    box-shadow: 0 6px 20px rgba(139, 92, 246, 0.5);
  }
  100% { 
    background: linear-gradient(135deg, #6930c3, #8b5cf6);
    box-shadow: 0 4px 15px rgba(105, 48, 195, 0.3);
  }
`;

const iconRotate = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

// Main container - Enhanced responsive
export const BuildContainer = styled.div`
  padding: 30px 20px;
  max-width: 1600px;
  margin: 0 auto;
  min-height: 100vh;
  transform: translateZ(0); /* GPU acceleration */
  
  @media (max-width: 1200px) {
    padding: 20px 15px;
  }
  
  @media (max-width: 768px) {
    padding: 15px 10px;
  }
  
  @media (max-width: 480px) {
    padding: 10px 5px;
  }
`;

export const BuildTitle = styled.h1`
  font-size: clamp(24px, 5vw, 48px);
  text-align: center;
  margin-bottom: 30px;
  font-weight: 700;
  color: var(--text-primary);
  opacity: 0;
  animation: ${slideUp} 0.8s ease-out forwards;
  animation-delay: 0.3s;
  
  @media (max-width: 768px) {
    margin-bottom: 20px;
  }
`;

export const BuildInterface = styled.div`
  display: grid;
  grid-template-columns: 0.4fr 1.2fr 1fr;
  gap: 20px;
  transform: translateZ(0); /* GPU acceleration */
  
  @media (max-width: 1200px) {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto auto;
    gap: 15px;
    
    /* Left panel spans full width on tablet */
    section:first-child {
      grid-column: 1 / -1;
      order: 1;
    }
    
    /* Preview in the middle */
    section:nth-child(2) {
      grid-column: 1;
      order: 2;
    }
    
    /* Tabs on the right */
    section:nth-child(3) {
      grid-column: 2;
      order: 3;
    }
  }
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 15px;
    
    section {
      grid-column: 1 !important;
      order: initial !important;
    }
  }
`;

// Left panel styles - static for performance
export const LeftPanel = styled.div`
  background-color: var(--bg-card);
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0px 6px 20px var(--shadow-color);
  border: 1px solid var(--border-light);
  height: 600px;
  overflow-y: auto;
  transform: translateZ(0);
  will-change: auto;
  
  @media (max-width: 768px) {
    border-radius: 16px;
    padding: 16px;
    height: 500px;
  }
  
  @media (max-width: 480px) {
    border-radius: 12px;
    padding: 12px;
    height: 400px;
  }
`;

// Static components for performance - no conditional styles
export const SelectedAttribute = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding: 8px;
  border-radius: 10px;
  background-color: var(--bg-secondary);
  transform: translateZ(0);

  svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    color: var(--text-primary);
  }

  img {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  /* Dark mode: invert PNG icons to white */
  [data-theme="dark"] & img {
    filter: brightness(0) invert(1);
  }
  
  @media (max-width: 768px) {
    gap: 6px;
    padding: 6px;
    margin-bottom: 8px;
    border-radius: 8px;
    
    svg, img {
      width: 18px;
      height: 18px;
    }
  }
`;

export const AttributeName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  width: 65px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  
  @media (max-width: 768px) {
    font-size: 13px;
    width: 60px;
  }
  
  @media (max-width: 480px) {
    font-size: 12px;
    width: 55px;
  }
`;

export const AttributeValue = styled.span`
  font-size: 12px;
  color: var(--text-secondary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  
  @media (max-width: 480px) {
    font-size: 11px;
  }
`;

// Action buttons with static styles
export const ActionButtons = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 20px;
  
  @media (max-width: 768px) {
    gap: 6px;
    margin-top: 16px;
  }
`;

// Base button styles - static to prevent re-compilation
const baseButtonStyles = css`
  width: 100%;
  padding: 12px 16px;
  border: none;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transform: translateZ(0);
  
  &:hover {
    transform: translateY(-1px) translateZ(0);
  }
  
  &:active {
    transform: translateY(0) translateZ(0);
  }
  
  @media (max-width: 768px) {
    padding: 10px 14px;
    font-size: 11px;
  }
  
  @media (max-width: 480px) {
    padding: 8px 12px;
    font-size: 10px;
  }
`;

// �� PERFORMANCE BOOST: Variant-based styling instead of prop-based
export const AttributeTab = styled.div.attrs(props => ({
  'data-variant': props.$active ? 'active' : 'inactive',
  'data-tab': props.$tabType || ''
}))`
  position: relative;
  flex: 1;
  background-color: transparent;
  border: none;
  border-radius: 8px;
  padding: 12px 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  z-index: 2;
  text-align: center;
  user-select: none;
  transform: translateZ(0);
  
  /* ✅ VARIANT-BASED: No prop calculations */
  &[data-variant="inactive"] {
    color: var(--text-secondary);
  }

  &[data-variant="active"] {
    color: var(--text-on-accent);
    
    svg, img {
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
      transform: scale(1.05) translateZ(0);
    }
  }
  
  svg, img {
    width: 18px;
    height: 18px;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    filter: none;
    transform: scale(1) translateZ(0);
  }
  
  /* Responsive text handling with CSS - no JS runtime calculations */
  .tab-text-full { display: inline; }
  .tab-text-short { display: none; }
  
  &:hover[data-variant="inactive"] {
    color: var(--text-primary);
    transform: translateY(-1px) translateZ(0);
  }
  
  &:active { transform: translateZ(0); }
  
  @media (max-width: 768px) {
    padding: 8px 4px;
    font-size: 10px;
    gap: 2px;
    
    svg, img { width: 16px; height: 16px; }
  }
  
  @media (max-width: 480px) {
    padding: 6px 2px;
    font-size: 9px;
    
    svg, img { width: 14px; height: 14px; }
    .tab-text-full { display: none; }
    .tab-text-short { display: inline; }
  }
`;

export const AttributeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  background-color: var(--bg-card);
  padding: 8px;
  margin: 0 8px 8px 8px;
  flex: 1;
  overflow-y: auto;
  transform: translateZ(0);
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    padding: 6px;
    margin: 0 6px 6px 6px;
    gap: 6px;
  }
  
  @media (max-width: 480px) {
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    padding: 4px;
    margin: 0 4px 4px 4px;
    gap: 4px;
  }
`;

export const AttributeOption = styled.div.attrs(() => ({
  'data-selectable': 'true'
}))`
  background-color: var(--bg-secondary);
  border: 2px solid transparent;
  border-radius: 12px;
  padding: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  transform: translateZ(0);

  /* ✅ CSS-ONLY STATES: No prop dependencies */
  &.selected {
    background-color: var(--bg-glass);
    border-color: var(--accent-primary);
  }

  &:hover {
    border-color: var(--accent-primary);
    background-color: var(--bg-glass);
    transform: translateY(-2px) translateZ(0);

    &.selected { background-color: var(--bg-glass); }
  }
  
  &:active { transform: translateY(0) translateZ(0); }
  
  @media (max-width: 768px) {
    border-radius: 8px;
    padding: 4px;
  }
`;

export const AttributeImage = styled.div`
  position: relative;
  width: 100%;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 4px;
  background: transparent;
  transform: translateZ(0);
  
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    position: absolute;
    transform: translateZ(0);
    
    &.body-base {
      opacity: 1;
    }
  }
  
  @media (max-width: 768px) {
    height: 100px;
    border-radius: 6px;
    margin-bottom: 3px;
  }
  
  @media (max-width: 480px) {
    height: 80px;
    border-radius: 4px;
    margin-bottom: 2px;
  }
`;

export const AttributeLabel = styled.div`
  font-size: 10px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  word-break: break-word;
  display: block;
  line-height: 1.2;
  transform: translateZ(0);

  .selected & {
    color: var(--accent-primary);
  }
  
  @media (max-width: 480px) {
    font-size: 9px;
  }
`;

export const RandomizeButton = styled.button.attrs(props => ({
  'data-state': props.$isRandomizing ? 'randomizing' : 'idle'
}))`
  ${baseButtonStyles}
  background: linear-gradient(135deg, #6930c3, #8b5cf6);
  color: var(--text-light);
  position: relative;
  
  /* ✅ VARIANT-BASED: Static CSS transitions */
  &[data-state="idle"] {
    animation: none;
    pointer-events: auto;
    
    &:hover {
      background: linear-gradient(135deg, #5a2ba6, #7c3aed);
      transform: translateY(-2px) translateZ(0);
      box-shadow: 0 8px 25px rgba(105, 48, 195, 0.4);
      
      svg { transform: scale(1.05); }
    }
  }
  
  &[data-state="randomizing"] {
    animation: 
      ${smoothSpin} 0.4s linear forwards,
      ${softGlow} 0.4s ease-in-out forwards;
    pointer-events: none;
    
    svg { animation: ${iconRotate} 0.4s linear forwards; }
  }
  
  &:focus-visible {
    outline: 3px solid rgba(105, 48, 195, 0.3);
    outline-offset: 2px;
  }
`;

export const ResetButton = styled.button`
  ${baseButtonStyles}
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-light);

  &:hover {
    background: var(--bg-glass);
    transform: translateY(-1px) translateZ(0);
  }
`;

export const DownloadButton = styled.button`
  ${baseButtonStyles}
  background: var(--text-primary);
  color: var(--bg-card);

  &:hover {
    background: var(--text-secondary);
    transform: translateY(-1px) translateZ(0);
  }
`;

// Preview area - static styles
export const PreviewArea = styled.div`
  position: relative;
  width: 100%;
  height: 600px;
  max-width: 600px;
  margin: 0 auto;
  border-radius: 20px;
  overflow: hidden;
  background: var(--bg-secondary);
  box-shadow: 0px 8px 25px var(--shadow-color);
  border: 2px solid var(--border-light);
  transform: translateZ(0);
  will-change: auto;
  
  @media (max-width: 768px) {
    border-radius: 16px;
    height: 500px;
    max-width: 500px;
  }
  
  @media (max-width: 480px) {
    border-radius: 12px;
    height: 400px;
    max-width: 400px;
  }
`;

export const ImageLayer = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  transform: translateZ(0);
`;

// Right panel styles - static
export const RightPanel = styled.div`
  background-color: var(--bg-card);
  border-radius: 20px;
  box-shadow: 0px 6px 20px var(--shadow-color);
  border: 1px solid var(--border-light);
  overflow: hidden;
  height: 600px;
  display: flex;
  flex-direction: column;
  transform: translateZ(0);
  will-change: auto;
  
  @media (max-width: 768px) {
    border-radius: 16px;
    height: 500px;
  }
  
  @media (max-width: 480px) {
    border-radius: 12px;
    height: 400px;
  }
`;

export const AttributeTabsContainer = styled.div`
  position: relative;
  background-color: var(--bg-card);
  display: flex;
  flex-direction: column;
  transform: translateZ(0);
`;

export const AttributeTabsBar = styled.div`
  position: relative;
  display: flex;
  background: var(--bg-secondary);
  border-radius: 16px;
  margin: 8px 8px 4px 8px;
  padding: 3px;
  transform: translateZ(0);
  flex-shrink: 0;
  
  @media (max-width: 768px) {
    border-radius: 12px;
    margin: 6px 6px 3px 6px;
    padding: 3px;
  }
  
  @media (max-width: 480px) {
    border-radius: 8px;
    margin: 4px 4px 2px 4px;
    padding: 3px;
  }
`;

// Optimized tab indicator - use CSS variables to reduce styled-components re-compilation
export const AttributeTabIndicator = styled.div`
  position: absolute;
  top: 4px;
  height: calc(100% - 8px);
  width: calc((100% - 8px) / 6); /* Fixed for 6 tabs */
  background: linear-gradient(135deg, #6930c3 0%, #8b5cf6 50%, #a855f7 100%);
  border-radius: 8px;
  transition: left 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1;
  box-shadow: 
    0 4px 12px rgba(105, 48, 195, 0.4),
    0 2px 4px rgba(105, 48, 195, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  will-change: left;
  transform: translateZ(0);
  
  /* Use CSS custom property for position - less re-compilation */
  left: var(--tab-position, calc(4px + 0 * (100% - 8px) / 6));
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, transparent 50%);
    border-radius: 8px;
    pointer-events: none;
  }
  
  @media (max-width: 768px) {
    top: 3px;
    height: calc(100% - 6px);
    width: calc((100% - 6px) / 6);
    border-radius: 6px;
    left: var(--tab-position-mobile, calc(3px + 0 * (100% - 6px) / 6));
  }
`; 