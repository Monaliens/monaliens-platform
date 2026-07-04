import React, { memo } from 'react';
import { useSound } from '../../../context/SoundContext';
import { ThemeToggleButton } from '../styles';

const SoundOnIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

const SoundOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

const SoundToggle = memo(() => {
  const { isSoundOn, toggleSound } = useSound();

  return (
    <ThemeToggleButton
      type="button"
      onClick={toggleSound}
      aria-pressed={isSoundOn}
      aria-label={isSoundOn ? 'Mute game sounds' : 'Unmute game sounds'}
      title={isSoundOn ? 'Game sounds on' : 'Game sounds off'}
      $active={isSoundOn}
    >
      {isSoundOn ? <SoundOnIcon /> : <SoundOffIcon />}
    </ThemeToggleButton>
  );
});

SoundToggle.displayName = 'SoundToggle';

export default SoundToggle;
