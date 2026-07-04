import React, { memo } from 'react';
import ReownContextProvider from './ReownContext';
import { BalanceFlashProvider, useBalanceFlash } from './BalanceFlashContext';
import { ThemeProvider, useTheme } from './ThemeContext';
import { SoundProvider, useSound } from './SoundContext';
import { GameWalletProvider, useGameWallet } from './GameWalletContext';
import { useReownWallet } from '../hooks/useReownWallet';
import { ReownThemeSync } from '../components/common/ReownThemeSync';

const ContextProvider = memo(function ContextProvider({ children }) {
  return (
    <ThemeProvider>
      <SoundProvider>
        <ReownContextProvider>
          <ReownThemeSync />
          <GameWalletProvider>
            <BalanceFlashProvider>
              {children}
            </BalanceFlashProvider>
          </GameWalletProvider>
        </ReownContextProvider>
      </SoundProvider>
    </ThemeProvider>
  );
});

// Export the Reown wallet hook with the same name for backward compatibility
export { useReownWallet as usePrivyOptimized };
export { useBalanceFlash };
export { useTheme };
export { useSound };
export { useGameWallet };
export default ContextProvider; 
