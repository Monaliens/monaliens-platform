/**
 * Whitelisted Game Contracts
 *
 */

const WHITELISTED_CONTRACTS = [
  "0xa7A7A590D79c2D8778c981C47276211ef1CFaca7", // Blackjack
  "0x541997E9FAB55BAFbe1e5c8AE9F320674A30F5a0", // Mines
  "0xA7e6f5609429E4f92Cff10ade4aD058De392BF2c", // Dice
  "0xa17D9e5d0882097D866C4495ee323ad6E802Fb32", // Limbo
  "0x12910d41f561EA125eECBe270a61BA0638697fd8", // HiLo
  "0x5CFcE619d3cC9ea21dd0d4da0Ea3C03E45d25c60", // Coin Flip
  "0xFB39b4850d6699D518175e17dF145c05cc8b954F", // Spin Wheel
  "0xE5D2f5d2a8dcc3be155cdF70A864F63aeF459107", // Keno
  "0xEB2dAA9Fc48B7b20bcFC953F85800aF2f1461295", // Plinko
  "0xD458261E832415CFd3BAE5E416FdF3230ce6F134", // Entropy
].map(addr => addr.toLowerCase());

function isWhitelisted(address) {
  if (!address) return false;
  return WHITELISTED_CONTRACTS.includes(address.toLowerCase());
}

function getWhitelistedContracts() {
  return [...WHITELISTED_CONTRACTS];
}

module.exports = {
  WHITELISTED_CONTRACTS,
  isWhitelisted,
  getWhitelistedContracts
};
