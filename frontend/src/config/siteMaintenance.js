/**
 * When true, only `/` stays available; all other routes show the maintenance screen
 * and primary header navigation (except Home) is non-interactive.
 */
export const SITE_UNDER_MAINTENANCE = true;

/** When true alongside SITE_UNDER_MAINTENANCE, `/staking` and its nav links stay active */
export const STAKING_ENABLED_DURING_MAINTENANCE = true;

/**
 * When true alongside SITE_UNDER_MAINTENANCE, mini-game routes and their `/verify` pages
 * stay active.
 */
export const GAMES_ENABLED_DURING_MAINTENANCE = true;

/** When true alongside SITE_UNDER_MAINTENANCE, `/tournament` stays active */
export const TOURNAMENT_ENABLED_DURING_MAINTENANCE = true;
