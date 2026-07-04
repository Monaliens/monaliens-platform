/**
 * Contract Configuration
 * Contains addresses, ABIs, and metadata for all monitored contracts
 */

require('dotenv').config();

// Contract Addresses from environment
const contractAddresses = {
  // Fixed contracts
  spin: process.env.SPIN_CONTRACT_ADDRESS || '0x3456789012345678901234567890123456789012',
  raffleFactory: process.env.RAFFLE_FACTORY_ADDRESS || '0x2345678901234567890123456789012345678901',
  
  // Multiple offer factories (comma-separated in env)
  offerFactories: process.env.OFFER_FACTORY_ADDRESSES 
    ? process.env.OFFER_FACTORY_ADDRESSES.split(',').map(addr => addr.trim())
    : ['0x1234567890123456789012345678901234567890'],
  
  // Dynamic contracts (populated at runtime)
  raffleContracts: new Map(), // raffleId -> contractAddress
  offerContracts: new Map(),  // offerId -> contractAddress
};

// Contract ABIs (event-focused)
const contractABIs = {
  // Spin Contract ABI
  spin: [
    'event WheelSpun(address indexed player, string rewardName, uint256 rewardAmount, bool usedNFT, uint256 nftId)',
    'function getSpinHistory(address player) view returns (tuple(uint256 timestamp, string rewardName, uint256 rewardAmount, uint256 nftId)[])',
    'function spinCount(address player) view returns (uint256)'
  ],

  // Raffle Factory ABI
  raffleFactory: [
    'event RaffleCreated(uint256 indexed raffleId, address indexed raffleAddress, address indexed owner, uint256 createdAt)',
    'function totalRaffles() view returns (uint256)',
    'function getTotalRaffles() view returns (uint256)',
    'function getRaffleDetails(uint256 raffleId) view returns (tuple(address raffleAddress, address owner, uint256 createdAt, bool isActive))',
    'function getAllActiveRaffles() view returns (tuple(address raffleAddress, address owner, uint256 createdAt, bool isActive)[])'
  ],

  // Individual Raffle Contract ABI
  raffle: [
    'event TicketsPurchased(address indexed buyer, uint256 amount)',
    'event WinnerDrawn(address indexed winner)',
    'event PrizeClaimed(address indexed winner)',
    'event FeesWithdrawn(address indexed owner, uint256 amount)',
    'event RaffleExtended(uint256 newEndTime)',
    'function getRaffleInfo() view returns (tuple(address owner, uint8 prizeType, address prizeContractAddress, uint256 prizeTokenId, uint256 prizeAmount, bool prizeInEscrow, uint256 ticketPrice, address ticketTokenAddress, uint256 maxTicketsPerWallet, uint256 maxTotalTickets, uint256 endTime, address winner, uint8 status, bool participantsVisible, bool participantCountVisible, uint256 totalTicketsSold, uint256 platformFeePercentage, address platformFeeWallet))',
    'function tickets(address) view returns (uint256)',
    'function getParticipants() view returns (address[])'
  ],

  // Offer Factory ABI
  offerFactory: [
    'event OfferCreated(uint256 indexed offerId, address indexed offerContract, address indexed maker, uint256 targetOfferId, uint8 offerType, address targetUser, address collectionAddress, uint256 deadline, string title, string description)',
    'event OfferAccepted(uint256 indexed offerId, address indexed offerContract, address indexed acceptor)',
    'event OfferCancelled(uint256 indexed offerId, address indexed offerContract, address indexed maker)',
    'event OfferExpired(uint256 indexed offerId, address indexed offerContract, address indexed maker)',
    'event SettlementExecuted(uint256 indexed offerId, address indexed admin, string reason)',
    'function currentOfferId() view returns (uint256)',
    'function offerContracts(uint256 offerId) view returns (address)',
    'function offerTargets(uint256 offerId) view returns (uint256)'
  ],

  // Individual Offer Contract ABI
  offer: [
    'event OfferAccepted(address indexed acceptor, address indexed maker)',
    'event TargetedOfferAccepted(address indexed targetedOfferContract, address indexed maker, address indexed acceptor)',
    'event OfferCancelled(address indexed maker)',
    'event OfferExpiredEvent(address indexed maker)',
    'function getMaker() view returns (address)',
    'function getStatus() view returns (uint8)',
    'function getOfferedAssets() view returns (tuple(uint8 assetType, address contractAddress, uint256 tokenIdOrAmount, uint256 amount, bool isSpecific)[])',
    'function getRequestedAssets() view returns (tuple(uint8 assetType, address contractAddress, uint256 tokenIdOrAmount, uint256 amount, bool isSpecific)[])',
    'function assetsInEscrow() view returns (bool)',
    'function getTitle() view returns (string)',
    'function getDescription() view returns (string)',
    'function deadline() view returns (uint256)',
    'function targetUser() view returns (address)',
    'function collectionAddress() view returns (address)',
    'function offerType() view returns (uint8)'
  ]
};

// Contract Types
const ContractType = {
  SPIN: 'spin',
  RAFFLE_FACTORY: 'raffleFactory',
  RAFFLE: 'raffle',
  OFFER_FACTORY: 'offerFactory',
  OFFER: 'offer'
};

// Event Types
const EventType = {
  // Spin Events
  WHEEL_SPUN: 'WheelSpun',
  
  // Raffle Factory Events
  RAFFLE_CREATED: 'RaffleCreated',
  
  // Raffle Events
  TICKETS_PURCHASED: 'TicketsPurchased',
  WINNER_DRAWN: 'WinnerDrawn',
  PRIZE_CLAIMED: 'PrizeClaimed',
  FEES_WITHDRAWN: 'FeesWithdrawn',
  RAFFLE_EXTENDED: 'RaffleExtended',
  
  // Offer Factory Events
  OFFER_CREATED: 'OfferCreated',
  OFFER_ACCEPTED: 'OfferAccepted',
  OFFER_CANCELLED: 'OfferCancelled',
  OFFER_EXPIRED: 'OfferExpired',
  SETTLEMENT_EXECUTED: 'SettlementExecuted',
  
  // Offer Contract Events
  OFFER_ACCEPTED_DIRECT: 'OfferAccepted',
  TARGETED_OFFER_ACCEPTED: 'TargetedOfferAccepted',
  OFFER_CANCELLED_DIRECT: 'OfferCancelled',
  OFFER_EXPIRED_DIRECT: 'OfferExpiredEvent'
};

// Contract Configuration Manager
class ContractConfig {
  /**
   * Get contract address by type and identifier
   */
  static getAddress(type, identifier = null) {
    switch (type) {
      case ContractType.SPIN:
        return contractAddresses.spin;
      case ContractType.RAFFLE_FACTORY:
        return contractAddresses.raffleFactory;
      case ContractType.RAFFLE:
        return contractAddresses.raffleContracts.get(identifier);
      case ContractType.OFFER_FACTORY:
        return contractAddresses.offerFactories[identifier] || contractAddresses.offerFactories[0];
      case ContractType.OFFER:
        return contractAddresses.offerContracts.get(identifier);
      default:
        throw new Error(`Unknown contract type: ${type}`);
    }
  }

  /**
   * Get contract ABI by type
   */
  static getABI(type) {
    if (!contractABIs[type]) {
      throw new Error(`ABI not found for contract type: ${type}`);
    }
    return contractABIs[type];
  }

  /**
   * Add dynamic contract address
   */
  static addDynamicContract(type, identifier, address) {
    switch (type) {
      case ContractType.RAFFLE:
        contractAddresses.raffleContracts.set(identifier, address);
        console.log(` Added raffle contract ${identifier}: ${address}`);
        break;
      case ContractType.OFFER:
        contractAddresses.offerContracts.set(identifier, address);
        console.log(` Added offer contract ${identifier}: ${address}`);
        break;
      default:
        throw new Error(`Cannot add dynamic contract of type: ${type}`);
    }
  }

  /**
   * Remove dynamic contract address
   */
  static removeDynamicContract(type, identifier) {
    switch (type) {
      case ContractType.RAFFLE:
        contractAddresses.raffleContracts.delete(identifier);
        console.log(` Removed raffle contract ${identifier}`);
        break;
      case ContractType.OFFER:
        contractAddresses.offerContracts.delete(identifier);
        console.log(` Removed offer contract ${identifier}`);
        break;
      default:
        throw new Error(`Cannot remove dynamic contract of type: ${type}`);
    }
  }

  /**
   * Get all addresses for a contract type
   */
  static getAllAddresses(type) {
    switch (type) {
      case ContractType.OFFER_FACTORY:
        return contractAddresses.offerFactories;
      case ContractType.RAFFLE:
        return Array.from(contractAddresses.raffleContracts.values());
      case ContractType.OFFER:
        return Array.from(contractAddresses.offerContracts.values());
      default:
        const single = this.getAddress(type);
        return single ? [single] : [];
    }
  }

  /**
   * Validate contract configuration
   */
  static validate() {
    const errors = [];

    // Check required contracts
    if (!contractAddresses.spin) {
      errors.push('Missing SPIN_CONTRACT_ADDRESS');
    }
    if (!contractAddresses.raffleFactory) {
      errors.push('Missing RAFFLE_FACTORY_ADDRESS');
    }
    if (contractAddresses.offerFactories.length === 0) {
      console.warn(' No offer factories configured');
    }

    if (errors.length > 0) {
      throw new Error(`Contract configuration errors: ${errors.join(', ')}`);
    }

    console.log(' Contract configuration validated');
    return true;
  }

  /**
   * Get contract configuration for a specific type
   */
  static getContractConfig(type) {
    switch (type) {
      case ContractType.SPIN:
        return {
          addresses: [contractAddresses.spin],
          abi: contractABIs.spin
        };
      case ContractType.RAFFLE_FACTORY:
        return {
          addresses: [contractAddresses.raffleFactory],
          abi: contractABIs.raffleFactory
        };
      case ContractType.RAFFLE:
        return {
          addresses: Array.from(contractAddresses.raffleContracts.values()),
          abi: contractABIs.raffle
        };
      case ContractType.OFFER_FACTORY:
      case 'offerFactory':
        return {
          addresses: contractAddresses.offerFactories,
          abi: contractABIs.offerFactory
        };
      case ContractType.OFFER:
        return {
          addresses: Array.from(contractAddresses.offerContracts.values()),
          abi: contractABIs.offer
        };
      default:
        throw new Error(`Unknown contract type: ${type}`);
    }
  }

  /**
   * Get configuration summary
   */
  static getSummary() {
    return {
      spin: contractAddresses.spin,
      raffleFactory: contractAddresses.raffleFactory,
      offerFactories: contractAddresses.offerFactories.length,
      dynamicRaffles: contractAddresses.raffleContracts.size,
      dynamicOffers: contractAddresses.offerContracts.size
    };
  }

  /**
   * Dynamically load contract addresses & ABIs from a remote JSON endpoint.
   *
   * This allows us to keep the on-chain configuration in one place (the mock RPC
   * /contracts endpoint provided by QA/dev) without having to rebuild the
   * listener every time the contracts are redeployed.
   *
   * The endpoint must return a JSON object. A very permissive example:
   * {
   *   "spin": { "address": "0x..", "abi": ["event WheelSpun(..)"] },
   *   "raffleFactory": { "address": "0x..", "abi": ["event RaffleCreated(..)"] },
   *   "offerFactories": [
   *     { "address": "0x..", "abi": ["event OfferCreated(..)"] }
   *   ]
   * }
   *
   * Unrecognised keys are ignored. Missing keys keep their default values so we
   *   always have a sane baseline even if the endpoint is down.
   */
  static async loadRemote(endpoint = process.env.CONTRACTS_ENDPOINT || 'https://your-rpc-endpoint.example.com/contracts') {
    // Only attempt fetch if an endpoint is provided – allows offline usage.
    if (!endpoint) {
      console.warn('  No CONTRACTS_ENDPOINT specified – skipping remote contract load');
      return;
    }

    try {
      const fetchImpl = (typeof fetch === 'function') ? fetch : (await import('node-fetch')).default;
      const res = await fetchImpl(endpoint);
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }

      /** @type {Record<string, any>} */
      const remoteData = await res.json();
      console.log('  Loaded remote contract configuration from', endpoint);

      // Helper to update address/abi when present.
      const apply = (key, dataObj) => {
        if (!dataObj) return;
        if (dataObj.address) {
          switch (key) {
            case ContractType.SPIN:
              contractAddresses.spin = dataObj.address;
              break;
            case ContractType.RAFFLE_FACTORY:
              contractAddresses.raffleFactory = dataObj.address;
              break;
            default:
              // dynamic types – ignore, handled elsewhere
              break;
          }
        }
        if (Array.isArray(dataObj.abi) && dataObj.abi.length > 0) {
          contractABIs[key] = dataObj.abi;
        }
      };

      // Fixed-address contracts
      apply(ContractType.SPIN,           remoteData.spin);
      apply(ContractType.RAFFLE_FACTORY, remoteData.raffleFactory);

      // Offer factories (can be many)
      if (Array.isArray(remoteData.offerFactories) && remoteData.offerFactories.length > 0) {
        contractAddresses.offerFactories = remoteData.offerFactories.map((o) => o.address);
        // Assume all factories share the same ABI – take first one.
        if (remoteData.offerFactories[0] && Array.isArray(remoteData.offerFactories[0].abi)) {
          contractABIs.offerFactory = remoteData.offerFactories[0].abi;
        }
      }

      // Spin contract may be provided under another key (legacy support)
      if (!remoteData.spin && remoteData.spinContract) {
        apply(ContractType.SPIN, remoteData.spinContract);
      }

      // Support alternate key names from mock RPC
      const keyMap = {
        SPIN_WHEEL: ContractType.SPIN,
        RAFFLE_FACTORY: ContractType.RAFFLE_FACTORY,
        P2P_TRADING_FACTORY: ContractType.OFFER_FACTORY
      };
      for (const [remoteKey, localType] of Object.entries(keyMap)) {
        if (remoteData.contracts && remoteData.contracts[remoteKey]) {
          apply(localType, {
            address: remoteData.contracts[remoteKey].address,
            abi: remoteData.contracts[remoteKey].abi
          });
        }
      }

    } catch (err) {
      console.error(' Failed to load remote contract configuration:', err.message);
      console.error('    Proceeding with local fallback configuration');
    }
  }
}

module.exports = {
  contractAddresses,
  contractABIs,
  ContractType,
  EventType,
  ContractConfig
}; 