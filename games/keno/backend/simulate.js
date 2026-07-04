// Keno House Edge Simulation
// Calculates expected return based on probability distribution

// Multiplier table (same as contract)
const MULTIPLIERS = {
  1: { 0: 0, 1: 3.80 },
  2: { 0: 0, 1: 1.00, 2: 9.00 },
  3: { 0: 0, 1: 0, 2: 2.00, 3: 25.00 },
  4: { 0: 0, 1: 0, 2: 1.00, 3: 6.00, 4: 60.00 },
  5: { 0: 0, 1: 0, 2: 0, 3: 3.00, 4: 12.00, 5: 100.00 },
  6: { 0: 0, 1: 0, 2: 0, 3: 1.50, 4: 5.00, 5: 50.00, 6: 100.00 },
  7: { 0: 0, 1: 0, 2: 0, 3: 1.00, 4: 3.00, 5: 15.00, 6: 50.00, 7: 100.00 },
  8: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 2.00, 5: 8.00, 6: 40.00, 7: 80.00, 8: 100.00 },
  9: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 1.50, 5: 5.00, 6: 20.00, 7: 50.00, 8: 80.00, 9: 100.00 },
  10: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 1.00, 5: 3.00, 6: 10.00, 7: 40.00, 8: 70.00, 9: 90.00, 10: 100.00 }
};

const HOUSE_EDGE = 0.025; // 2.5%

// Factorial with memoization
const factorialCache = { 0: 1n, 1: 1n };
function factorial(n) {
  if (factorialCache[n]) return factorialCache[n];
  let result = 1n;
  for (let i = 2n; i <= BigInt(n); i++) {
    result *= i;
  }
  factorialCache[n] = result;
  return result;
}

// Combination C(n, r) = n! / (r! * (n-r)!)
function combination(n, r) {
  if (r > n || r < 0) return 0n;
  if (r === 0 || r === n) return 1n;
  return factorial(n) / (factorial(r) * factorial(n - r));
}

// Hypergeometric probability
// P(H hits | K picks, 10 drawn, 40 total)
function hitProbability(picks, hits) {
  // C(picks, hits) * C(40-picks, 10-hits) / C(40, 10)
  const numerator = combination(picks, hits) * combination(40 - picks, 10 - hits);
  const denominator = combination(40, 10);
  return Number(numerator * 1000000n / denominator) / 1000000;
}

// Calculate expected return for a given pick count
function expectedReturn(picks) {
  let totalReturn = 0;
  console.log(`\n--- ${picks} Picks ---`);

  for (let hits = 0; hits <= Math.min(picks, 10); hits++) {
    const prob = hitProbability(picks, hits);
    const mult = MULTIPLIERS[picks][hits] || 0;
    const payout = mult * (1 - HOUSE_EDGE); // Apply house edge
    const contribution = prob * payout;
    totalReturn += contribution;

    if (prob > 0.0001) {
      console.log(`  ${hits} hits: ${(prob * 100).toFixed(4)}% chance, ${mult}x mult, payout ${payout.toFixed(4)}x, contributes ${(contribution * 100).toFixed(4)}%`);
    }
  }

  return totalReturn;
}

// Simulate games
function simulateGames(numGames, picks, betAmount) {
  console.log(`\n========================================`);
  console.log(`SIMULATION: ${numGames} games, ${picks} picks, ${betAmount} MON bet each`);
  console.log(`========================================`);

  let totalBet = 0;
  let totalWon = 0;
  const hitCounts = {};

  for (let i = 0; i < numGames; i++) {
    totalBet += betAmount;

    // Player picks random numbers
    const playerNumbers = new Set();
    while (playerNumbers.size < picks) {
      playerNumbers.add(Math.floor(Math.random() * 40) + 1);
    }

    // System draws 10 random numbers
    const drawnNumbers = new Set();
    while (drawnNumbers.size < 10) {
      drawnNumbers.add(Math.floor(Math.random() * 40) + 1);
    }

    // Count hits
    let hits = 0;
    for (const num of playerNumbers) {
      if (drawnNumbers.has(num)) hits++;
    }

    hitCounts[hits] = (hitCounts[hits] || 0) + 1;

    // Calculate payout
    const mult = MULTIPLIERS[picks][hits] || 0;
    const payout = betAmount * mult * (1 - HOUSE_EDGE);
    totalWon += payout;
  }

  console.log(`\nHit Distribution:`);
  for (let h = 0; h <= picks; h++) {
    const count = hitCounts[h] || 0;
    const pct = (count / numGames * 100).toFixed(2);
    const expectedPct = (hitProbability(picks, h) * 100).toFixed(2);
    console.log(`  ${h} hits: ${count} times (${pct}%) - expected: ${expectedPct}%`);
  }

  console.log(`\nResults:`);
  console.log(`  Total Bet: ${totalBet} MON`);
  console.log(`  Total Won: ${totalWon.toFixed(2)} MON`);
  console.log(`  Net P/L: ${(totalWon - totalBet).toFixed(2)} MON`);
  console.log(`  Return: ${(totalWon / totalBet * 100).toFixed(2)}%`);
  console.log(`  House Edge (actual): ${((1 - totalWon / totalBet) * 100).toFixed(2)}%`);

  return { totalBet, totalWon };
}

// Mathematical expected return calculation
console.log('='.repeat(60));
console.log('MATHEMATICAL EXPECTED RETURN (based on probability)');
console.log('='.repeat(60));

for (let picks = 1; picks <= 10; picks++) {
  const er = expectedReturn(picks);
  console.log(`  >> Expected Return for ${picks} picks: ${(er * 100).toFixed(2)}%`);
  console.log(`  >> House Edge: ${((1 - er) * 100).toFixed(2)}%`);
}

// Run simulations
console.log('\n' + '='.repeat(60));
console.log('MONTE CARLO SIMULATION (1000 games each)');
console.log('='.repeat(60));

const BET_AMOUNT = 10; // 10 MON
const NUM_GAMES = 1000;

let grandTotalBet = 0;
let grandTotalWon = 0;

for (let picks = 1; picks <= 10; picks++) {
  const { totalBet, totalWon } = simulateGames(NUM_GAMES, picks, BET_AMOUNT);
  grandTotalBet += totalBet;
  grandTotalWon += totalWon;
}

console.log('\n' + '='.repeat(60));
console.log('GRAND TOTAL (all pick counts combined)');
console.log('='.repeat(60));
console.log(`Total Bet: ${grandTotalBet} MON`);
console.log(`Total Won: ${grandTotalWon.toFixed(2)} MON`);
console.log(`Net P/L: ${(grandTotalWon - grandTotalBet).toFixed(2)} MON`);
console.log(`Overall Return: ${(grandTotalWon / grandTotalBet * 100).toFixed(2)}%`);
console.log(`Overall House Edge: ${((1 - grandTotalWon / grandTotalBet) * 100).toFixed(2)}%`);
