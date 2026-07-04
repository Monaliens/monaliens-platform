# Games Overview

## Comparison Table

| Game | Path | Mechanic | Randomness | Game State DB | Contract Standard |
|------|------|----------|-----------|--------------|------------------|
| Hi-Lo | `games/hilo/` | Card comparison (higher/lower) | Pyth Entropy V2 | SQLite (active hand) + MongoDB (history) | UUPS upgradeable |
| Keno | `games/keno/` | Number pick + match | Pyth Entropy V2 | MongoDB | UUPS upgradeable |
| Limbo | `games/limbo/` | Multiplier crash | Pyth Entropy V2 | MongoDB | UUPS upgradeable |
| Mines | `games/mines/` | Grid mine avoidance | Pyth Entropy V2 | SQLite (active grid) + MongoDB (history) | UUPS upgradeable |
| Dice | `games/dice/` | Roll over/under | Pyth Entropy V2 | MongoDB | UUPS upgradeable |
| Plinko | `games/plinko/` | Pegged ball drop | Pyth Entropy V2 | MongoDB | UUPS upgradeable |
| Blackjack | `games/blackjack/` | Card game (multi-step) | Pyth Entropy V2 | SQLite (active game) + MongoDB (history) | UUPS upgradeable |
| Coin Flip | `games/coinflip/` | Binary 50/50 | Pyth Entropy V2 | MongoDB | UUPS upgradeable |
| Spin Wheel | `games/spinwheel/` | Weighted wheel spin | Chainlink VRF (legacy) | MongoDB | Non-upgradeable (v1) / UUPS (v2) |
| Walkie | `games/walkie/` | Bomb-defusal grid | Pyth Entropy V2 | MongoDB | UUPS upgradeable |

---

## Game Descriptions

### Hi-Lo (`games/hilo/`)
Players bet on whether the next card drawn will be higher or lower than the current card. Odds scale with the probability of being correct — guessing "higher" on a 2 pays much less than guessing "higher" on a King. Game state (current card, streak, cumulative bet) is held in SQLite between card reveals so the backend can respond synchronously over WebSocket without a Mongo round-trip.

### Keno (`games/keno/`)
Players select between 1 and 10 numbers from a grid of 40. The contract draws 20 numbers using the Pyth VRF. Payout multipliers are determined by the number of spots picked and the number matched. A single-transaction settle — the player places their bet and receives the result in the Pyth callback.

### Limbo (`games/limbo/`)
The player sets a target multiplier (e.g. 3.5x) and places a bet. The contract generates a random multiplier; if the result exceeds the target, the player wins. Lower targets win more often but pay less. Settled in one round-trip: bet → Pyth callback → payout.

### Mines (`games/mines/`)
A 5×5 grid hides a configurable number of mines (1–24). The player reveals tiles one at a time, collecting an increasing multiplier for each safe tile. At any point they can cash out. Each tile reveal is a separate blockchain transaction; the mine layout is committed at game start using Pyth entropy and stored in SQLite so reveals can be validated without re-querying the chain.

### Dice (`games/dice/`)
The player picks a target number and a direction (roll over / roll under). The contract rolls a number from 1–10000. Win probability and payout multiplier are derived from the target. Dice has a `ReentrancyAttacker` test contract in its test suite to guard against reentrancy exploits.

### Plinko (`games/plinko/`)
A ball is dropped through a triangular peg board. The ball hits pegs and deflects left or right at each level. The final slot it lands in determines the payout. Row count and risk level (low/medium/high multipliers) are configurable. The random path is determined by Pyth entropy and expanded on-chain using a PRNG.

### Blackjack (`games/blackjack/`)
Standard Blackjack rules (hit, stand, double down, split, surrender) implemented on-chain. Because Blackjack requires multiple card draws per hand, each player action triggers a new Pyth entropy request. Game state (hand, phase, bet) is stored in SQLite between actions. Players submit each action as a direct wallet transaction.

### Coin Flip (`games/coinflip/`)
A straightforward 50/50 bet — heads or tails. The Pyth VRF produces the result. House edge is applied through the payout multiplier rather than result manipulation. Fastest game to settle: one bet transaction, one Pyth callback.

### Spin Wheel (`games/spinwheel/`)
A prize wheel with weighted segments. The original `SpinWheel.sol` uses Chainlink VRF and is not upgradeable. `SpinWheelv2.sol` is a rewrite that improves the architecture. The SpinWheel backend and frontend were written before the rest of the platform standardised on Pyth Entropy, making SpinWheel the architectural outlier in the game suite.

### Walkie (`games/walkie/`)
A bomb-defusal style game implemented in `Bombomb.sol`. Players navigate a grid revealing safe cells to accumulate multipliers, avoiding hidden bombs. Mechanically similar to Mines but with different grid dimensions and multiplier curves.

---

## Common Pattern: Pyth Entropy V2 Commit-Reveal

All games except SpinWheel follow the same on-chain randomness pattern:

```solidity
// 1. Player calls placeBet, passing their own random seed
function placeBet(bytes32 userSeed) external payable {
    uint128 fee = entropy.getFee(provider);
    uint64 seqNum = entropy.requestWithCallback{value: fee}(provider, userSeed);
    games[seqNum] = Game({ player: msg.sender, bet: msg.value - fee, ... });
}

// 2. Pyth calls back with the VRF result
function entropyCallback(
    uint64 sequenceNumber,
    address provider,
    bytes32 randomNumber
) external override {
    require(msg.sender == address(entropy));
    Game storage game = games[sequenceNumber];
    // Expand randomNumber into game outcome
    _settleGame(game, randomNumber);
}
```

The `PRNG.sol` helper (present in each game's `contracts/` directory) expands a single 32-byte random seed into multiple independent random values using keccak256 chaining.

---

## SpinWheel: Chainlink VRF Architecture

SpinWheel predates the platform's adoption of Pyth Entropy. It integrates with Chainlink VRF V2:

- The contract inherits `VRFConsumerBaseV2` and calls `coordinator.requestRandomWords(...)`.
- Chainlink's oracle fulfils the request by calling `fulfillRandomWords(uint256 requestId, uint256[] memory randomWords)`.
- The subscription model requires MON-equivalent LINK tokens to fund the VRF subscription.

When evaluating SpinWheel's code, note that the VRF interface, fee model, and callback function signatures all differ from the Pyth Entropy pattern used by every other game.
