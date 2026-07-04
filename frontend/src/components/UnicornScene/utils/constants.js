// Default configuration values for UnicornStudio
export const DEFAULT_CONFIG = {
  width: "100%",
  height: "100%",
  scale: 1,
  dpi: 1.5,
  fps: 60,
  altText: "Unicorn Studio Animation",
  className: "",
  lazyLoad: true
};

// UnicornStudio script configuration
export const SCRIPT_CONFIG = {
  version: '1.4.18',
  scriptId: 'unicorn-studio-script',
  scriptSelector: 'script[src^="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js"]'
};

// Intersection Observer default options
export const OBSERVER_CONFIG = {
  threshold: 0.1
};

// Error messages
export const ERROR_MESSAGES = {
  SCRIPT_LOAD_FAILED: 'UnicornStudio script could not be loaded',
  INIT_MISSING: 'UnicornStudio could not be initialized (init function missing).',
  INIT_NO_PROMISE: 'UnicornStudio could not be initialized (init did not return Promise).',
  INVALID_SCENE_DATA: 'UnicornStudio could not be initialized (invalid scene data).',
  INITIALIZATION_FAILED: (message) => `UnicornStudio animation could not be initialized: ${message}`
}; 