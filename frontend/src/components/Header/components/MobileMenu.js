import React, { memo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  SITE_UNDER_MAINTENANCE,
  STAKING_ENABLED_DURING_MAINTENANCE,
  GAMES_ENABLED_DURING_MAINTENANCE,
  TOURNAMENT_ENABLED_DURING_MAINTENANCE,
} from "../../../config/siteMaintenance";
import {
  MobileMenuToggle,
  MobileMenuSheet,
  MobileMenuItem,
  MobileMenuThemeRow,
  MobileThemeSwitch,
  MobileAccordion,
  MobileAccordionHeader,
  MobileAccordionContent,
  LiveBadge,
} from "../styles";
import { useTheme } from "../../../context/ThemeContext";
import { useSound } from "../../../context/SoundContext";

const TOURNAMENT_START = new Date('2026-05-16T12:00:00Z').getTime();
const TOURNAMENT_END = new Date('2026-05-23T11:39:00Z').getTime();

const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/** Hamburger lives in the header row; opens the in-card sheet below. */
export const MobileMenuHamburger = memo(({ onToggle, isOpen }) => (
  <MobileMenuToggle
    type="button"
    onClick={onToggle}
    aria-expanded={isOpen}
    aria-controls="mobile-nav-sheet"
    aria-label={isOpen ? 'Close menu' : 'Open menu'}
  >
    ☰
  </MobileMenuToggle>
));
MobileMenuHamburger.displayName = 'MobileMenuHamburger';

/**
 * Navigation sheet: rendered inside the same header card (not a separate layer).
 */
const MobileMenu = memo(({ isOpen, onItemClick, onDisabledItemClick }) => {
  const { isDarkMode, toggleTheme } = useTheme();
  const { isSoundOn, toggleSound } = useSound();
  const [openAccordion, setOpenAccordion] = useState(null);
  const [isTournamentLive, setIsTournamentLive] = useState(() => {
    const now = Date.now();
    return now >= TOURNAMENT_START && now < TOURNAMENT_END;
  });

  useEffect(() => {
    const checkTournamentStatus = () => {
      const now = Date.now();
      setIsTournamentLive(now >= TOURNAMENT_START && now < TOURNAMENT_END);
    };

    const now = Date.now();
    if (now < TOURNAMENT_END) {
      const interval = setInterval(checkTournamentStatus, 60000);
      return () => clearInterval(interval);
    }
  }, [isTournamentLive]);

  const handleDisabledClick = (pageName) => {
    if (onDisabledItemClick) {
      onDisabledItemClick(pageName);
    }
    if (onItemClick) {
      onItemClick();
    }
  };

  const toggleAccordion = (name) => {
    setOpenAccordion(prev => prev === name ? null : name);
  };

  const inactiveStyle = {
    opacity: 0.5,
    cursor: "not-allowed",
    userSelect: "none",
  };

  const maintenanceBody = (
    <>
      <MobileMenuItem onClick={onItemClick}>
        <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
          Home
        </Link>
      </MobileMenuItem>
      <MobileMenuItem onClick={onItemClick}>
        <Link to="/profile" style={{ textDecoration: "none", color: "inherit" }}>
          Profile
        </Link>
      </MobileMenuItem>
      {STAKING_ENABLED_DURING_MAINTENANCE ? (
        <MobileMenuItem onClick={onItemClick}>
          <Link
            to="/staking"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            Staking
          </Link>
        </MobileMenuItem>
      ) : (
        <MobileMenuItem
          onClick={() => handleDisabledClick("Staking")}
          style={inactiveStyle}
        >
          Staking
        </MobileMenuItem>
      )}
      {GAMES_ENABLED_DURING_MAINTENANCE ? (
        <MobileMenuItem onClick={onItemClick}>
          <Link
            to="/revenue"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            Revenue
          </Link>
        </MobileMenuItem>
      ) : (
        <MobileMenuItem
          onClick={() => handleDisabledClick("Revenue")}
          style={inactiveStyle}
        >
          Revenue
        </MobileMenuItem>
      )}
      {TOURNAMENT_ENABLED_DURING_MAINTENANCE ? (
        <MobileMenuItem onClick={onItemClick}>
          <Link
            to="/tournament"
            style={{ textDecoration: "none", color: "inherit", display: "inline-flex", alignItems: "center" }}
          >
            Tournament
            {isTournamentLive && <LiveBadge>LIVE</LiveBadge>}
          </Link>
        </MobileMenuItem>
      ) : (
        <MobileMenuItem
          onClick={() => handleDisabledClick("Tournament")}
          style={{ ...inactiveStyle, display: "inline-flex", alignItems: "center" }}
        >
          Tournament
          {isTournamentLive && <LiveBadge>LIVE</LiveBadge>}
        </MobileMenuItem>
      )}
      {GAMES_ENABLED_DURING_MAINTENANCE ? (
        <>
          <MobileAccordion>
            <MobileAccordionHeader
              $isOpen={openAccordion === "minigames"}
              onClick={() => toggleAccordion("minigames")}
            >
              Mini-Games
              <ChevronIcon />
            </MobileAccordionHeader>
            <MobileAccordionContent $isOpen={openAccordion === "minigames"}>
              <MobileMenuItem onClick={onItemClick}>
                <Link
                  to="/flip"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  Flip
                </Link>
              </MobileMenuItem>
              <MobileMenuItem onClick={onItemClick}>
                <Link
                  to="/dice"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  Dice
                </Link>
              </MobileMenuItem>
              <MobileMenuItem onClick={onItemClick}>
                <Link
                  to="/hilo"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  Hi-Lo
                </Link>
              </MobileMenuItem>
              <MobileMenuItem onClick={onItemClick}>
                <Link
                  to="/blackjack"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  Blackjack
                </Link>
              </MobileMenuItem>
              <MobileMenuItem onClick={onItemClick}>
                <Link
                  to="/mines"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  Mines
                </Link>
              </MobileMenuItem>
              <MobileMenuItem onClick={onItemClick}>
                <Link
                  to="/limbo"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  Limbo
                </Link>
              </MobileMenuItem>
              <MobileMenuItem onClick={onItemClick}>
                <Link
                  to="/keno"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  Keno
                </Link>
              </MobileMenuItem>
              <MobileMenuItem onClick={onItemClick}>
                <Link
                  to="/plinko"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  Plinko
                </Link>
              </MobileMenuItem>
            </MobileAccordionContent>
          </MobileAccordion>
        </>
      ) : (
        <MobileMenuItem
          onClick={() => handleDisabledClick("Mini-Games")}
          style={inactiveStyle}
        >
          Mini-Games
        </MobileMenuItem>
      )}
      <MobileMenuThemeRow>
        <span>Dark mode</span>
        <MobileThemeSwitch
          type="button"
          role="switch"
          aria-checked={isDarkMode}
          aria-label={isDarkMode ? 'Dark mode on' : 'Dark mode off'}
          $on={isDarkMode}
          onClick={() => toggleTheme()}
        />
      </MobileMenuThemeRow>
      <MobileMenuThemeRow>
        <span>Game sounds</span>
        <MobileThemeSwitch
          type="button"
          role="switch"
          aria-checked={isSoundOn}
          aria-label={isSoundOn ? 'Game sounds on' : 'Game sounds off'}
          $on={isSoundOn}
          onClick={() => toggleSound()}
        />
      </MobileMenuThemeRow>
    </>
  );

  const defaultBody = (
    <>
      <MobileMenuItem onClick={onItemClick}>
        <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
          Home
        </Link>
      </MobileMenuItem>
      <MobileMenuItem onClick={onItemClick}>
        <Link to="/profile" style={{ textDecoration: "none", color: "inherit" }}>
          Profile
        </Link>
      </MobileMenuItem>
      <MobileMenuItem onClick={onItemClick}>
        <Link
          to="/staking"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          Staking
        </Link>
      </MobileMenuItem>
      <MobileMenuItem onClick={onItemClick}>
        <Link
          to="/revenue"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          Revenue
        </Link>
      </MobileMenuItem>
      <MobileMenuItem onClick={onItemClick}>
        <Link
          to="/tournament"
          style={{ textDecoration: "none", color: "inherit", display: "inline-flex", alignItems: "center" }}
        >
          Tournament
          {isTournamentLive && <LiveBadge>LIVE</LiveBadge>}
        </Link>
      </MobileMenuItem>

      <MobileAccordion>
        <MobileAccordionHeader
          $isOpen={openAccordion === 'minigames'}
          onClick={() => toggleAccordion('minigames')}
        >
          Mini-Games
          <ChevronIcon />
        </MobileAccordionHeader>
        <MobileAccordionContent $isOpen={openAccordion === 'minigames'}>
          <MobileMenuItem onClick={onItemClick}>
            <Link to="/flip" style={{ textDecoration: "none", color: "inherit" }}>
              Flip
            </Link>
          </MobileMenuItem>
          <MobileMenuItem onClick={onItemClick}>
            <Link to="/dice" style={{ textDecoration: "none", color: "inherit" }}>
              Dice
            </Link>
          </MobileMenuItem>
          <MobileMenuItem onClick={onItemClick}>
            <Link to="/hilo" style={{ textDecoration: "none", color: "inherit" }}>
              Hi-Lo
            </Link>
          </MobileMenuItem>
          <MobileMenuItem onClick={onItemClick}>
            <Link to="/blackjack" style={{ textDecoration: "none", color: "inherit" }}>
              Blackjack
            </Link>
          </MobileMenuItem>
          <MobileMenuItem onClick={onItemClick}>
            <Link to="/mines" style={{ textDecoration: "none", color: "inherit" }}>
              Mines
            </Link>
          </MobileMenuItem>
          <MobileMenuItem onClick={onItemClick}>
            <Link to="/limbo" style={{ textDecoration: "none", color: "inherit" }}>
              Limbo
            </Link>
          </MobileMenuItem>
          <MobileMenuItem onClick={onItemClick}>
            <Link to="/keno" style={{ textDecoration: "none", color: "inherit" }}>
              Keno
            </Link>
          </MobileMenuItem>
          <MobileMenuItem onClick={onItemClick}>
            <Link to="/plinko" style={{ textDecoration: "none", color: "inherit" }}>
              Plinko
            </Link>
          </MobileMenuItem>
        </MobileAccordionContent>
      </MobileAccordion>

      <MobileMenuThemeRow>
        <span>Dark mode</span>
        <MobileThemeSwitch
          type="button"
          role="switch"
          aria-checked={isDarkMode}
          aria-label={isDarkMode ? 'Dark mode on' : 'Dark mode off'}
          $on={isDarkMode}
          onClick={() => toggleTheme()}
        />
      </MobileMenuThemeRow>
      <MobileMenuThemeRow>
        <span>Game sounds</span>
        <MobileThemeSwitch
          type="button"
          role="switch"
          aria-checked={isSoundOn}
          aria-label={isSoundOn ? 'Game sounds on' : 'Game sounds off'}
          $on={isSoundOn}
          onClick={() => toggleSound()}
        />
      </MobileMenuThemeRow>
    </>
  );

  return (
    <MobileMenuSheet id="mobile-nav-sheet" $open={isOpen}>
      {SITE_UNDER_MAINTENANCE ? maintenanceBody : defaultBody}
    </MobileMenuSheet>
  );
});

MobileMenu.displayName = 'MobileMenu';

export default MobileMenu;
