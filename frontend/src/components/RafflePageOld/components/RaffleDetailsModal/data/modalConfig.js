// Modal animation settings
export const ANIMATION_CONFIG = {
  fadeInDuration: 0.3, // seconds
  slideInDuration: 0.4, // seconds
  slideInCubicBezier: 'cubic-bezier(0.4, 0, 0.2, 1)',
  hoverTranslateY: -1, // pixels
  hoverScale: 1.1,
  spinAnimationDuration: 1 // seconds
};

// Modal layout configuration
export const MODAL_CONFIG = {
  maxWidth: 600, // pixels
  borderRadius: {
    container: 24,
    desktop: '24px 0 0 24px',
    mobile: 0,
    content: 12,
    button: 12,
    badge: 20,
    input: 10
  },
  zIndex: {
    modal: 9999,
    closeButton: 10,
    headerOverlay: 2,
    headerContent: 2
  },
  spacing: {
    content: 24,
    section: 24,
    card: 16,
    grid: 12,
    small: 6,
    large: 20
  },
  backdrop: {
    blur: 8, // pixels
    opacity: 0.8
  }
};

// Header configuration
export const HEADER_CONFIG = {
  height: {
    withImage: 220,
    withoutImage: 120,
    mobileWithImage: 180,
    mobileWithoutImage: 120,
    fallback: 150
  },
  gradient: {
    default: 'linear-gradient(135deg, #6930c3 0%, #9d4edd 100%)',
    overlay: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%)'
  }
};

// Button sizes and styles
export const BUTTON_CONFIG = {
  closeButton: {
    size: 40,
    fontSize: 20
  },
  quantityButton: {
    size: 44,
    fontSize: 18
  },
  participate: {
    padding: 16,
    fontSize: 16
  }
};

// Input configuration
export const INPUT_CONFIG = {
  quantity: {
    min: 1,
    defaultMax: 10,
    padding: '12px 16px',
    fontSize: 16
  }
};

// Grid configuration
export const GRID_CONFIG = {
  info: {
    minWidth: 200,
    gap: 16
  },
  time: {
    minWidth: 150,
    gap: 16
  }
};

// Color configurations
export const COLOR_CONFIG = {
  primary: '#6930c3',
  primaryGradient: 'linear-gradient(135deg, #6930c3 0%, #9d4edd 100%)',
  text: {
    primary: '#1f2937',
    secondary: '#6b7280',
    muted: '#64748b'
  },
  background: {
    card: '#f8fafc',
    white: '#ffffff',
    muted: '#f1f5f9'
  },
  border: {
    default: '#e2e8f0',
    focus: '#6930c3'
  }
}; 