import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  isSoundEnabled,
  setSoundEnabled,
  subscribeSoundEnabled,
  toggleSoundEnabled,
} from '../utils/soundSettings';

const SoundContext = createContext(null);

export const SoundProvider = ({ children }) => {
  const [isSoundOn, setIsSoundOn] = useState(() => isSoundEnabled());

  useEffect(() => {
    return subscribeSoundEnabled(setIsSoundOn);
  }, []);

  const setSoundOn = useCallback((enabled) => {
    setIsSoundOn(setSoundEnabled(enabled));
  }, []);

  const toggleSound = useCallback(() => {
    setIsSoundOn(toggleSoundEnabled());
  }, []);

  const value = useMemo(() => ({
    isSoundOn,
    setSoundOn,
    toggleSound,
  }), [isSoundOn, setSoundOn, toggleSound]);

  return (
    <SoundContext.Provider value={value}>
      {children}
    </SoundContext.Provider>
  );
};

export const useSound = () => {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
};

export default SoundContext;
