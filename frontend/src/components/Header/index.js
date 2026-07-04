import React, { useState, useCallback, memo, useRef, useEffect } from 'react';
import { SITE_UNDER_MAINTENANCE } from '../../config/siteMaintenance';
import { HeaderWrapper, HeaderContainer, HeaderMainRow, LeftSection, RightSection, GameModeBadge, HeaderThemeToggleSlot } from './styles';
import Logo from './components/Logo';
import NavigationMenu from './components/NavigationMenu';
import WalletControls from './components/WalletControls';
import MobileMenu, { MobileMenuHamburger } from './components/MobileMenu';
import ToastNotification from './components/ToastNotification';
import ThemeToggle from './components/ThemeToggle';
import SoundToggle from './components/SoundToggle';
import { useGameWallet } from '../../context';

/**
 * Header Component (Composition Root)
 * Single Responsibility: Coordinate all header components
 * Follows SOLID principles with modular architecture
 * 
 * @returns {JSX.Element} Rendered header with all sub-components
 */
const Header = memo(() => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const { isUsingGameWallet } = useGameWallet();
  
  const activeTimeoutsRef = useRef(new Set());

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(prev => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  const showToast = useCallback((message) => {
    const toastId = Date.now();
    const newToast = { id: toastId, message };
    
    setToasts(prev => [...prev, newToast]);
    
    const timeoutId = setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== toastId));
      activeTimeoutsRef.current.delete(timeoutId);
    }, 3000);
    
    activeTimeoutsRef.current.add(timeoutId);
  }, []);

  // 🧹 CLEANUP: Clear all timeouts on unmount
  useEffect(() => {
    return () => {
      activeTimeoutsRef.current.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      activeTimeoutsRef.current.clear();
    };
  }, []);

  const handleDisabledItemClick = useCallback((pageName) => {
    showToast(
      SITE_UNDER_MAINTENANCE
        ? `${pageName} is under maintenance.`
        : `${pageName} page is coming soon!`,
    );
  }, [showToast]);

  return (
    <>
      <HeaderWrapper>
        <HeaderContainer $gameMode={isUsingGameWallet}>
          {isUsingGameWallet && <GameModeBadge>Game Mode</GameModeBadge>}
          <HeaderMainRow>
            <LeftSection>
              <Logo />
            </LeftSection>
            <NavigationMenu onDisabledItemClick={handleDisabledItemClick} />
            <RightSection>
              <WalletControls />
              <HeaderThemeToggleSlot>
                <ThemeToggle />
                <SoundToggle />
              </HeaderThemeToggleSlot>
              <MobileMenuHamburger
                onToggle={toggleMobileMenu}
                isOpen={isMobileMenuOpen}
              />
            </RightSection>
          </HeaderMainRow>
          <MobileMenu
            isOpen={isMobileMenuOpen}
            onItemClick={closeMobileMenu}
            onDisabledItemClick={handleDisabledItemClick}
          />
        </HeaderContainer>
      </HeaderWrapper>

      <ToastNotification toasts={toasts} />
    </>
  );
});

Header.displayName = 'Header';

export default Header; 