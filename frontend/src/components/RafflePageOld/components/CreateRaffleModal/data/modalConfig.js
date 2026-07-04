// Modal animation settings
export const ANIMATION_CONFIG = {
  overlay: {
    duration: '0.3s'
  },
  modal: {
    duration: '0.4s',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    slideDistance: '50px'
  },
  fadeInDuration: 0.3, // seconds
  slideInDuration: 0.4, // seconds
  slideOutDuration: 0.3, // seconds
  slideInCubicBezier: 'cubic-bezier(0.4, 0, 0.2, 1)',
  slideOutCubicBezier: 'cubic-bezier(0.4, 0, 0.2, 1)'
};

// Modal layout configuration
export const MODAL_CONFIG = {
  maxWidth: 600, // pixels
  maxHeight: 90, // vh
  zIndex: 99999,
  shadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  overlay: {
    background: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(8px)'
  },
  borderRadius: {
    modal: 24,
    desktop: '24px 0 0 24px',
    mobile: 0,
    section: 16,
    input: 8,
    button: 8,
    asset: 12,
    card: 12
  },
  spacing: {
    modal: 30,
    section: 24,
    grid: 16,
    small: 8,
    medium: 16,
    large: 20
  },
  backdrop: {
    blur: 8, // pixels
    opacity: 0.8
  }
};

// Color configurations
export const COLOR_CONFIG = {
  primary: '#6930c3',
  primaryGradient: 'linear-gradient(135deg, #6930c3 0%, #9d4edd 100%)',
  text: {
    primary: '#1e293b',
    secondary: '#374151',
    muted: '#64748b',
    error: '#ef4444',
    white: '#ffffff'
  },
  background: {
    white: '#ffffff',
    card: '#f8fafc',
    muted: '#f1f5f9',
    overlay: 'rgba(0, 0, 0, 0.8)',
    buttonHover: 'rgba(255, 255, 255, 0.3)'
  },
  border: {
    default: '#e2e8f0',
    focus: '#6930c3',
    error: '#ef4444',
    selected: '#6930c3'
  },
  status: {
    success: '#10b981',
    error: '#ef4444',
    loading: '#6930c3'
  }
};

// Button configurations
export const BUTTON_CONFIG = {
  primary: {
    padding: '12px 24px',
    minHeight: '48px',
    fontSize: 16,
    fontWeight: 600,
    minWidth: 120
  },
  secondary: {
    padding: '12px 24px',
    minHeight: '48px',
    fontSize: 16,
    fontWeight: 500,
    minWidth: 120,
    borderWidth: 1
  },
  closeButton: {
    size: 40,
    fontSize: 20,
    background: 'rgba(255, 255, 255, 0.2)',
    hoverBackground: 'rgba(255, 255, 255, 0.3)'
  },
  submitButton: {
    height: 56,
    fontSize: 16,
    fontWeight: 600
  },
  durationButton: {
    padding: '16px',
    minHeight: '80px'
  },
  prizeTypeButton: {
    padding: '20px',
    minHeight: '100px'
  }
};

// Input configurations
export const INPUT_CONFIG = {
  height: 48,
  padding: '12px 16px',
  fontSize: 16,
  borderWidth: 2,
  textarea: {
    minHeight: 120,
    resize: 'vertical'
  }
};

// Grid configurations
export const GRID_CONFIG = {
  asset: {
    columns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16,
    itemHeight: 160
  },
  duration: {
    columns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: 12
  },
  form: {
    twoColumn: '1fr 1fr',
    gap: 16
  }
};

// Toast configuration
export const TOAST_CONFIG = {
  position: 'top-center',
  duration: 4000,
  style: {
    background: '#363636',
    color: '#fff'
  },
  success: {
    duration: 3000,
    iconTheme: {
      primary: '#10b981',
      secondary: '#fff'
    }
  },
  error: {
    duration: 5000,
    iconTheme: {
      primary: '#ef4444',
      secondary: '#fff'
    }
  },
  loading: {
    iconTheme: {
      primary: '#6930c3',
      secondary: '#fff'
    }
  }
}; 