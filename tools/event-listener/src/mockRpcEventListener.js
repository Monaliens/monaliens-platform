// src/mockRpcEventListener.js

// Lightweight standalone listener for the demo/mock RPC
// It does NOT use the full unified event-listener infrastructure.
// It simply connects to the RPC, sets up log filters for every
// event signature provided by the user, decodes the log and prints
// the resulting arguments to stdout so you can verify that the
// mock chain is emitting the expected events.

require('dotenv').config();

const { ethers } = require('ethers');

/************************************************************
 * Configuration                                            *
 ************************************************************/
// The RPC URL can be supplied through env (MOCK_RPC_URL) or
// will default to the user-provided endpoint.
const RPC_URL = process.env.MOCK_RPC_URL || 'http://localhost:8545';

// Addresses that emit the events (for filtering purposes).
// If you want to listen to *all* addresses just set the value
// to undefined; otherwise keep them as provided.
const CONTRACT_ADDRESSES = {
  P2P_TRADING_FACTORY: '0x1234567890123456789012345678901234567890',
  RAFFLE_FACTORY: '0x2345678901234567890123456789012345678901',
  SPIN_WHEEL: '0x3456789012345678901234567890123456789012'
};

/************************************************************
 * Event metadata                                           *
 ************************************************************/
// Topics (keccak256 hashes) for the events we want to monitor.
const EVENT_SIGNATURES = {
  // P2P Trading Factory
  OFFER_CREATED:   '0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef123456',
  OFFER_ACCEPTED:  '0x234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
  OFFER_CANCELLED: '0x34567890abcdef123456789abcdef123456789abcdef123456789abcdef123456',
  OFFER_EXPIRED:   '0x4567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234',

  // Raffle Factory
  RAFFLE_CREATED:     '0x567890abcdef123456789abcdef123456789abcdef123456789abcdef12345678',
  TICKETS_PURCHASED:  '0x67890abcdef12345678abcdef123456789abcdef123456789abcdef123456789',
  WINNER_DRAWN:       '0x7890abcdef123456789abcdef123456789abcdef123456789abcdef1234567890',
  PRIZE_CLAIMED:      '0x890abcdef123456789abcdef123456789abcdef123456789abcdef12345678901',

  // Spin Wheel
  WHEEL_SPUN: '0x90abcdef123456789abcdef123456789abcdef123456789abcdef123456789012'
};

// Human-readable ABI fragments (used solely for decoding).
// They must match the on-chain events exactly.
const EVENT_TYPES = {
  // P2P Trading
  OFFER_CREATED: {
    name: 'OfferCreated',
    signature: 'OfferCreated(uint256,address,address,uint256,uint8,address,address,uint256,string,string)'
  },
  OFFER_ACCEPTED: {
    name: 'OfferAccepted',
    signature: 'OfferAccepted(uint256,address,address)'
  },
  OFFER_CANCELLED: {
    name: 'OfferCancelled',
    signature: 'OfferCancelled(uint256,address,address)'
  },
  OFFER_EXPIRED: {
    name: 'OfferExpired',
    signature: 'OfferExpired(uint256,address,address)'
  },

  // Raffle events
  RAFFLE_CREATED: {
    name: 'RaffleCreated',
    signature: 'RaffleCreated(uint256,address,address,uint256)'
  },
  TICKETS_PURCHASED: {
    name: 'TicketsPurchased',
    signature: 'TicketsPurchased(address,uint256)'
  },
  WINNER_DRAWN: {
    name: 'WinnerDrawn',
    signature: 'WinnerDrawn(address)'
  },
  PRIZE_CLAIMED: {
    name: 'PrizeClaimed',
    signature: 'PrizeClaimed(address)'
  },

  // Spin Wheel
  WHEEL_SPUN: {
    name: 'WheelSpun',
    signature: 'WheelSpun(address,string,uint256,bool,uint256)'
  }
};

/************************************************************
 * Implementation                                           *
 ************************************************************/
async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  console.log(' Listening to mock RPC:', RPC_URL);
  console.log(' Subscribing to events ...');

  // Create a decoder interface for every event definition.
  const interfaces = {};
  for (const [key, meta] of Object.entries(EVENT_TYPES)) {
    interfaces[key] = new ethers.Interface([`event ${meta.signature}`]);
  }

  // Helper to pretty-print decoded arguments.
  function formatArgs(args) {
    return args.map((v) => (typeof v === 'bigint' ? v.toString() : v));
  }

  // Set up listeners – one filter per topic to avoid extra RPC load.
  for (const [key, topic] of Object.entries(EVENT_SIGNATURES)) {
    const intf = interfaces[key];

    // Try to narrow filter to emitting contract if we know it.
    let address;
    switch (key) {
      case 'WHEEL_SPUN':
        address = CONTRACT_ADDRESSES.SPIN_WHEEL;
        break;
      case 'RAFFLE_CREATED':
      case 'TICKETS_PURCHASED':
      case 'WINNER_DRAWN':
      case 'PRIZE_CLAIMED':
        address = CONTRACT_ADDRESSES.RAFFLE_FACTORY;
        break;
      default:
        // P2P trading events
        address = CONTRACT_ADDRESSES.P2P_TRADING_FACTORY;
    }

    const filter = { address, topics: [topic] };

    provider.on(filter, (log) => {
      try {
        const parsed = intf.parseLog(log);
        console.log('\n', intf.fragments[0].name, 'at block', log.blockNumber);
        console.log('   tx:', log.transactionHash);
        console.log('   args:', formatArgs(parsed.args));
      } catch (err) {
        console.error('Failed to decode log', err);
      }
    });
  }

  // Keep process alive.
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});