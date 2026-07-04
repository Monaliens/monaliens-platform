import styled, { keyframes, css } from 'styled-components';

// Layout Components
export const HeaderWrapper = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 11;
  padding: 10px 60px;
  opacity: 1;
  transform: translateZ(0);
  
  @media (max-width: 768px) {
    padding: 5px 10px;
  }
`;

export const HeaderContainer = styled.header`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  padding: 15px 25px;
  background-color: var(--header-bg);
  border-radius: 16px;
  box-shadow: 0 2px 10px var(--shadow-color);
  max-width: 1600px;
  margin: 0 auto;
  transform: translateZ(0);
  transition: background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
  position: relative;
  border: 2px solid transparent;

  ${props => props.$gameMode && css`
    border-color: rgba(124, 58, 237, 0.6);
  `}

  @media (max-width: 1200px) {
    flex-direction: column;
    align-items: stretch;
    gap: 0;
  }

  @media (max-width: 768px) {
    padding: 10px 12px;
    width: 100%;
    border-radius: 10px;
  }
`;

/** Top bar: logo, desktop nav, wallet row — always one horizontal strip */
export const HeaderMainRow = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
  width: 100%;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 44px;
  gap: 8px;

  @media (max-width: 1200px) {
    gap: 6px;
  }

  @media (max-width: 768px) {
    gap: 6px;
  }
`;

// Navigation Components
export const Nav = styled.nav`
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  min-width: 0;
  gap: 0;

  @media (max-width: 1200px) {
    display: none;
  }
`;

export const NavItem = styled.div`
  margin: 0 15px;
  font-weight: 500;
  position: relative;
  white-space: nowrap;
  flex-shrink: 0;
  color: var(--text-primary);

  a {
    transition: color 0.2s ease;
    color: var(--text-primary);

    &:hover {
      color: var(--accent-primary);
    }
  }

  @media (max-width: 1300px) {
    margin: 0 10px;
  }

  @media (max-width: 1500px) {
    margin: 0 8px;
    font-size: 15px;
  }

  @media (max-width: 1100px) {
    margin: 0 6px;
    font-size: 14px;
  }
`;

// Nav item that hides on smaller desktop screens
export const NavItemHideable = styled(NavItem)`
  @media (max-width: 1100px) {
    display: none;
  }
`;

const livePulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.6;
  }
`;

const liveBounce = keyframes`
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 1px #ef4444, 0 0 2px rgba(239, 68, 68, 0.9);
  }
  50% {
    transform: scale(1.1);
    box-shadow: 0 0 2px #ef4444, 0 0 4px rgba(239, 68, 68, 0.95);
  }
`;

export const LiveBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: var(--text-light);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-radius: 4px;
  margin-left: 6px;
  position: relative;
  top: -1px;
  animation: ${liveBounce} 1s ease-in-out infinite;

  &::before {
    content: '';
    width: 5px;
    height: 5px;
    background: var(--text-light);
    border-radius: 50%;
    animation: ${livePulse} 1s ease-in-out infinite;
  }
`;

// Dropdown Components
export const MenuContainer = styled.div`
  position: relative;
  display: inline-block;

  &:hover button {
    color: var(--accent-primary);
  }
`;

export const DropdownMenu = styled.div`
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  min-width: 170px;
  background-color: var(--dropdown-bg);
  border-radius: 8px;
  box-shadow: 0 5px 15px var(--shadow-color);
  padding: 10px 0;
  margin-top: 2px;
  opacity: ${props => (props.$show ? '1' : '0')};
  visibility: ${props => (props.$show ? 'visible' : 'hidden')};
  transform: translateX(-50%) ${props => (props.$show ? 'translateY(0)' : 'translateY(-10px)')};
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1001;
  pointer-events: ${props => (props.$show ? 'auto' : 'none')};
  border: 1px solid var(--border-light);

  &:before {
    content: '';
    position: absolute;
    top: -8px;
    left: 0;
    right: 0;
    height: 10px;
    background: transparent;
  }

  &:after {
    content: '';
    position: absolute;
    top: -15px;
    left: -15px;
    right: -15px;
    bottom: -15px;
    background: transparent;
    z-index: -1;
  }
`;

export const DropdownMenuItem = styled.div`
  padding: 8px 15px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  opacity: ${props => props.disabled ? 0.6 : 1};
  white-space: nowrap;
  transition: background-color 0.2s;
  color: var(--text-primary);

  &:hover {
    background-color: ${props => props.disabled ? 'transparent' : 'var(--border-light)'};
  }

  a {
    color: inherit;
    text-decoration: none;
    display: block;
    width: 100%;
  }
`;

export const ToolsButton = styled.button`
  background: none;
  border: none;
  color: var(--text-primary);
  font: inherit;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s ease;
  position: relative;

  &:hover {
    color: var(--accent-primary);
  }
`;

// Mobile Components
export const MobileMenuToggle = styled.button`
  display: none;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 40px;
  height: 40px;
  order: 999;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  color: var(--text-primary);
  transform: translateY(-2px);

  @media (max-width: 1200px) {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 6px;
    padding: 0;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
  }

  @media (max-width: 480px) {
    margin-left: 4px;
    width: 34px;
    height: 34px;
  }
`;

export const MobileMenuSheet = styled.div`
  display: none;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;

  @media (max-width: 1200px) {
    display: block;
    max-height: ${props => (props.$open ? 'min(94vh, 820px)' : '0')};
    opacity: ${props => (props.$open ? 1 : 0)};
    padding: ${props => (props.$open ? '2px 25px 10px' : '0 25px')};
    overflow-y: ${props => (props.$open ? 'auto' : 'hidden')};
    pointer-events: ${props => (props.$open ? 'auto' : 'none')};
    -webkit-overflow-scrolling: touch;
    transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.24s ease,
      padding 0.24s ease;

    @media (max-width: 768px) {
      padding: ${props => (props.$open ? '2px 10px 8px' : '0 10px')};
    }
  }

  @media (min-width: 1201px) {
    display: none !important;
  }
`;

export const MobileMenuItem = styled.div`
  padding: 14px 8px;
  border-bottom: 1px solid var(--border-light);
  font-weight: 500;
  min-height: 44px;
  display: flex;
  align-items: center;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
  color: var(--text-primary);

  &:last-child {
    border-bottom: none;
  }

  a {
    color: inherit;
    text-decoration: none;
    display: block;
    width: 100%;
    padding: 2px 0;
  }

  &:active {
    background-color: var(--border-light);
  }

  &:hover {
    color: var(--accent-primary);
  }
`;

/** Theme row: label left, switch right (mobile menu). */
export const MobileMenuThemeRow = styled.div`
  padding: 14px 8px;
  border-top: 1px solid var(--border-light);
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-primary);
  font-weight: 500;
  font-size: inherit;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
`;

export const MobileThemeSwitch = styled.button`
  position: relative;
  width: 48px;
  height: 28px;
  border-radius: 14px;
  border: none;
  flex-shrink: 0;
  cursor: pointer;
  padding: 0;
  transition: background 0.2s ease;
  background: ${props => (props.$on ? '#7c3aed' : 'var(--border-light)')};
  -webkit-tap-highlight-color: transparent;

  &::after {
    content: '';
    position: absolute;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #ffffff;
    top: 3px;
    left: ${props => (props.$on ? '23px' : '3px')};
    transition: left 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  &:focus-visible {
    outline: 2px solid var(--accent-primary);
    outline-offset: 2px;
  }
`;

// Mobile Accordion Components
export const MobileAccordion = styled.div`
  border-bottom: 1px solid var(--border-light);

  &:last-child {
    border-bottom: none;
  }
`;

export const MobileAccordionHeader = styled.button`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 8px;
  min-height: 44px;
  background: none;
  border: none;
  font-weight: 500;
  font-size: inherit;
  font-family: inherit;
  cursor: pointer;
  color: var(--text-primary);
  transition: color 0.2s ease;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;

  &:active {
    background-color: var(--border-light);
  }

  &:hover {
    color: var(--accent-primary);
  }

  svg {
    width: 16px;
    height: 16px;
    transition: transform 0.3s ease;
    transform: ${props => props.$isOpen ? 'rotate(180deg)' : 'rotate(0deg)'};
  }
`;

export const MobileAccordionContent = styled.div`
  max-height: ${props => props.$isOpen ? '500px' : '0'};
  overflow: hidden;
  transition: max-height 0.3s ease;
  padding-left: 16px;

  ${MobileMenuItem} {
    padding: 4px 0;
    font-size: 11px;
    min-height: 30px;

    &:first-child {
      padding-top: 0;
    }

    &:last-child {
      padding-bottom: 12px;
      border-bottom: none;
    }
  }
`;

// Left Section (Logo wrapper for centering nav)
export const LeftSection = styled.div`
  display: flex;
  align-items: center;
  min-width: 180px;
  flex-shrink: 0;
  z-index: 1;

  @media (max-width: 768px) {
    min-width: auto;
  }
`;

// Right Section Components
export const RightSection = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0;
  opacity: 1;
  min-width: 180px;
  flex-shrink: 0;
  z-index: 1;

  @media (max-width: 1200px) {
    flex: 1;
    min-width: 0;
    gap: 4px;
    justify-content: flex-end;
  }

  @media (max-width: 768px) {
    min-width: 0;
    gap: 2px;
  }
`;

export const ConnectButton = styled.button`
  background-color: var(--accent-primary);
  color: var(--text-light);
  padding: 10px 20px;
  border-radius: 100px;
  font-weight: 600;
  transition: all 0.2s ease;
  border: none;
  cursor: pointer;
  opacity: 1;
  white-space: nowrap;

  &:hover {
    filter: brightness(1.1);
  }

  @media (max-width: 768px) {
    padding: 8px 16px;
    font-size: 14px;
  }
`;

// Toast animations
const toastSlideIn = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

export const ToastContainer = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
`;

export const Toast = styled.div`
  background: var(--tooltip-bg);
  color: var(--tooltip-text);
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 12px var(--shadow-color);
  animation: ${toastSlideIn} 0.3s ease-out;

  .icon {
    color: var(--accent-primary);
  }
`;

// Theme Toggle Button
export const ThemeToggleButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  color: var(--text-primary);
  opacity: ${props => props.$active === false ? 0.55 : 1};
  flex-shrink: 0;

  &:hover {
    background: var(--border-light);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }

  svg {
    width: 20px;
    height: 20px;
    transition: transform 0.3s ease;
  }

  &:hover svg {
    transform: rotate(15deg);
  }

  @media (max-width: 1200px) {
    padding: 6px;

    svg {
      width: 18px;
      height: 18px;
    }
  }
`;

// Game Mode Badge
const badgePulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
`;

/** Desktop / tablet header only — hidden when hamburger nav is used (theme lives in mobile menu). */
export const HeaderThemeToggleSlot = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;

  @media (max-width: 1200px) {
    display: none;
  }
`;

export const GameModeBadge = styled.div`
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
  color: white;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.4);
  animation: ${badgePulse} 2s ease-in-out infinite;
  white-space: nowrap;
  z-index: 10;

  @media (max-width: 768px) {
    font-size: 9px;
    padding: 3px 8px;
    top: -8px;
  }
`; 
