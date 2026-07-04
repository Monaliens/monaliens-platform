import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom Hook for Dropdown Management
 * Single Responsibility: Handle dropdown open/close logic with hover support
 * 
 * @param {string} containerId - ID of the dropdown container for click outside detection
 * @returns {Object} Dropdown state and handlers
 */
export const useDropdown = (containerId) => {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef(null);

  const toggle = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsOpen(prev => !prev);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  // Hover handlers with delay
  const handleMouseEnter = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsOpen(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150); // 150ms delay for smooth UX
  }, []);

  // Click outside to close
  useEffect(() => {
    if (!isOpen || !containerId) return;
    
    const handleClickOutside = (event) => {
      const container = document.getElementById(containerId);
      if (container && !container.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, containerId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isOpen,
    toggle,
    close,
    open,
    handleMouseEnter,
    handleMouseLeave
  };
}; 