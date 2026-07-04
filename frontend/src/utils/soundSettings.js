const SOUND_SETTINGS_KEY = 'monaliens-game-sounds';
const SOUND_CHANGE_EVENT = 'monaliens:sound-settings-change';

const listeners = new Set();
const activeAudioElements = new Set();

const readStoredSoundEnabled = () => {
  if (typeof window === 'undefined') {
    return true;
  }

  try {
    const saved = window.localStorage.getItem(SOUND_SETTINGS_KEY);
    return saved === null ? true : saved !== 'off';
  } catch {
    return true;
  }
};

let soundEnabled = readStoredSoundEnabled();

const notifyListeners = () => {
  listeners.forEach(listener => {
    try {
      listener(soundEnabled);
    } catch {
      // Keep one bad listener from breaking the rest.
    }
  });
};

export const stopAllActiveSounds = () => {
  activeAudioElements.forEach(audio => {
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
    } catch {
      // Ignore cleanup errors from detached audio nodes.
    }
  });
  activeAudioElements.clear();
};

export const isSoundEnabled = () => soundEnabled;

export const setSoundEnabled = (enabled) => {
  const nextValue = Boolean(enabled);

  soundEnabled = nextValue;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SOUND_SETTINGS_KEY, nextValue ? 'on' : 'off');
    } catch {
      // Ignore localStorage failures; in-memory state still works.
    }

    window.dispatchEvent(new CustomEvent(SOUND_CHANGE_EVENT, {
      detail: { enabled: nextValue },
    }));
  }

  if (!nextValue) {
    stopAllActiveSounds();
  }

  notifyListeners();
  return nextValue;
};

export const toggleSoundEnabled = () => setSoundEnabled(!soundEnabled);

export const subscribeSoundEnabled = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const registerSoundElement = (audio) => {
  if (!audio) {
    return () => {};
  }

  activeAudioElements.add(audio);

  const cleanup = () => {
    activeAudioElements.delete(audio);
    audio.removeEventListener('ended', cleanup);
    audio.removeEventListener('pause', cleanup);
    audio.removeEventListener('emptied', cleanup);
    audio.removeEventListener('abort', cleanup);
  };

  audio.addEventListener('ended', cleanup, { once: true });
  audio.addEventListener('pause', cleanup, { once: true });
  audio.addEventListener('emptied', cleanup, { once: true });
  audio.addEventListener('abort', cleanup, { once: true });

  return cleanup;
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== SOUND_SETTINGS_KEY) {
      return;
    }

    const nextValue = event.newValue === null ? true : event.newValue !== 'off';
    if (nextValue === soundEnabled) {
      return;
    }

    soundEnabled = nextValue;
    if (!soundEnabled) {
      stopAllActiveSounds();
    }
    notifyListeners();
  });
}

export { SOUND_CHANGE_EVENT, SOUND_SETTINGS_KEY };
