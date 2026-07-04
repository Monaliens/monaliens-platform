import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/common/ErrorBoundary';
import Header from './components/Header';
import GlobalStyles from './styles/GlobalStyles';
import ScrollToTop from './components/ScrollToTop';
import DarkBackground from './components/common/DarkBackground';
import ClientErrorReporter from './components/common/ClientErrorReporter';
import { logger } from './utils/logger';

// Lazy load heavy components for better performance
const AppLayout = lazy(() => import('./components/layout/AppLayout'));

// Loading fallback component - uses CSS variables for theme support
const LoadingSpinner = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-primary)'
  }}>
    Loading...
  </div>
);

/**
 * Main App Component - Root component that handles routing and global layout
 * Follows SRP by only handling top-level routing and layout composition
 * 
 * @returns {JSX.Element} Rendered application
 */
function App() {
  // Optimize font loading to prevent massive re-renders
  useEffect(() => {
    // Ultra optimized font loading without state cascade
    const loadFonts = async () => {
      try {
        if ('fonts' in document) {
          await document.fonts.ready;
        }
        // Add class directly without causing app re-render
        document.body.classList.add('fonts-loaded');
        document.documentElement.classList.add('fonts-loaded');
      } catch (error) {
        // Fallback - still add class to prevent font flash
        setTimeout(() => {
          document.body.classList.add('fonts-loaded');
          document.documentElement.classList.add('fonts-loaded');
        }, 100);
      }
    };

    loadFonts();

    // Global error handler for runtime errors
    const handleGlobalError = (event) => {
      console.error('Global runtime error:', event.error);
      logger.error(event.error, 'Global Error Handler');
      
      // Prevent default error display in development
      if (process.env.NODE_ENV === 'development') {
        event.preventDefault();
      }
    };

    // Global promise rejection handler
    const handleUnhandledRejection = (event) => {
      logger.error(event.reason, 'Unhandled Promise Rejection');
      
      // Prevent default unhandled rejection warning
      if (process.env.NODE_ENV === 'development') {
        event.preventDefault();
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Production-safe app wrapper with error boundaries
  return (
    <ErrorBoundary title="Application Error" message="The application encountered an unexpected error. Please refresh the page.">
      <div className="app-root fonts-stable">
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <GlobalStyles />
          <ScrollToTop />
          <DarkBackground />
          <ClientErrorReporter />
          <AppContent />
        </Router>
      </div>
    </ErrorBoundary>
  );
}

/**
 * AppContent Component - Handles conditional header rendering
 */
const AppContent = () => {
  const location = useLocation();
  const isCheckerSubdomain = window.location.hostname === process.env.REACT_APP_CHECKER_SUBDOMAIN || 'checker.your-domain.com';
  const hideHeader = location.pathname === '/checker' || isCheckerSubdomain;

  return (
    <>
      {/* Header at App level to prevent re-renders on route changes */}
      {!hideHeader && (
        <ErrorBoundary fallbackComponent="Header">
          <Header />
        </ErrorBoundary>
      )}

      {/* Lazy loaded routes with error boundaries */}
      <ErrorBoundary fallbackComponent="Routes">
        <Suspense fallback={<LoadingSpinner />}>
          <Routes future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            {/* Main application routes */}
            <Route path="*" element={<AppLayout />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
};

export default App; 