import React, { memo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  SITE_UNDER_MAINTENANCE,
  STAKING_ENABLED_DURING_MAINTENANCE,
  GAMES_ENABLED_DURING_MAINTENANCE,
  TOURNAMENT_ENABLED_DURING_MAINTENANCE,
} from "../../../config/siteMaintenance";
import { useDropdown } from "../hooks/useDropdown";
import {
  Nav,
  NavItem,
  MenuContainer,
  DropdownMenu,
  DropdownMenuItem,
  ToolsButton,
  LiveBadge,
} from "../styles";

// Tournament dates (UTC)
const TOURNAMENT_START = new Date('2026-05-16T12:00:00Z').getTime();
const TOURNAMENT_END = new Date('2026-05-23T11:39:00Z').getTime();

/**
 * NavigationMenu Component
 * Single Responsibility: Handle main navigation and mini-games dropdown
 *
 * @param {Function} onDisabledItemClick - Callback for disabled items
 * @returns {JSX.Element} Rendered navigation menu
 */
const NavigationMenu = memo(({ onDisabledItemClick }) => {
  const miniGamesDropdown = useDropdown("mini-games-menu-container");
  const [isTournamentLive, setIsTournamentLive] = useState(() => {
    const now = Date.now();
    return now >= TOURNAMENT_START && now < TOURNAMENT_END;
  });

  useEffect(() => {
    // Check if tournament is live (between start and end dates)
    const checkTournamentStatus = () => {
      const now = Date.now();
      setIsTournamentLive(now >= TOURNAMENT_START && now < TOURNAMENT_END);
    };

    // Check every minute if tournament hasn't started or is still active
    const now = Date.now();
    if (now < TOURNAMENT_END) {
      const interval = setInterval(checkTournamentStatus, 60000);
      return () => clearInterval(interval);
    }
  }, [isTournamentLive]);

  const handleDisabledClick = (e, pageName) => {
    e.preventDefault();
    if (onDisabledItemClick) {
      onDisabledItemClick(pageName);
    }
    miniGamesDropdown.close();
  };

  const inactiveStyle = {
    opacity: 0.5,
    cursor: "not-allowed",
    userSelect: "none",
  };

  if (SITE_UNDER_MAINTENANCE) {
    return (
      <Nav>
        <NavItem>
          <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
            Home
          </Link>
        </NavItem>
        {GAMES_ENABLED_DURING_MAINTENANCE ? (
          <MenuContainer
            id="mini-games-menu-container"
            onMouseEnter={miniGamesDropdown.handleMouseEnter}
            onMouseLeave={miniGamesDropdown.handleMouseLeave}
          >
            <NavItem>
              <ToolsButton
                style={{
                  color: miniGamesDropdown.isOpen ? "#6930c3" : "inherit",
                }}
                onClick={miniGamesDropdown.toggle}
              >
                Mini-Games
              </ToolsButton>
            </NavItem>
            <DropdownMenu $show={miniGamesDropdown.isOpen}>
              <DropdownMenuItem>
                <Link
                  to="/flip"
                  style={{ textDecoration: "none", color: "inherit" }}
                  onClick={miniGamesDropdown.close}
                >
                  Flip
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link
                  to="/dice"
                  style={{ textDecoration: "none", color: "inherit" }}
                  onClick={miniGamesDropdown.close}
                >
                  Dice
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link
                  to="/hilo"
                  style={{ textDecoration: "none", color: "inherit" }}
                  onClick={miniGamesDropdown.close}
                >
                  Hi-Lo
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link
                  to="/blackjack"
                  style={{ textDecoration: "none", color: "inherit" }}
                  onClick={miniGamesDropdown.close}
                >
                  Blackjack
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link
                  to="/mines"
                  style={{ textDecoration: "none", color: "inherit" }}
                  onClick={miniGamesDropdown.close}
                >
                  Mines
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link
                  to="/limbo"
                  style={{ textDecoration: "none", color: "inherit" }}
                  onClick={miniGamesDropdown.close}
                >
                  Limbo
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link
                  to="/keno"
                  style={{ textDecoration: "none", color: "inherit" }}
                  onClick={miniGamesDropdown.close}
                >
                  Keno
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link
                  to="/plinko"
                  style={{ textDecoration: "none", color: "inherit" }}
                  onClick={miniGamesDropdown.close}
                >
                  Plinko
                </Link>
              </DropdownMenuItem>
            </DropdownMenu>
          </MenuContainer>
        ) : (
          <NavItem>
            <span
              role="presentation"
              style={inactiveStyle}
              onClick={(e) => handleDisabledClick(e, "Mini-Games")}
            >
              Mini-Games
            </span>
          </NavItem>
        )}
        <NavItem>
          {GAMES_ENABLED_DURING_MAINTENANCE ? (
            <Link to="/revenue" style={{ textDecoration: "none", color: "inherit" }}>
              Revenue
            </Link>
          ) : (
            <span
              role="presentation"
              style={inactiveStyle}
              onClick={(e) => handleDisabledClick(e, "Revenue")}
            >
              Revenue
            </span>
          )}
        </NavItem>
        <NavItem>
          {TOURNAMENT_ENABLED_DURING_MAINTENANCE ? (
            <Link to="/tournament" style={{ textDecoration: "none", color: "inherit", display: "inline-flex", alignItems: "center" }}>
              Tournament
              {isTournamentLive && <LiveBadge>LIVE</LiveBadge>}
            </Link>
          ) : (
            <span
              role="presentation"
              style={{ ...inactiveStyle, display: "inline-flex", alignItems: "center" }}
              onClick={(e) => handleDisabledClick(e, "Tournament")}
            >
              Tournament
              {isTournamentLive && <LiveBadge>LIVE</LiveBadge>}
            </span>
          )}
        </NavItem>
        <NavItem>
          {STAKING_ENABLED_DURING_MAINTENANCE ? (
            <Link
              to="/staking"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              Staking
            </Link>
          ) : (
            <span
              role="presentation"
              style={inactiveStyle}
              onClick={(e) => handleDisabledClick(e, "Staking")}
            >
              Staking
            </span>
          )}
        </NavItem>
      </Nav>
    );
  }

  return (
    <Nav>
      <NavItem>
        <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
          Home
        </Link>
      </NavItem>

      <MenuContainer
        id="mini-games-menu-container"
        onMouseEnter={miniGamesDropdown.handleMouseEnter}
        onMouseLeave={miniGamesDropdown.handleMouseLeave}
      >
        <NavItem>
          <ToolsButton
            style={{ color: miniGamesDropdown.isOpen ? "#6930c3" : "inherit" }}
            onClick={miniGamesDropdown.toggle}
          >
            Mini-Games
          </ToolsButton>
        </NavItem>

        <DropdownMenu $show={miniGamesDropdown.isOpen}>
          <DropdownMenuItem>
            <Link
              to="/flip"
              style={{ textDecoration: "none", color: "inherit" }}
              onClick={miniGamesDropdown.close}
            >
              Flip
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link
              to="/dice"
              style={{ textDecoration: "none", color: "inherit" }}
              onClick={miniGamesDropdown.close}
            >
              Dice
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link
              to="/hilo"
              style={{ textDecoration: "none", color: "inherit" }}
              onClick={miniGamesDropdown.close}
            >
              Hi-Lo
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link
              to="/blackjack"
              style={{ textDecoration: "none", color: "inherit" }}
              onClick={miniGamesDropdown.close}
            >
              Blackjack
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link
              to="/mines"
              style={{ textDecoration: "none", color: "inherit" }}
              onClick={miniGamesDropdown.close}
            >
              Mines
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link
              to="/limbo"
              style={{ textDecoration: "none", color: "inherit" }}
              onClick={miniGamesDropdown.close}
            >
              Limbo
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link
              to="/keno"
              style={{ textDecoration: "none", color: "inherit" }}
              onClick={miniGamesDropdown.close}
            >
              Keno
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link
              to="/plinko"
              style={{ textDecoration: "none", color: "inherit" }}
              onClick={miniGamesDropdown.close}
            >
              Plinko
            </Link>
          </DropdownMenuItem>
        </DropdownMenu>
      </MenuContainer>

      <NavItem>
        <Link to="/revenue" style={{ textDecoration: "none", color: "inherit" }}>
          Revenue
        </Link>
      </NavItem>

      <NavItem>
        <Link to="/tournament" style={{ textDecoration: "none", color: "inherit", display: "inline-flex", alignItems: "center" }}>
          Tournament
          {isTournamentLive && <LiveBadge>LIVE</LiveBadge>}
        </Link>
      </NavItem>

      <NavItem>
        <Link to="/staking" style={{ textDecoration: "none", color: "inherit" }}>
          Staking
        </Link>
      </NavItem>

    </Nav>
  );
});

NavigationMenu.displayName = "NavigationMenu";

export default NavigationMenu;
