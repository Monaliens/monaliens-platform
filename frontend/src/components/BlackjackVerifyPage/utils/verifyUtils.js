import { keccak256, encodePacked } from 'viem';

// Contract version constant (must match contract)
export const CONTRACT_VERSION = 'v1';

/**
 * Generate final seed from VRF seed (pythSeed) and backend salt
 * Matches contract: keccak256(abi.encodePacked(pythSeed, backendSalt))
 */
export function generateFinalSeed(pythSeed, backendSalt) {
  return keccak256(encodePacked(['bytes32', 'bytes32'], [pythSeed, backendSalt]));
}

/**
 * Generate card value from final seed
 * Matches contract _generateCard function exactly
 * @param {string} finalSeed - bytes32 hex string
 * @param {number|string} gameId - game ID
 * @param {number} cardIndex - card index (0-based)
 * @returns {number} card value 1-13 (Ace to King)
 */
export function generateCard(finalSeed, gameId, cardIndex) {
  const hash = keccak256(
    encodePacked(
      ['bytes32', 'uint64', 'uint8', 'string'],
      [finalSeed, BigInt(gameId), cardIndex, 'card']
    )
  );
  return Number(BigInt(hash) % 13n) + 1;
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
      ['bytes32', 'uint64', 'string'],
      [pythSeed, BigInt(gameId), CONTRACT_VERSION]
    )
  );
  return computed.toLowerCase() === expectedCommitment.toLowerCase();
}

/**
 * Convert card value (1-13) to display name
 */
export function cardToDisplay(value) {
  const names = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  return names[value] || '?';
}

/**
 * Get card purpose/label by index
 */
export function getCardPurpose(index, isSplit = false, handCount = 1) {
  if (handCount === 1) {
    // Normal game
    if (index === 0) return 'Player Card 1';
    if (index === 1) return 'Player Card 2';
    if (index === 2) return 'Dealer Up Card';
    if (index === 3) return 'Dealer Hole Card';
    return `Player Hit #${index - 3}`;
  } else {
    // Split game - different index mapping
    if (index === 0) return 'Hand 1 - Card 1';
    if (index === 1) return 'Hand 2 - Card 1';
    if (index === 2) return 'Dealer Up Card';
    if (index === 3) return 'Dealer Hole Card';
    if (index === 4) return 'Hand 1 - Card 2';
    if (index === 5) return 'Hand 2 - Card 2';
    return `Hit Card #${index - 5}`;
  }
}

/**
 * Build expected cards array from game data
 * Returns array of { index, purpose, expected, actual, match, used }
 * Generates all 20 cards for provably fair verification
 */
export function buildCardVerification(gameData, seedData) {
  if (!gameData || !seedData?.vrfSeed || !seedData?.backendSalt) {
    return { verified: false, cards: [], error: 'Missing seed data' };
  }

  const { vrfSeed, backendSalt } = seedData;
  const { gameId, playerHands, dealerUpCard, dealerHoleCard, dealerHitCards } = gameData;

  // Generate final seed
  const finalSeed = generateFinalSeed(vrfSeed, backendSalt);

  // Build map of actual cards used in game
  const actualCardsMap = new Map();
  const handCount = playerHands?.length || 1;
  const isSplit = handCount > 1;

  if (!isSplit) {
    // Normal game (1 hand)
    const playerCards = playerHands?.[0]?.cards || [];

    // Index 0-1: Player initial cards
    if (playerCards[0]) actualCardsMap.set(0, { actual: playerCards[0], purpose: 'Player Card 1' });
    if (playerCards[1]) actualCardsMap.set(1, { actual: playerCards[1], purpose: 'Player Card 2' });

    // Index 2-3: Dealer cards
    if (dealerUpCard) actualCardsMap.set(2, { actual: dealerUpCard, purpose: 'Dealer Up Card' });
    if (dealerHoleCard) actualCardsMap.set(3, { actual: dealerHoleCard, purpose: 'Dealer Hole Card' });

    // Index 4+: Player hit cards
    for (let i = 2; i < playerCards.length; i++) {
      const cardIndex = 4 + (i - 2);
      actualCardsMap.set(cardIndex, { actual: playerCards[i], purpose: `Player Hit #${i - 1}` });
    }

    // Dealer hit cards (after player cards)
    const dealerHits = dealerHitCards || [];
    const dealerStartIndex = 4 + Math.max(0, playerCards.length - 2);
    for (let i = 0; i < dealerHits.length; i++) {
      const cardIndex = dealerStartIndex + i;
      actualCardsMap.set(cardIndex, { actual: dealerHits[i], purpose: `Dealer Hit #${i + 1}` });
    }
  } else {
    // Split game (2 hands)
    const hand0Cards = playerHands?.[0]?.cards || [];
    const hand1Cards = playerHands?.[1]?.cards || [];

    // Index 0-1: Original split cards
    if (hand0Cards[0]) actualCardsMap.set(0, { actual: hand0Cards[0], purpose: 'Hand 1 - Card 1' });
    if (hand1Cards[0]) actualCardsMap.set(1, { actual: hand1Cards[0], purpose: 'Hand 2 - Card 1' });

    // Index 2-3: Dealer cards
    if (dealerUpCard) actualCardsMap.set(2, { actual: dealerUpCard, purpose: 'Dealer Up Card' });
    if (dealerHoleCard) actualCardsMap.set(3, { actual: dealerHoleCard, purpose: 'Dealer Hole Card' });

    // Index 4-5: Cards dealt after split
    if (hand0Cards[1]) actualCardsMap.set(4, { actual: hand0Cards[1], purpose: 'Hand 1 - Card 2' });
    if (hand1Cards[1]) actualCardsMap.set(5, { actual: hand1Cards[1], purpose: 'Hand 2 - Card 2' });

    // Hit cards
    let currentIndex = 6;
    for (let i = 2; i < hand0Cards.length; i++) {
      actualCardsMap.set(currentIndex, { actual: hand0Cards[i], purpose: `Hand 1 - Hit #${i - 1}` });
      currentIndex++;
    }
    for (let i = 2; i < hand1Cards.length; i++) {
      actualCardsMap.set(currentIndex, { actual: hand1Cards[i], purpose: `Hand 2 - Hit #${i - 1}` });
      currentIndex++;
    }

    // Dealer hit cards
    const dealerHits = dealerHitCards || [];
    for (let i = 0; i < dealerHits.length; i++) {
      actualCardsMap.set(currentIndex, { actual: dealerHits[i], purpose: `Dealer Hit #${i + 1}` });
      currentIndex++;
    }
  }

  // Generate all 20 cards
  const cards = [];
  let allUsedMatch = true;

  for (let i = 0; i < 20; i++) {
    const expected = generateCard(finalSeed, gameId, i);
    const actualData = actualCardsMap.get(i);
    const used = !!actualData;
    const actual = actualData?.actual || null;
    const purpose = actualData?.purpose || getDefaultPurpose(i);
    const match = used ? expected === actual : null;

    if (used && !match) {
      allUsedMatch = false;
    }

    cards.push({ index: i, purpose, expected, actual, match, used });
  }

  return {
    verified: allUsedMatch,
    cards,
    finalSeed,
    error: null
  };
}

/**
 * Get default purpose label for card index
 */
function getDefaultPurpose(index) {
  if (index === 0) return 'Player Card 1';
  if (index === 1) return 'Player Card 2';
  if (index === 2) return 'Dealer Up Card';
  if (index === 3) return 'Dealer Hole Card';
  return `Card #${index + 1}`;
}

/**
 * Calculate hand total (for display)
 */
export function calculateHandTotal(cards) {
  if (!cards || cards.length === 0) return { total: 0, isSoft: false };

  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card === 1) {
      aces++;
      total += 11;
    } else if (card >= 10) {
      total += 10;
    } else {
      total += card;
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return { total, isSoft: aces > 0 && total <= 21 };
}

/**
 * Truncate hash for display
 */
export function truncateHash(hash, startChars = 10, endChars = 8) {
  if (!hash || hash.length <= startChars + endChars + 3) return hash;
  return `${hash.slice(0, startChars)}...${hash.slice(-endChars)}`;
}
