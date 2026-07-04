import { useState, useEffect } from 'react';

const DEFAULT_BREAKPOINT = 768;

/**
 * Matches CSS history layouts (@media max-width: 768px).
 */
export function useIsMobile(maxWidth = DEFAULT_BREAKPOINT) {
  const query = `(max-width: ${maxWidth}px)`;

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (event) => setIsMobile(event.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return isMobile;
}

/**
 * Short "All" / "My" tab labels only on mobile when space is tight.
 */
export function useCompactHistoryTabs({
  isSearchOpen,
  activeTab,
  includeLeaderboard = false,
} = {}) {
  const isMobile = useIsMobile();
  const needsCompact =
    isSearchOpen ||
    activeTab === 'search' ||
    (includeLeaderboard && activeTab === 'leaderboard');

  return isMobile && needsCompact;
}

export function historyTabLabel(compact, tab) {
  if (tab === 'my') return compact ? 'My' : 'My Games';
  if (tab === 'all') return compact ? 'All' : 'All Games';
  return '';
}
