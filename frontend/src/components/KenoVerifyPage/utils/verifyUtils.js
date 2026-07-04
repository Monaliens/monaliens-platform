import { keccak256, encodePacked } from 'viem';

// Grid and draw constants
export const GRID_SIZE = 40;  // Numbers 1-40
export const DRAW_COUNT = 10; // System draws 10 numbers

/**
 * Normalize hex string - add 0x prefix if not present
 */
function normalizeHex(hex) {
  if (!hex) return hex;
  return hex.startsWith('0x') ? hex : `0x${hex}`;
}

/**
 * The random_number from API is already the combined seed from Pyth Entropy
 * This is used directly in the draw calculation
 */
export function generateFinalSeed(randomNumber) {
  return normalizeHex(randomNumber);
}

/**
 * Calculate drawn numbers using Fisher-Yates shuffle
 * Matches contract _drawNumbers function exactly:
 *
 * function _drawNumbers(bytes32 random) internal pure returns (uint8[10] memory) {
 *     uint8[40] memory pool;
 *     for (uint8 i = 0; i < 40; i++) {
 *         pool[i] = i + 1;
 *     }
 *     uint8[10] memory drawn;
 *     for (uint8 i = 0; i < 10; i++) {
 *         uint256 randomIndex = uint256(keccak256(abi.encodePacked(random, i)));
 *         uint8 j = i + uint8(randomIndex % (40 - i));
 *         (pool[i], pool[j]) = (pool[j], pool[i]);
 *         drawn[i] = pool[i];
 *     }
 *     return drawn;
 * }
 *
 * @param {string} randomNumber - bytes32 hex string (random_number from API)
 * @returns {number[]} array of 10 drawn numbers (1-40)
 */
export function calculateDrawnNumbers(randomNumber) {
  const random = normalizeHex(randomNumber);

  // Create pool of numbers 1-40 (same as contract)
  const pool = Array.from({ length: GRID_SIZE }, (_, i) => i + 1);

  const drawn = [];

  // Fisher-Yates shuffle - draw 10 numbers (same as contract)
  for (let i = 0; i < DRAW_COUNT; i++) {
    // Generate random index: keccak256(abi.encodePacked(random, i))
    const hash = keccak256(
      encodePacked(
        ['bytes32', 'uint8'],
        [random, i]
      )
    );

    // j = i + (randomIndex % (40 - i))
    const j = i + Number(BigInt(hash) % BigInt(GRID_SIZE - i));

    // Swap pool[i] and pool[j]
    const temp = pool[i];
    pool[i] = pool[j];
    pool[j] = temp;

    // drawn[i] = pool[i]
    drawn.push(pool[i]);
  }

  return drawn;
}

/**
 * Build verification result from game data
 */
export function buildKenoVerification(gameData) {
  if (!gameData || !gameData.random_number) {
    return { verified: false, error: 'Missing random seed data' };
  }

  const {
    drawn_numbers,
    selected_numbers,
    random_number
  } = gameData;

  // The random_number from API is already the combined seed from Pyth Entropy
  const finalSeed = generateFinalSeed(random_number);

  // Calculate expected drawn numbers using the exact contract algorithm
  const calculatedDrawnNumbers = calculateDrawnNumbers(random_number);

  // Compare with stored drawn numbers
  const storedDrawnNumbers = [...(drawn_numbers || [])];

  // Check if all drawn numbers match (in order)
  const numbersMatch = calculatedDrawnNumbers.length === storedDrawnNumbers.length &&
    calculatedDrawnNumbers.every((num, idx) => num === storedDrawnNumbers[idx]);

  // Build grid verification (40 numbers)
  const grid = [];
  const selectedSet = new Set(selected_numbers || []);
  const drawnSet = new Set(calculatedDrawnNumbers);
  const storedDrawnSet = new Set(storedDrawnNumbers);

  for (let i = 1; i <= GRID_SIZE; i++) {
    const isSelected = selectedSet.has(i);
    const isCalculatedDrawn = drawnSet.has(i);
    const isStoredDrawn = storedDrawnSet.has(i);
    const drawOrder = calculatedDrawnNumbers.indexOf(i);

    grid.push({
      number: i,
      isSelected,
      isCalculatedDrawn,
      isStoredDrawn,
      drawOrder: drawOrder !== -1 ? drawOrder + 1 : null,
      isHit: isSelected && isCalculatedDrawn,
      match: isCalculatedDrawn === isStoredDrawn
    });
  }

  // Calculate hits
  const hits = selected_numbers?.filter(n => drawnSet.has(n)).length || 0;

  return {
    verified: numbersMatch,
    finalSeed,
    calculatedDrawnNumbers,
    storedDrawnNumbers,
    grid,
    hits,
    selectedCount: selected_numbers?.length || 0,
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
 * Get risk level name
 */
export function getRiskLevelName(riskLevel) {
  const names = ['Classic', 'Low', 'Medium', 'High'];
  return names[riskLevel] || 'Classic';
}
