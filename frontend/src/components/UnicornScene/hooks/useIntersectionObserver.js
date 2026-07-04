import { useEffect, useRef } from 'react';

// Intersection Observer hook for lazy loading
export const useIntersectionObserver = (elementRef, callback, enabled = true, options = {}) => {
  const observerRef = useRef(null);

  useEffect(() => {
    if (!enabled || !elementRef.current || !callback) return;

    const defaultOptions = {
      threshold: 0.1,
      ...options
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          callback();
          observer.disconnect();
        }
      },
      defaultOptions
    );

    observerRef.current = observer;
    observer.observe(elementRef.current);

    return () => {
      if (observerRef.current && elementRef.current) {
        observerRef.current.unobserve(elementRef.current);
      }
      observerRef.current = null;
    };
  }, [elementRef, callback, enabled, options]);

  return observerRef;
}; 