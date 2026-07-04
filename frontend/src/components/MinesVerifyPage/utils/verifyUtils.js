import { keccak256, encodePacked, toBytes } from 'viem';

// Contract version constant (must match contract)
export const VERSION = keccak256(toBytes('MINES_V1'));

/**
 * Generate final seed from VRF seed and backend salt
 * Matches contract: keccak256(abi.encodePacked(pythSeed, backendSalt, gameId, VERSION))
 */
export function generateFinalSeed(pythSeed, backendSalt, gameId) {
  return keccak256(
    encodePacked(
      ['bytes32', 'bytes32', 'uint64', 'bytes32'],
      [pythSeed, backendSalt, BigInt(gameId), VERSION]
    )
  );
}

/**
 * Calculate mine positions using Fisher-Yates shuffle
 * Matches contract _isMine function exactly
 * @param {string} finalSeed - bytes32 hex string
 * @param {number|string} gameId - game ID
 * @param {number} gridSize - grid size (e.g., 25 for 5x5)
 * @param {number} mineCount - number of mines
 * @returns {number[]} sorted array of mine positions
 */
export function calculateMinePositions(finalSeed, gameId, gridSize, mineCount) {
  const positions = Array.from({ length: gridSize }, (_, i) => i);

  for (let i = 0; i < mineCount; i++) {
    const hash = keccak256(
      encodePacked(
        ['bytes32', 'uint64', 'string', 'uint8', 'bytes32'],
        [finalSeed, BigInt(gameId), 'mine', i, VERSION]
      )
    );
    const j = i + Number(BigInt(hash) % BigInt(gridSize - i));

    // Swap
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  // First mineCount positions are mines, return sorted
  return positions.slice(0, mineCount).sort((a, b) => a - b);
}

/**
 * Check if a specific tile is a mine
 */
export function isMine(finalSeed, gameId, gridSize, mineCount, tileIndex) {
  const minePositions = calculateMinePositions(finalSeed, gameId, gridSize, mineCount);
  return minePositions.includes(tileIndex);
}

/**
 * Verify backend salt hash commitment
 * Matches contract: keccak256(abi.encodePacked(backendSalt))
 */
export function verifySaltHash(backendSalt, expectedHash) {
  const computed = keccak256(encodePacked(['bytes32'], [backendSalt]));
  return computed.toLowerCase() === expectedHash.toLowerCase();
}

/**
 * Verify VRF commitment
 * Matches contract: keccak256(abi.encodePacked(pythSeed, gameId, VERSION))
 */
export function verifyVRFCommitment(pythSeed, gameId, expectedCommitment) {
  const computed = keccak256(
    encodePacked(
      ['bytes32', 'uint64', 'bytes32'],
      [pythSeed, BigInt(gameId), VERSION]
    )
  );
  return computed.toLowerCase() === expectedCommitment.toLowerCase();
}

/**
 * Build verification result from game data
 */
export function buildMineVerification(gameData) {
  if (!gameData || !gameData.vrf_seed || !gameData.backend_salt) {
    return { verified: false, error: 'Missing seed data' };
  }

  const { vrf_seed, backend_salt, game_id, grid_size, mine_count, mine_positions, revealed_tiles } = gameData;

  // Generate final seed
  const finalSeed = generateFinalSeed(vrf_seed, backend_salt, game_id);

  // Calculate expected mine positions
  const calculatedPositions = calculateMinePositions(finalSeed, game_id, grid_size, mine_count);

  // Compare with stored positions
  const storedPositions = [...(mine_positions || [])].sort((a, b) => a - b);
  const positionsMatch = JSON.stringify(calculatedPositions) === JSON.stringify(storedPositions);

  // Build tile verification
  const tiles = [];
  for (let i = 0; i < grid_size; i++) {
    const isCalculatedMine = calculatedPositions.includes(i);
    const isStoredMine = storedPositions.includes(i);
    const wasRevealed = (revealed_tiles || []).includes(i);

    tiles.push({
      index: i,
      isCalculatedMine,
      isStoredMine,
      wasRevealed,
      match: isCalculatedMine === isStoredMine
    });
  }

  return {
    verified: positionsMatch,
    finalSeed,
    calculatedPositions,
    storedPositions,
    tiles,
    error: null
  };
}

/**
 * Truncate hash for display
 */
export function truncateHash(hash, startChars = 10, endChars = 8) {
  if (!hash || hash.length <= startChars + endChars + 3) return hash;
  return `${hash.slice(0, startChars)}...${hash.slice(-endChars)}`;
}

/**
 * Format bet amount from wei to MON
 */
export function formatAmount(weiAmount) {
  if (!weiAmount) return '0';
  const amount = Number(BigInt(weiAmount)) / 1e18;
  return amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
}

/**
 * Get grid dimensions from grid size
 */
export function getGridDimensions(gridSize) {
  const sqrt = Math.sqrt(gridSize);
  if (Number.isInteger(sqrt)) {
    return { rows: sqrt, cols: sqrt };
  }
  // Fallback for non-square grids
  return { rows: 5, cols: 5 };
}
