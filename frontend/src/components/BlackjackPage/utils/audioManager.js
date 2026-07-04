import { isSoundEnabled, registerSoundElement } from '../../../utils/soundSettings';

// Blackjack Audio Manager - Lazy loading & Memory management
const audioCache = new Map();
const loadingPromises = new Map();
let isAudioUnlocked = false;

// Sound paths
const SOUNDS = {
  deal: '/assets/sounds/hilo/deal.mp3',
  cardDeal: '/assets/sounds/blackjack/card-slide-1.ogg',
  cardFlip: '/assets/sounds/blackjack/card-shove-2.ogg',
  cardPlace: '/assets/sounds/blackjack/card-place-1.ogg',
  cardSplit: '/assets/sounds/blackjack/card-slide-8.ogg',
  win: '/assets/sounds/dice/win.mp3',
  lose: '/assets/sounds/limbo/lose.mp3'
};

// Preload priorities
const AUDIO_PRIORITIES = {
  HIGH: ['deal', 'cardPlace'],
  MEDIUM: ['cardFlip', 'cardSplit', 'cardDeal'],
  LOW: ['win', 'lose']
};

// Load audio file
const loadAudioFile = async (key, src) => {
  if (loadingPromises.has(key)) {
    return loadingPromises.get(key);
  }

  const loadPromise = new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = 0.6;

    const handleLoad = () => {
      audioCache.set(key, audio);
      loadingPromises.delete(key);
      resolve(audio);
    };

    const handleError = (error) => {
      loadingPromises.delete(key);
      console.warn(`Error loading audio ${key}:`, error);
      reject(error);
    };

    audio.addEventListener('canplaythrough', handleLoad, { once: true });
    audio.addEventListener('error', handleError, { once: true });
    audio.src = src;
    audio.load();
  });

  loadingPromises.set(key, loadPromise);
  return loadPromise;
};

// Preload sounds by priority
const preloadAudio = async (priority = 'HIGH') => {
  const soundsToLoad = AUDIO_PRIORITIES[priority] || [];

  try {
    const loadPromises = soundsToLoad
      .filter(key => SOUNDS[key] && !audioCache.has(key))
      .map(key => loadAudioFile(key, SOUNDS[key]));

    if (loadPromises.length > 0) {
      await Promise.allSettled(loadPromises);
    }
  } catch (error) {
    console.warn('Audio preloading failed:', error);
  }
};

// Unlock audio on user interaction
const unlockAudio = () => {
  if (isAudioUnlocked) return Promise.resolve();

  return new Promise((resolve) => {
    const unlockEvents = ['touchstart', 'touchend', 'mousedown', 'keydown'];

    const unlock = async () => {
      try {
        const testAudio = new Audio();
        testAudio.volume = 0;
        testAudio.muted = true;

        const playPromise = testAudio.play();
        if (playPromise) {
          try {
            await playPromise;
            testAudio.pause();
          } catch (e) {
            // Audio play failed, but that's okay for unlock
          }
        }

        isAudioUnlocked = true;
        preloadAudio('MEDIUM');
      } catch (error) {
        console.warn('Audio unlock failed:', error);
      } finally {
        unlockEvents.forEach(event => {
          document.removeEventListener(event, unlock);
        });
        resolve();
      }
    };

    unlockEvents.forEach(event => {
      document.addEventListener(event, unlock, { once: true });
    });
  });
};

// Play sound
const playSound = async (soundKey, options = {}) => {
  try {
    if (!isSoundEnabled()) {
      return false;
    }

    const { volume = 0.6 } = options;

    let audio = audioCache.get(soundKey);

    if (!audio) {
      if (SOUNDS[soundKey]) {
        try {
          audio = await loadAudioFile(soundKey, SOUNDS[soundKey]);
        } catch (error) {
          console.warn(`Failed to load audio: ${soundKey}`);
          return false;
        }
      } else {
        console.warn(`Unknown audio key: ${soundKey}`);
        return false;
      }
    }

    // Do not play if the user muted sounds while this file was loading.
    if (!isSoundEnabled()) {
      return false;
    }

    // Clone for overlapping plays
    const audioToPlay = audio.cloneNode();
    registerSoundElement(audioToPlay);
    audioToPlay.volume = volume;

    const playPromise = audioToPlay.play();

    if (playPromise) {
      await playPromise;
      audioToPlay.addEventListener('ended', () => {
        audioToPlay.src = '';
      }, { once: true });
      return true;
    }

    return false;
  } catch (error) {
    console.warn(`Error playing audio ${soundKey}:`, error);
    return false;
  }
};

// Clear cache
const clearAudioCache = () => {
  audioCache.forEach(audio => {
    audio.pause();
    audio.src = '';
  });
  audioCache.clear();
  loadingPromises.clear();
  isAudioUnlocked = false;
};

// MEMORY OPTIMIZATION: Don't auto-initialize on module load
// Initialize audio manager (call this from component useEffect)
const initAudioManager = () => {
  unlockAudio();
  preloadAudio('HIGH');
  
  // Return cleanup function
  return () => {
    clearAudioCache();
  };
};

export {
  preloadAudio,
  unlockAudio,
  playSound,
  clearAudioCache,
  initAudioManager,
  SOUNDS
};
