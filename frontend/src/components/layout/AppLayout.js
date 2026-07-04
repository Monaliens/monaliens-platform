import React, { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import styled from "styled-components";
import { Toaster } from "react-hot-toast";
import ErrorBoundary from "../common/ErrorBoundary";
import {
  SITE_UNDER_MAINTENANCE,
  STAKING_ENABLED_DURING_MAINTENANCE,
  GAMES_ENABLED_DURING_MAINTENANCE,
  TOURNAMENT_ENABLED_DURING_MAINTENANCE,
} from "../../config/siteMaintenance";

// Lazy load all pages for optimal bundle splitting
const Hero = lazy(() => import("../Hero"));
const Stats = lazy(() => import("../Stats"));
const About = lazy(() => import("../About"));
const BuildPage = lazy(() => import("../BuildPage"));
const StakingPage = lazy(() => import("../StakingPage"));
const ComingSoonPage = lazy(() => import("../common/ComingSoonPage"));
const WrappedPage = lazy(() => import("../WrappedPage"));
const WrappedSharePage = lazy(() => import("../WrappedSharePage"));
const CheckerPage = lazy(() => import("../CheckerPage"));
const FlipPage = lazy(() => import("../FlipPage"));
const ProfilePage = lazy(() => import("../VerifyPage"));
const RefRedirect = lazy(() => import("../RefRedirect"));
const HiLoPage = lazy(() => import("../HiLoPage"));
const DicePage = lazy(() => import("../DicePage"));
const BlackjackPage = lazy(() => import("../BlackjackPage"));
const BlackjackVerifyPage = lazy(() => import("../BlackjackVerifyPage"));
const MinesPage = lazy(() => import("../MinesPage"));
const MinesVerifyPage = lazy(() => import("../MinesVerifyPage"));
const LimboPage = lazy(() => import("../LimboPage"));
const KenoPage = lazy(() => import("../KenoPage"));
const KenoVerifyPage = lazy(() => import("../KenoVerifyPage"));
const PlinkoPage = lazy(() => import("../PlinkoPage"));
const TournamentPage = lazy(() => import("../TournamentPage"));
const ProfitsPage = lazy(() => import("../ProfitsPage"));
const RafflePage = lazy(() => import("../RafflePage"));
const RaffleDetail = lazy(() => import("../RafflePage/components/RaffleDetail"));
const CreateRafflePage = lazy(() => import("../RafflePage/components/CreateRafflePage"));
const P2P2Page = lazy(() => import("../P2P2Page"));
const P2P2CreatePage = lazy(() => import("../P2P2Page/P2P2CreatePage"));
const P2P2OfferDetailPage = lazy(() => import("../P2P2Page/P2P2OfferDetailPage"));
const UserOffersPage = lazy(() => import("../UserOffersPage"));

// Legal Pages
const TermsPage = lazy(() => import("../TermsPage"));
const PrivacyPage = lazy(() => import("../PrivacyPage"));

// Footer
const Footer = lazy(() => import("../Footer"));

// Redirect component for /checker route
const CheckerRedirect = () => {
  useEffect(() => {
    const hostname = window.location.hostname;
    if (hostname === process.env.REACT_APP_DOMAIN || 'your-domain.com' || hostname === process.env.REACT_APP_DOMAIN_WWW || 'www.your-domain.com') {
      window.location.replace(process.env.REACT_APP_CHECKER_URL || 'https://checker.your-domain');
    }
  }, []);

  return <CheckerPage />;
};

// Lightweight loading component - uses CSS variables for theme support
const PageLoader = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "50vh",
      fontSize: "16px",
      color: "var(--text-secondary)",
      backgroundColor: "var(--bg-primary)",
    }}
  >
    Loading page...
  </div>
);

// Layout containers
const AppContainer = styled.div`
  padding-top: ${props => props.$noHeader ? '0' : '100px'};
  position: relative;
  isolation: isolate;
`;

const ContentContainer = styled.div`
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 10px;
  position: relative;
`;

const SectionWrapper = styled.div`
  margin-bottom: 40px;
`;

/**
 * Home Page Component - Renders the main landing page sections with lazy loading
 *
 * @returns {JSX.Element} Rendered home page
 */
const MAINTENANCE_PAGE_PROPS = {
  title: "Under Maintenance",
  description:
    "We are currently performing maintenance. Please check back soon.",
  projectId: "rkpsAXsfSsLWmqLBSvsx",
};

const MaintenancePage = () => <ComingSoonPage {...MAINTENANCE_PAGE_PROPS} />;

const HomePage = () => (
  <ErrorBoundary fallbackComponent="HomePage">
    <ErrorBoundary fallbackComponent="Hero Section">
      <Suspense fallback={<PageLoader />}>
        <SectionWrapper>
          <Hero />
        </SectionWrapper>
      </Suspense>
    </ErrorBoundary>

    <ErrorBoundary fallbackComponent="Stats Section">
      <Suspense fallback={<PageLoader />}>
        <SectionWrapper>
          <Stats />
        </SectionWrapper>
      </Suspense>
    </ErrorBoundary>

    <ErrorBoundary fallbackComponent="About Section">
      <Suspense fallback={<PageLoader />}>
        <SectionWrapper>
          <About />
        </SectionWrapper>
      </Suspense>
    </ErrorBoundary>
  </ErrorBoundary>
);

/**
 * AppLayout Component - Main application layout with routing
 * Follows SRP by only handling layout structure and route definitions
 * Header is now rendered at App level to prevent unnecessary re-renders
 *
 * @returns {JSX.Element} Rendered application layout
 */
const AppLayout = () => {
  const location = useLocation();
  const isCheckerSubdomain = window.location.hostname === process.env.REACT_APP_CHECKER_SUBDOMAIN || 'checker.your-domain.com';
  const noHeader = location.pathname === '/checker' || isCheckerSubdomain;

  return (
    <AppContainer $noHeader={noHeader}>
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--bg-card)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            fontWeight: '600',
            borderRadius: '12px',
            padding: '14px 18px',
            border: '2px solid var(--border-light)',
            boxShadow: '0 4px 15px var(--shadow-color)',
          },
          success: {
            style: {
              background: 'var(--success-bg)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '2px solid var(--accent-green-light)',
              color: 'var(--accent-green)',
            },
            iconTheme: {
              primary: 'var(--accent-green)',
              secondary: 'var(--bg-secondary)',
            },
          },
          error: {
            style: {
              background: 'var(--error-bg)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '2px solid var(--accent-red-light)',
              color: 'var(--accent-red)',
            },
            iconTheme: {
              primary: 'var(--accent-red)',
              secondary: 'var(--bg-secondary)',
            },
          },
        }}
      />
      <ContentContainer>
        <ErrorBoundary fallbackComponent="AppLayout Routes">
          <Suspense fallback={<PageLoader />}>
            <Routes
              future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
            >
              <Route
                path="/"
                element={
                  window.location.hostname === process.env.REACT_APP_CHECKER_SUBDOMAIN || "checker.your-domain.com" ? (
                    <CheckerPage />
                  ) : (
                    <HomePage />
                  )
                }
              />
              {SITE_UNDER_MAINTENANCE ? (
                <>
                  {STAKING_ENABLED_DURING_MAINTENANCE && (
                    <Route path="/staking" element={<StakingPage />} />
                  )}
                  {TOURNAMENT_ENABLED_DURING_MAINTENANCE && (
                    <Route path="/tournament" element={<TournamentPage />} />
                  )}
                  {GAMES_ENABLED_DURING_MAINTENANCE && (
                    <>
                      <Route path="/flip" element={<FlipPage />} />
                      <Route path="/hilo" element={<HiLoPage />} />
                      <Route path="/dice" element={<DicePage />} />
                      <Route path="/blackjack" element={<BlackjackPage />} />
                      <Route
                        path="/blackjack/verify"
                        element={<BlackjackVerifyPage />}
                      />
                      <Route
                        path="/blackjack/verify/:gameId"
                        element={<BlackjackVerifyPage />}
                      />
                      <Route path="/mines" element={<MinesPage />} />
                      <Route path="/mines/verify" element={<MinesVerifyPage />} />
                      <Route
                        path="/mines/verify/:gameId"
                        element={<MinesVerifyPage />}
                      />
                      <Route path="/limbo" element={<LimboPage />} />
                      <Route path="/keno" element={<KenoPage />} />
                      <Route path="/keno/verify" element={<KenoVerifyPage />} />
                      <Route path="/plinko" element={<PlinkoPage />} />
                      <Route
                        path="/keno/verify/:gameId"
                        element={<KenoVerifyPage />}
                      />
                      <Route path="/revenue" element={<ProfitsPage />} />
                      <Route path="/profits" element={<Navigate to="/revenue" replace />} />
                    </>
                  )}
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/verify" element={<ProfilePage />} />
                  <Route path="/ref/:code" element={<RefRedirect />} />
                  <Route path="*" element={<MaintenancePage />} />
                </>
              ) : (
                <>
                  <Route path="/checker" element={<CheckerRedirect />} />
                  <Route path="/wrapped" element={<WrappedPage />} />
                  <Route
                    path="/wrapped/share/:address"
                    element={<WrappedSharePage />}
                  />
                  <Route path="/wrapped/:address" element={<WrappedPage />} />
                  <Route path="/build" element={<BuildPage />} />
                  <Route path="/staking" element={<StakingPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/verify" element={<ProfilePage />} />
                  <Route path="/ref/:code" element={<RefRedirect />} />
                  <Route path="/flip" element={<FlipPage />} />
                  <Route path="/hilo" element={<HiLoPage />} />
                  <Route path="/dice" element={<DicePage />} />
                  <Route path="/blackjack" element={<BlackjackPage />} />
                  <Route
                    path="/blackjack/verify"
                    element={<BlackjackVerifyPage />}
                  />
                  <Route
                    path="/blackjack/verify/:gameId"
                    element={<BlackjackVerifyPage />}
                  />
                  <Route path="/mines" element={<MinesPage />} />
                  <Route path="/mines/verify" element={<MinesVerifyPage />} />
                  <Route
                    path="/mines/verify/:gameId"
                    element={<MinesVerifyPage />}
                  />
                  <Route path="/limbo" element={<LimboPage />} />
                  <Route path="/keno" element={<KenoPage />} />
                  <Route path="/keno/verify" element={<KenoVerifyPage />} />
                  <Route path="/plinko" element={<PlinkoPage />} />
                  <Route
                    path="/keno/verify/:gameId"
                    element={<KenoVerifyPage />}
                  />
                  <Route path="/revenue" element={<ProfitsPage />} />
                  <Route path="/profits" element={<Navigate to="/revenue" replace />} />
                  <Route path="/tournament" element={<TournamentPage />} />
                  <Route path="/raffle" element={<RafflePage />} />
                  <Route path="/raffle/create" element={<CreateRafflePage />} />
                  <Route path="/raffle/:id" element={<RaffleDetail />} />
                  <Route path="/p2p" element={<P2P2Page />} />
                  <Route path="/p2p/create" element={<P2P2CreatePage />} />
                  <Route path="/p2p/me" element={<UserOffersPage />} />
                  <Route path="/p2p/:id" element={<P2P2OfferDetailPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </>
              )}
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </ContentContainer>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </AppContainer>
  );
};

export default AppLayout;
