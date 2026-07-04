import { ANIMATION_CONFIG } from '../data/modalConfig';

/**
 * Handle modal outside click
 * @param {Event} event - Click event
 * @param {Function} onClose - Close callback
 * @param {boolean} isLoading - Whether modal is in loading state
 */
export const handleOutsideClick = (event, onClose, isLoading = false) => {
  // Don't close if loading or if click is on modal content
  if (isLoading || event.target !== event.currentTarget) {
    return;
  }
  onClose();
};

/**
 * Handle escape key press
 * @param {KeyboardEvent} event - Keyboard event
 * @param {Function} onClose - Close callback
 * @param {boolean} isLoading - Whether modal is in loading state
 */
export const handleEscapeKey = (event, onClose, isLoading = false) => {
  if (event.key === 'Escape' && !isLoading) {
    onClose();
  }
};

/**
 * Setup modal event listeners
 * @param {Function} onClose - Close callback
 * @param {boolean} isLoading - Whether modal is in loading state
 * @returns {Function} Cleanup function
 */
export const setupModalEventListeners = (onClose, isLoading = false) => {
  const handleKeyDown = (event) => handleEscapeKey(event, onClose, isLoading);
  
  document.addEventListener('keydown', handleKeyDown);
  
  // Return cleanup function
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
};

/**
 * Apply modal open animation
 * @param {HTMLElement} modalElement - Modal DOM element
 */
export const applyOpenAnimation = (modalElement) => {
  if (!modalElement) return;
  
  // Set initial animation state
  modalElement.style.animation = `slideInFromRight ${ANIMATION_CONFIG.slideInDuration}s ${ANIMATION_CONFIG.slideInCubicBezier} forwards`;
};

/**
 * Apply modal close animation
 * @param {HTMLElement} modalElement - Modal DOM element
 * @param {Function} onAnimationComplete - Callback when animation completes
 */
export const applyCloseAnimation = (modalElement, onAnimationComplete) => {
  if (!modalElement) {
    onAnimationComplete();
    return;
  }
  
  modalElement.style.animation = `slideOutToRight ${ANIMATION_CONFIG.slideOutDuration}s ${ANIMATION_CONFIG.slideOutCubicBezier} forwards`;
  
  setTimeout(() => {
    onAnimationComplete();
  }, ANIMATION_CONFIG.slideOutDuration * 1000);
};

/**
 * Scroll modal content to specific position
 * @param {number} top - Scroll position
 * @param {boolean} smooth - Whether to use smooth scrolling
 */
export const scrollModalContent = (top = 0, smooth = true) => {
  const modalContent = document.querySelector('[data-modal-content]');
  if (modalContent) {
    modalContent.scrollTo({
      top,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }
};

/**
 * Focus first input in modal
 */
export const focusFirstInput = () => {
  setTimeout(() => {
    const firstInput = document.querySelector('[data-modal-content] input, [data-modal-content] textarea, [data-modal-content] select');
    if (firstInput && !firstInput.disabled) {
      firstInput.focus();
    }
  }, 100); // Small delay to ensure modal is rendered
};

/**
 * Get modal dimensions
 * @returns {Object} Modal dimensions and position
 */
export const getModalDimensions = () => {
  const modalContent = document.querySelector('[data-modal-content]');
  if (!modalContent) {
    return { width: 0, height: 0, top: 0, left: 0 };
  }
  
  const rect = modalContent.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
    top: rect.top,
    left: rect.left
  };
};

/**
 * Check if modal content is scrollable
 * @returns {boolean} Whether modal content is scrollable
 */
export const isModalScrollable = () => {
  const modalContent = document.querySelector('[data-modal-content]');
  if (!modalContent) return false;
  
  return modalContent.scrollHeight > modalContent.clientHeight;
};

/**
 * Get scroll position percentage
 * @returns {number} Scroll percentage (0-100)
 */
export const getScrollPercentage = () => {
  const modalContent = document.querySelector('[data-modal-content]');
  if (!modalContent) return 0;
  
  const { scrollTop, scrollHeight, clientHeight } = modalContent;
  const maxScroll = scrollHeight - clientHeight;
  
  if (maxScroll <= 0) return 0;
  
  return Math.round((scrollTop / maxScroll) * 100);
};

/**
 * Auto-scroll to error field
 * @param {string} fieldName - Name of field with error
 */
export const scrollToError = (fieldName) => {
  const errorField = document.querySelector(`[name="${fieldName}"], [data-field="${fieldName}"]`);
  if (errorField) {
    errorField.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
    
    // Focus the field after scrolling
    setTimeout(() => {
      if (errorField.focus) {
        errorField.focus();
      }
    }, 500);
  }
};

/**
 * Show loading overlay
 * @param {boolean} show - Whether to show overlay
 */
export const toggleLoadingOverlay = (show) => {
  const modal = document.querySelector('[data-modal-content]');
  if (!modal) return;
  
  if (show) {
    modal.style.pointerEvents = 'none';
    modal.style.opacity = '0.7';
  } else {
    modal.style.pointerEvents = 'auto';
    modal.style.opacity = '1';
  }
};

/**
 * Prevent body scroll when modal is open
 */
export const preventBodyScroll = () => {
  const body = document.body;
  const scrollY = window.scrollY;
  
  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.width = '100%';
  
  return scrollY;
};

/**
 * Restore body scroll when modal closes
 * @param {number} scrollY - Previous scroll position
 */
export const restoreBodyScroll = (scrollY) => {
  const body = document.body;
  
  body.style.position = '';
  body.style.top = '';
  body.style.width = '';
  
  window.scrollTo(0, scrollY);
};

/**
 * Handle modal lifecycle (open/close with proper scroll handling)
 * @param {boolean} isOpen - Whether modal should be open
 * @param {Function} onClose - Close callback
 * @returns {Function} Cleanup function
 */
export const handleModalLifecycle = (isOpen, onClose) => {
  let savedScrollY = 0;
  let cleanupEventListeners = null;
  
  if (isOpen) {
    // Setup modal
    savedScrollY = preventBodyScroll();
    cleanupEventListeners = setupModalEventListeners(onClose);
    focusFirstInput();
  }
  
  // Return cleanup function
  return () => {
    if (cleanupEventListeners) {
      cleanupEventListeners();
    }
    restoreBodyScroll(savedScrollY);
  };
}; 