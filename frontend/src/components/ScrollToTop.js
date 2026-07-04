import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Component to scroll to top on route changes
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top on route change
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' // Instant scroll, smooth can also be used
    });
  }, [pathname]);

  return null; // No UI rendering
};

export default ScrollToTop; 