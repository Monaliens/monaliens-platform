require('dotenv').config();
const mongoose = require('mongoose');
const { ethers } = require('ethers');

const PLAYER = process.argv[2]

const gameSchema = new mongoose.Schema({
  game_id: String,
  player: String,
  bet_amount: String,
  hits: Number,
  won: Boolean,
  payout: String,
  selected_numbers: [Number],
  risk_level: Number
});

const Game = mongoose.model('Game', gameSchema);

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const games = await Game.find({ player: PLAYER.toLowerCase() }).lean();

  const total = games.length;
  const wins = games.filter(g => g.won).length;
  const losses = total - wins;

  let totalBet = 0n;
  let totalPayout = 0n;

  for (const g of games) {
    totalBet += BigInt(g.bet_amount || '0');
    totalPayout += BigInt(g.payout || '0');
  }

  const rtp = (Number(totalPayout) / Number(totalBet) * 100).toFixed(2);

  console.log('=== PLAYER ANALYSIS ===');
  console.log('Player:', PLAYER);
  console.log('');
  console.log('Total Games:', total);
  console.log('Wins:', wins);
  console.log('Losses:', losses);
  console.log('Win Rate:', (wins / total * 100).toFixed(2) + '%');
  console.log('');
  console.log('Total Bet:', ethers.formatEther(totalBet), 'MON');
  console.log('Total Payout:', ethers.formatEther(totalPayout), 'MON');
  console.log('Net P/L:', ethers.formatEther(totalPayout - totalBet), 'MON');
  console.log('');
  console.log('Player RTP:', rtp + '%');
  console.log('');

  // Hits distribution
  const hitsDist = {};
  for (const g of games) {
    const picks = g.selected_numbers ? g.selected_numbers.length : 0;
    const key = g.hits + '/' + picks;
    if (!hitsDist[key]) {
      hitsDist[key] = { count: 0, wins: 0 };
    }
    hitsDist[key].count++;
    if (g.won) hitsDist[key].wins++;
  }

  console.log('=== HITS DISTRIBUTION ===');
  const sortedKeys = Object.keys(hitsDist).sort((a, b) => {
    const [aH] = a.split('/').map(Number);
    const [bH] = b.split('/').map(Number);
    return aH - bH;
  });

  for (const k of sortedKeys) {
    const d = hitsDist[k];
    const pct = (d.count / total * 100).toFixed(2);
    console.log(k + ': ' + d.count + ' games (' + pct + '%) - ' + d.wins + ' wins');
  }

  await mongoose.disconnect();
}

main().catch(console.error);
