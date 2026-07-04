const Raffle = require('../models/Raffle');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { ethers } = require('ethers');
const Joi = require('joi');
const axios = require('axios');
const redisCache = require('../services/redisCache');
const priceService = require('../services/priceService');

// Helper function to convert IPFS URI to HTTP gateway URL
function convertIPFSUriToHttp(uri) {
  if (!uri) return '';

  // Already HTTP URL
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }

  // IPFS protocol
  if (uri.startsWith('ipfs://')) {
    const hash = uri.replace('ipfs://', '');
    return `https://ipfs.io/ipfs/${hash}`;
  }

  // IPFS gateway format
  if (uri.includes('/ipfs/')) {
    return uri;
  }

  return uri;
}

// Helper function to fetch NFT metadata with Redis cache (30 min TTL)
async function fetchNFTMetadata(contractAddress, tokenId) {
  const normalizedAddress = contractAddress.toLowerCase();
  const cacheKey = `nft:metadata:${normalizedAddress}:${tokenId}`;

  try {
    // Check cache first
    const cachedMetadata = await redisCache.get(cacheKey);
    if (cachedMetadata) {
      return cachedMetadata;
    }

    // Try direct NFT endpoint first
    const response = await axios.get(
      `${process.env.API_URL || "https://your-api-url"}/api/nft/${normalizedAddress}/${tokenId}/owner`,
      {
        headers: {
          'accept': '*/*',
          'content-type': 'application/json'
        },
        timeout: 5000 // 5 second timeout
      }
    );

    if (response.data && response.data.success && response.data.data) {
      const data = response.data.data;
      let nftMetadata = data.metadata || {};

      // If metadata is missing but metadata_uri exists, fetch from URI
      if ((!nftMetadata || Object.keys(nftMetadata).length === 0) && data.metadata_uri) {
        try {
          // Try multiple IPFS gateways as fallback
          const gateways = [
            'https://ipfs.io/ipfs/',
            'https://cloudflare-ipfs.com/ipfs/',
            'https://gateway.pinata.cloud/ipfs/',
            'https://dweb.link/ipfs/'
          ];

          // Extract IPFS hash from metadata_uri
          let ipfsHash = data.metadata_uri;
          if (ipfsHash.startsWith('ipfs://')) {
            ipfsHash = ipfsHash.replace('ipfs://', '');
          } else if (ipfsHash.includes('/ipfs/')) {
            ipfsHash = ipfsHash.split('/ipfs/')[1];
          }

          let fetchSuccess = false;
          for (const gateway of gateways) {
            try {
              const metadataUrl = gateway + ipfsHash;
              console.log(`Trying gateway: ${metadataUrl}`);
              const metadataResponse = await axios.get(metadataUrl, {
                headers: {
                  'accept': 'application/json',
                  'user-agent': 'Mozilla/5.0 (compatible; RaffleBot/1.0)'
                },
                timeout: 10000
              });
              if (metadataResponse.data) {
                nftMetadata = metadataResponse.data;
                console.log(` Successfully fetched metadata from ${gateway} for ${contractAddress}/${tokenId}`);
                fetchSuccess = true;
                break;
              }
            } catch (gatewayError) {
              console.log(`Gateway ${gateway} failed, trying next...`);
              continue;
            }
          }

          if (!fetchSuccess) {
            console.error(` All IPFS gateways failed for ${contractAddress}/${tokenId}`);
          }
        } catch (uriError) {
          console.error(` Failed to fetch metadata from metadata_uri for ${contractAddress}/${tokenId}:`, uriError.message);
        }
      }

      // Extract collection name
      let collectionName = 'Unknown Collection';
      if (data.collection && data.collection.name) {
        collectionName = data.collection.name;
      } else if (nftMetadata.name && nftMetadata.name.includes('#')) {
        collectionName = nftMetadata.name.split('#')[0].trim();
      }

      // Convert image URI to HTTP if needed - prioritize nftMetadata.image, fallback to collection.image
      const imageUri = nftMetadata.image || data.image || (data.collection && data.collection.image) || '';
      const imageUrl = imageUri ? convertIPFSUriToHttp(imageUri) : '';

      // Fetch floor price and verification status from Magic Eden stats API
      let floorPrice = null;
      let isVerified = false;
      try {
        const statsResponse = await axios.get(
          `https://stats-mainnet.magiceden.io/collection_stats/stats?chain=monad&collectionId=${normalizedAddress}`,
          {
            headers: {
              'accept': 'application/json'
            },
            timeout: 5000
          }
        );

        if (statsResponse.data) {
          if (statsResponse.data.floorPrice) {
            floorPrice = {
              amount: statsResponse.data.floorPrice.amount || 0,
              currency: statsResponse.data.floorPrice.currency || 'MON',
              native: statsResponse.data.floorPrice.native || 0
            };
          }
          isVerified = statsResponse.data.isVerified || false;
        }
      } catch (statsError) {
        console.log(` Failed to fetch stats for NFT collection ${normalizedAddress}: ${statsError.message}`);
      }

      const metadata = {
        name: nftMetadata.name || `NFT #${tokenId}`,
        image: imageUrl,
        imageLarge: imageUrl,
        imageSmall: imageUrl,
        description: nftMetadata.description || '',
        collectionName: collectionName,
        floorPrice: floorPrice,
        isVerified: isVerified,
        owner: data.owner,
        attributes: (nftMetadata.attributes || []).map(attr => ({
          trait_type: attr.traitType || attr.trait_type || attr.key || '',
          value: attr.value || ''
        }))
      };

      // Cache for 30 minutes (1800 seconds)
      await redisCache.set(cacheKey, metadata, 1800);
      return metadata;
    }

    // Cache null result for 5 minutes to prevent API spam
    await redisCache.set(cacheKey, null, 300);
    return null;

  } catch (error) {
    console.error(`Error fetching NFT metadata for ${contractAddress}/${tokenId}:`, error.message);

    // Cache error result for 5 minutes to prevent repeated failures
    await redisCache.set(cacheKey, null, 300);
    return null;
  }
}

// Helper function to fetch Collection metadata with Redis cache (1 month TTL)
async function fetchCollectionMetadata(contractAddress) {
  const normalizedAddress = contractAddress.toLowerCase();
  const cacheKey = `collection:metadata:${normalizedAddress}`;

  try {
    // Check cache first
    const cachedMetadata = await redisCache.get(cacheKey);
    if (cachedMetadata) {
      return cachedMetadata;
    }

    // Try multiple token IDs as fallback (some collections might not have token ID 1, 2, 3, etc.)
    const tokenIdsToTry = [1, 2, 3, 0, 10, 100];

    for (const tokenId of tokenIdsToTry) {
      try {
        // Fetch collection data via NFT endpoint
        // Monaliens API doesn't have a dedicated collection endpoint
        const response = await axios.get(
          `${process.env.API_URL || "https://your-api-url"}/api/nft/${normalizedAddress}/${tokenId}/owner`,
          {
            headers: {
              'accept': '*/*',
              'content-type': 'application/json'
            },
            timeout: 5000 // 5 second timeout
          }
        );

        if (response.data && response.data.success && response.data.data && response.data.data.collection) {
          const collection = response.data.data.collection;

          // Convert image URI to HTTP if needed
          const imageUri = collection.image || '';
          const imageUrl = imageUri ? convertIPFSUriToHttp(imageUri) : '';

          const metadata = {
            name: collection.name || 'Unknown Collection',
            image: imageUrl,
            holderCount: collection.holder_count || 0,
            nftCount: collection.nft_count || 0,
            contractAddress: normalizedAddress
          };

          // Cache for 1 month (2592000 seconds = 30 days)
          await redisCache.set(cacheKey, metadata, 2592000);
          console.log(` Successfully fetched collection metadata for ${normalizedAddress}: ${metadata.name}`);
          return metadata;
        }
      } catch (tokenError) {
        // Try next token ID
        continue;
      }
    }

    // If all token IDs failed, cache null result for 1 hour to prevent API spam
    console.error(` Failed to fetch collection metadata for ${contractAddress}: All token IDs failed`);
    await redisCache.set(cacheKey, null, 3600);
    return null;

  } catch (error) {
    console.error(`Error fetching collection metadata for ${contractAddress}:`, error.message);

    // Cache error result for 1 hour to prevent repeated failures
    await redisCache.set(cacheKey, null, 3600);
    return null;
  }
}

// Validation schemas
const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('ACTIVE', 'ENDED', 'DRAWN', 'CANCELLED', 'CLAIMED'),
  owner: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/),
  prizeType: Joi.string().valid('TOKEN', 'NFT'),
  sortBy: Joi.string().valid('createdAt', 'endTime', 'totalTicketsSold', 'totalRevenue').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  search: Joi.string().max(100),
  includeParticipants: Joi.boolean().default(true) // Phase 1: Optional param, default true for backward compatibility
});

// Get all raffles with filtering and pagination
exports.getAllRaffles = async (req, res) => {
  try {
    const { error, value } = querySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        error: error.details[0].message
      });
    }

    const { page, limit, status, owner, prizeType, sortBy, sortOrder, search, includeParticipants } = value;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = { isDeleted: false };
    
    if (status) filter.status = status;
    if (owner) filter.owner = owner.toLowerCase();
    if (prizeType) filter.prizeType = prizeType;
    if (search) {
      filter.$or = [
        { 'prizeMetadata.name': { $regex: search, $options: 'i' } },
        { 'prizeMetadata.description': { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [raffles, total, monPrice] = await Promise.all([
      Raffle.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Raffle.countDocuments(filter),
      priceService.getMonPrice()
    ]);

    // Get all raffle IDs for batch querying
    const raffleIds = raffles.map(r => r.raffleId);

    // Batch query 1: Get all ticket stats in one aggregation
    const ticketStatsArray = await Ticket.aggregate([
      { $match: { raffleId: { $in: raffleIds }, isValid: true } },
      { 
        $group: { 
          _id: '$raffleId',
          totalTickets: { $sum: '$ticketCount' },
          totalParticipants: { $addToSet: '$owner' }
        } 
      },
      {
        $project: {
          raffleId: '$_id',
          totalTickets: 1,
          totalParticipants: { $size: '$totalParticipants' },
          _id: 0
        }
      }
    ]);

    // Convert to map for O(1) lookup
    const ticketStatsMap = {};
    ticketStatsArray.forEach(stat => {
      ticketStatsMap[stat.raffleId] = stat;
    });

    // Batch query 2: Get all participants for visible raffles in one aggregation
    // Phase 1: Only fetch participants if includeParticipants is true
    let participantsMap = {};
    
    if (includeParticipants) {
      const visibleRaffleIds = raffles
        .filter(r => r.participantsVisible)
        .map(r => r.raffleId);

      if (visibleRaffleIds.length > 0) {
        const participantsArray = await Ticket.aggregate([
          { $match: { raffleId: { $in: visibleRaffleIds }, isValid: true } },
          { 
            $group: { 
              _id: { raffleId: '$raffleId', owner: '$owner' },
              tickets: { $sum: '$ticketCount' }
            } 
          },
          {
            $group: {
              _id: '$_id.raffleId',
              participants: {
                $push: {
                  address: '$_id.owner',
                  tickets: '$tickets'
                }
              }
            }
          },
          {
            $project: {
              raffleId: '$_id',
              participants: { $slice: ['$participants', 100] }, // Limit to 100 participants per raffle
              _id: 0
            }
          }
        ]);

        participantsArray.forEach(item => {
          participantsMap[item.raffleId] = item.participants.sort((a, b) => b.tickets - a.tickets);
        });
      }
    }

    // Map the data to raffles (no more individual queries!)
    const enrichedRaffles = raffles.map(raffle => {
      // Use stored values if available, otherwise use aggregated stats
      const ticketStats = ticketStatsMap[raffle.raffleId] || {
        totalTickets: raffle.totalTicketsSold || 0,
        totalParticipants: raffle.totalParticipants || 0
      };

      // If stored values exist and are non-zero, prefer them over aggregation
      const totalTicketsSold = raffle.totalTicketsSold > 0 ? raffle.totalTicketsSold : ticketStats.totalTickets;
      const totalParticipants = raffle.totalParticipants > 0 ? raffle.totalParticipants : ticketStats.totalParticipants;

      // Phase 1: Return participants only if includeParticipants is true
      const participants = (includeParticipants && raffle.participantsVisible)
        ? (participantsMap[raffle.raffleId] || [])
        : null;

      // Always include participant count (lightweight data)
      const participantCount = raffle.participantsVisible ? totalParticipants : null;

      // Determine actual status
      const actualStatus = (raffle.status === 'DRAWN' && raffle.prizeClaimTransactionHash)
        ? 'CLAIMED'
        : raffle.status;

      // Set timeRemaining to 0 for CLAIMED raffles
      const timeRemaining = actualStatus === 'CLAIMED'
        ? 0
        : Math.max(0, new Date(raffle.endTime) - new Date());

      // Calculate prizeInUsd for TOKEN prizes
      let prizeInUsd = null;
      if (raffle.prizeType === 'TOKEN' && monPrice && raffle.prizeAmountFormatted) {
        prizeInUsd = parseFloat((raffle.prizeAmountFormatted * monPrice).toFixed(2));
      }

      return {
        ...raffle,
        status: actualStatus,
        totalTicketsSold,
        totalParticipants,
        participantCount, // Always included (lightweight)
        participants, // Only included if includeParticipants=true
        timeRemaining,
        isEnded: actualStatus === 'CLAIMED' ? true : new Date() > new Date(raffle.endTime),
        prizeInUsd,
        monPrice: monPrice ? parseFloat(monPrice.toFixed(4)) : null
      };
    });

    // Fetch NFT metadata and holder collection metadata in parallel
    const rafflesWithMetadata = await Promise.all(
      enrichedRaffles.map(async (raffle) => {
        const metadataPromises = [];

        // Fetch NFT metadata for NFT prizes
        if (raffle.prizeType === 'NFT' && raffle.prizeContractAddress && raffle.prizeTokenId) {
          metadataPromises.push(
            fetchNFTMetadata(raffle.prizeContractAddress, raffle.prizeTokenId)
              .then(metadata => ({ prizeNFTMetadata: metadata }))
          );
        }

        // Fetch holder collection metadata for holder-only raffles
        if (raffle.isHolderOnly && raffle.holderCollection) {
          metadataPromises.push(
            fetchCollectionMetadata(raffle.holderCollection)
              .then(metadata => ({ holderCollectionMetadata: metadata }))
          );
        }

        // Wait for all metadata fetches
        const metadataResults = await Promise.all(metadataPromises);

        // Merge all metadata into raffle object
        return {
          ...raffle,
          ...metadataResults.reduce((acc, curr) => ({ ...acc, ...curr }), {})
        };
      })
    );

    res.json({
      success: true,
      data: {
        raffles: rafflesWithMetadata,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all raffles error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get active raffles
exports.getActiveRaffles = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const activeRaffles = await Raffle.find({
      status: 'ACTIVE',
      isActive: true,
      isDeleted: false,
      endTime: { $gt: new Date() }
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

    // Batch query optimization for active raffles
    const raffleIds = activeRaffles.map(r => r.raffleId);
    
    // Skip aggregation if no raffles
    if (raffleIds.length === 0) {
      return res.json({
        success: true,
        data: {
          raffles: []
        }
      });
    }
    
    // Get all ticket stats in one query
    const ticketStatsArray = await Ticket.aggregate([
      { $match: { raffleId: { $in: raffleIds }, isValid: true } },
      { 
        $group: { 
          _id: '$raffleId',
          totalTickets: { $sum: '$ticketCount' },
          totalParticipants: { $addToSet: '$owner' }
        } 
      },
      {
        $project: {
          raffleId: '$_id',
          totalTickets: 1,
          totalParticipants: { $size: '$totalParticipants' },
          _id: 0
        }
      }
    ]);

    const ticketStatsMap = {};
    ticketStatsArray.forEach(stat => {
      ticketStatsMap[stat.raffleId] = stat;
    });

    // Get participants for visible raffles
    const visibleRaffleIds = activeRaffles.filter(r => r.participantsVisible).map(r => r.raffleId);
    let participantsMap = {};
    
    if (visibleRaffleIds.length > 0) {
      const participantsArray = await Ticket.aggregate([
        { $match: { raffleId: { $in: visibleRaffleIds }, isValid: true } },
        { 
          $group: { 
            _id: { raffleId: '$raffleId', owner: '$owner' },
            tickets: { $sum: '$ticketCount' }
          } 
        },
        {
          $group: {
            _id: '$_id.raffleId',
            participants: {
              $push: {
                address: '$_id.owner',
                tickets: '$tickets'
              }
            }
          }
        },
        {
          $project: {
            raffleId: '$_id',
            participants: { $slice: ['$participants', 100] },
            _id: 0
          }
        }
      ]);

      participantsArray.forEach(item => {
        participantsMap[item.raffleId] = item.participants.sort((a, b) => b.tickets - a.tickets);
      });
    }

    const enrichedRaffles = activeRaffles.map(raffle => {
      const ticketStats = ticketStatsMap[raffle.raffleId] || {
        totalTickets: raffle.totalTicketsSold || 0,
        totalParticipants: raffle.totalParticipants || 0
      };

      const totalTicketsSold = raffle.totalTicketsSold > 0 ? raffle.totalTicketsSold : ticketStats.totalTickets;
      const totalParticipants = raffle.totalParticipants > 0 ? raffle.totalParticipants : ticketStats.totalParticipants;
      const participants = raffle.participantsVisible ? (participantsMap[raffle.raffleId] || []) : null;

      return {
        ...raffle,
        totalTicketsSold,
        totalParticipants,
        participants,
        timeRemaining: new Date(raffle.endTime) - new Date()
      };
    });

    // Fetch NFT metadata and holder collection metadata in parallel
    const rafflesWithMetadata = await Promise.all(
      enrichedRaffles.map(async (raffle) => {
        const metadataPromises = [];

        // Fetch NFT metadata for NFT prizes
        if (raffle.prizeType === 'NFT' && raffle.prizeContractAddress && raffle.prizeTokenId) {
          metadataPromises.push(
            fetchNFTMetadata(raffle.prizeContractAddress, raffle.prizeTokenId)
              .then(metadata => ({ prizeNFTMetadata: metadata }))
          );
        }

        // Fetch holder collection metadata for holder-only raffles
        if (raffle.isHolderOnly && raffle.holderCollection) {
          metadataPromises.push(
            fetchCollectionMetadata(raffle.holderCollection)
              .then(metadata => ({ holderCollectionMetadata: metadata }))
          );
        }

        // Wait for all metadata fetches
        const metadataResults = await Promise.all(metadataPromises);

        // Merge all metadata into raffle object
        return {
          ...raffle,
          ...metadataResults.reduce((acc, curr) => ({ ...acc, ...curr }), {})
        };
      })
    );

    res.json({
      success: true,
      data: {
        raffles: rafflesWithMetadata
      }
    });
  } catch (error) {
    console.error('Get active raffles error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get raffle by ID
exports.getRaffleById = async (req, res) => {
  try {
    const { id: raffleId } = req.params;

    const raffle = await Raffle.findOne({ 
      raffleId, 
      isDeleted: false 
    }).lean();

    if (!raffle) {
      return res.status(404).json({
        success: false,
        message: 'Raffle not found'
      });
    }

    // Get ticket statistics
    const ticketStats = await Ticket.getTotalTicketsForRaffle(raffleId);
    
    // Get participants if visible
    let participants = [];
    if (raffle.participantsVisible) {
      participants = await Ticket.getRaffleLeaderboard(raffleId, 50);
    }

    // Get user's tickets if address provided
    let userTickets = null;
    if (req.query.userAddress && ethers.isAddress(req.query.userAddress.toLowerCase())) {
      const userTicketData = await Ticket.getUserTicketsForRaffle(raffleId, req.query.userAddress);
      userTickets = {
        tickets: userTicketData,
        totalTickets: userTicketData.reduce((sum, ticket) => sum + ticket.ticketCount, 0),
        totalSpent: userTicketData.reduce((sum, ticket) => sum + parseFloat(ticket.totalCost), 0).toString()
      };
    }

    // Fetch NFT metadata, holder collection metadata, and MON price in parallel
    const metadataPromises = [];

    if (raffle.prizeType === 'NFT' && raffle.prizeContractAddress && raffle.prizeTokenId) {
      metadataPromises.push(
        fetchNFTMetadata(raffle.prizeContractAddress, raffle.prizeTokenId)
          .then(metadata => ({ prizeNFTMetadata: metadata }))
      );
    }

    if (raffle.isHolderOnly && raffle.holderCollection) {
      metadataPromises.push(
        fetchCollectionMetadata(raffle.holderCollection)
          .then(metadata => ({ holderCollectionMetadata: metadata }))
      );
    }

    // Fetch MON price for TOKEN prizes
    metadataPromises.push(
      priceService.getMonPrice()
        .then(price => ({ monPrice: price }))
    );

    const metadataResults = await Promise.all(metadataPromises);
    const allMetadata = metadataResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});

    // Calculate prizeInUsd for TOKEN prizes
    let prizeInUsd = null;
    if (raffle.prizeType === 'TOKEN' && allMetadata.monPrice && raffle.prizeAmountFormatted) {
      prizeInUsd = parseFloat((raffle.prizeAmountFormatted * allMetadata.monPrice).toFixed(2));
    }
    const monPrice = allMetadata.monPrice ? parseFloat(allMetadata.monPrice.toFixed(4)) : null;
    delete allMetadata.monPrice; // Remove from allMetadata to avoid duplication

    // Determine actual status - if prize is claimed, status should be CLAIMED
    const actualStatus = (raffle.status === 'DRAWN' && raffle.prizeClaimTransactionHash)
      ? 'CLAIMED'
      : raffle.status;

    // Set timeRemaining to 0 for CLAIMED raffles to show as "Ended"
    const timeRemaining = actualStatus === 'CLAIMED'
      ? 0
      : Math.max(0, new Date(raffle.endTime) - new Date());

    res.json({
      success: true,
      data: {
        ...raffle,
        status: actualStatus,  // Override status if prize is claimed
        totalTicketsSold: ticketStats.totalTickets,
        totalParticipants: ticketStats.totalParticipants,
        participants: raffle.participantsVisible ? participants : null,
        participantCount: raffle.participantCountVisible ? ticketStats.totalParticipants : null,
        userTickets,
        timeRemaining,
        isEnded: actualStatus === 'CLAIMED' ? true : new Date() > new Date(raffle.endTime),
        prizeInUsd,
        monPrice,
        ...allMetadata
      }
    });
  } catch (error) {
    console.error('Get raffle by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get raffles by owner
exports.getRafflesByOwner = async (req, res) => {
  try {
    const { ownerAddress } = req.params;

    if (!ethers.isAddress(ownerAddress.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid owner address'
      });
    }

    const [raffles, monPrice] = await Promise.all([
      Raffle.find({
        owner: ownerAddress.toLowerCase(),
        isDeleted: false
      })
      .sort({ createdAt: -1 })
      .lean(),
      priceService.getMonPrice()
    ]);

    const enrichedRaffles = await Promise.all(
      raffles.map(async (raffle) => {
        const ticketStats = await Ticket.getTotalTicketsForRaffle(raffle.raffleId);

        // Get simple participants list
        let participants = [];
        if (raffle.participantsVisible) {
          const participantData = await Ticket.aggregate([
            { $match: { raffleId: raffle.raffleId, isValid: true } },
            { $group: { _id: '$owner', tickets: { $sum: '$ticketCount' } } },
            { $project: { address: '$_id', tickets: 1, _id: 0 } },
            { $sort: { tickets: -1 } }
          ]);
          participants = participantData;
        }

        // Fetch NFT metadata if prize type is NFT
        let metadata = null;
        if (raffle.prizeType === 'NFT' && raffle.prizeContractAddress && raffle.prizeTokenId) {
          metadata = await fetchNFTMetadata(raffle.prizeContractAddress, raffle.prizeTokenId);
        }

        // Calculate prizeInUsd for TOKEN prizes
        let prizeInUsd = null;
        if (raffle.prizeType === 'TOKEN' && monPrice && raffle.prizeAmountFormatted) {
          prizeInUsd = parseFloat((raffle.prizeAmountFormatted * monPrice).toFixed(2));
        }

        // Determine actual status
        const actualStatus = (raffle.status === 'DRAWN' && raffle.prizeClaimTransactionHash)
          ? 'CLAIMED'
          : raffle.status;

        // Set timeRemaining to 0 for CLAIMED raffles
        const timeRemaining = actualStatus === 'CLAIMED'
          ? 0
          : Math.max(0, new Date(raffle.endTime) - new Date());

        return {
          ...raffle,
          status: actualStatus,  // Override status if prize is claimed
          totalTicketsSold: ticketStats.totalTickets,
          totalParticipants: ticketStats.totalParticipants,
          participants: raffle.participantsVisible ? participants : null,
          timeRemaining,
          isEnded: actualStatus === 'CLAIMED' ? true : new Date() > new Date(raffle.endTime),
          prizeNFTMetadata: metadata,
          prizeInUsd,
          monPrice: monPrice ? parseFloat(monPrice.toFixed(4)) : null
        };
      })
    );

    res.json({
      success: true,
      data: enrichedRaffles
    });
  } catch (error) {
    console.error('Get raffles by owner error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get win chance for a user in a specific raffle
exports.getWinChance = async (req, res) => {
  try {
    const { raffleId } = req.params;
    const { userAddress } = req.query;

    if (!userAddress || !ethers.isAddress(userAddress.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Valid user address is required'
      });
    }

    const [userTickets, totalStats] = await Promise.all([
      Ticket.getUserTicketsForRaffle(raffleId, userAddress),
      Ticket.getTotalTicketsForRaffle(raffleId)
    ]);

    const userTicketCount = userTickets.reduce((sum, ticket) => sum + ticket.ticketCount, 0);
    const winChance = totalStats.totalTickets > 0 
      ? (userTicketCount / totalStats.totalTickets) * 100 
      : 0;

    res.json({
      success: true,
      data: {
        userTickets: userTicketCount,
        totalTickets: totalStats.totalTickets,
        winChance: winChance,
        winChanceFormatted: `${winChance.toFixed(2)}%`
      }
    });
  } catch (error) {
    console.error('Get win chance error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get recent updates since timestamp
exports.getRecentUpdates = async (req, res) => {
  try {
    const { since } = req.query;
    
    if (!since) {
      return res.status(400).json({
        success: false,
        message: 'Since timestamp is required'
      });
    }

    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid timestamp format'
      });
    }

    // Find raffles updated since the given timestamp
    const updates = await Raffle.find({
      isDeleted: false,
      $or: [
        { winnerDrawnAt: { $gte: sinceDate } },
        { prizeClaimedAt: { $gte: sinceDate } },
        { feesWithdrawnAt: { $gte: sinceDate } },
        { updatedAt: { $gte: sinceDate } }
      ]
    })
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();

    res.json(updates);
  } catch (error) {
    console.error('Get recent updates error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get raffle statistics
exports.getRaffleStats = async (req, res) => {
  try {
    const { raffleId } = req.params;

    const [raffle, ticketStats, recentTickets] = await Promise.all([
      Raffle.findOne({ raffleId, isDeleted: false }),
      Ticket.getTotalTicketsForRaffle(raffleId),
      Ticket.find({ raffleId, isValid: true })
        .sort({ purchasedAt: -1 })
        .limit(10)
        .lean()
    ]);

    if (!raffle) {
      return res.status(404).json({
        success: false,
        message: 'Raffle not found'
      });
    }

    // Calculate additional stats
    const totalRevenue = recentTickets.reduce((sum, ticket) => sum + parseFloat(ticket.totalCost), 0);
    const averageTicketsPerUser = ticketStats.totalParticipants > 0 
      ? ticketStats.totalTickets / ticketStats.totalParticipants 
      : 0;

    res.json({
      success: true,
      data: {
        basic: {
          raffleId,
          totalTicketsSold: ticketStats.totalTickets,
          totalParticipants: ticketStats.totalParticipants,
          totalRevenue: totalRevenue.toString(),
          averageTicketsPerUser: Math.round(averageTicketsPerUser * 100) / 100
        },
        timing: {
          startTime: raffle.startTime,
          endTime: raffle.endTime,
          timeRemaining: Math.max(0, new Date(raffle.endTime) - new Date()),
          isEnded: new Date() > new Date(raffle.endTime),
          duration: new Date(raffle.endTime) - new Date(raffle.startTime)
        },
        recentActivity: recentTickets.map(ticket => ({
          owner: ticket.owner,
          ticketCount: ticket.ticketCount,
          totalCost: ticket.totalCost,
          purchasedAt: ticket.purchasedAt
        }))
      }
    });
  } catch (error) {
    console.error('Get raffle stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get ended raffles
exports.getEndedRaffles = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const endedRaffles = await Raffle.find({
      $or: [
        { status: 'ENDED' },
        { status: 'DRAWN' },
        { status: 'CLAIMED' },
        { endTime: { $lt: new Date() } }
      ],
      isDeleted: false
    })
    .sort({ endTime: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

    // Batch query optimization for ended raffles
    const raffleIds = endedRaffles.map(r => r.raffleId);
    
    // Skip aggregation if no raffles
    if (raffleIds.length === 0) {
      return res.json({
        success: true,
        data: {
          raffles: []
        }
      });
    }
    
    const ticketStatsArray = await Ticket.aggregate([
      { $match: { raffleId: { $in: raffleIds }, isValid: true } },
      { 
        $group: { 
          _id: '$raffleId',
          totalTickets: { $sum: '$ticketCount' },
          totalParticipants: { $addToSet: '$owner' }
        } 
      },
      {
        $project: {
          raffleId: '$_id',
          totalTickets: 1,
          totalParticipants: { $size: '$totalParticipants' },
          _id: 0
        }
      }
    ]);

    const ticketStatsMap = {};
    ticketStatsArray.forEach(stat => {
      ticketStatsMap[stat.raffleId] = stat;
    });

    const visibleRaffleIds = endedRaffles.filter(r => r.participantsVisible).map(r => r.raffleId);
    let participantsMap = {};
    
    if (visibleRaffleIds.length > 0) {
      const participantsArray = await Ticket.aggregate([
        { $match: { raffleId: { $in: visibleRaffleIds }, isValid: true } },
        { 
          $group: { 
            _id: { raffleId: '$raffleId', owner: '$owner' },
            tickets: { $sum: '$ticketCount' }
          } 
        },
        {
          $group: {
            _id: '$_id.raffleId',
            participants: {
              $push: {
                address: '$_id.owner',
                tickets: '$tickets'
              }
            }
          }
        },
        {
          $project: {
            raffleId: '$_id',
            participants: { $slice: ['$participants', 100] },
            _id: 0
          }
        }
      ]);

      participantsArray.forEach(item => {
        participantsMap[item.raffleId] = item.participants.sort((a, b) => b.tickets - a.tickets);
      });
    }

    const enrichedRaffles = endedRaffles.map(raffle => {
      const ticketStats = ticketStatsMap[raffle.raffleId] || {
        totalTickets: raffle.totalTicketsSold || 0,
        totalParticipants: raffle.totalParticipants || 0
      };

      const totalTicketsSold = raffle.totalTicketsSold > 0 ? raffle.totalTicketsSold : ticketStats.totalTickets;
      const totalParticipants = raffle.totalParticipants > 0 ? raffle.totalParticipants : ticketStats.totalParticipants;
      const participants = raffle.participantsVisible ? (participantsMap[raffle.raffleId] || []) : null;

      return {
        ...raffle,
        totalTicketsSold,
        totalParticipants,
        participants
      };
    });

    // Fetch NFT metadata and holder collection metadata in parallel
    const rafflesWithMetadata = await Promise.all(
      enrichedRaffles.map(async (raffle) => {
        const metadataPromises = [];

        // Fetch NFT metadata for NFT prizes
        if (raffle.prizeType === 'NFT' && raffle.prizeContractAddress && raffle.prizeTokenId) {
          metadataPromises.push(
            fetchNFTMetadata(raffle.prizeContractAddress, raffle.prizeTokenId)
              .then(metadata => ({ prizeNFTMetadata: metadata }))
          );
        }

        // Fetch holder collection metadata for holder-only raffles
        if (raffle.isHolderOnly && raffle.holderCollection) {
          metadataPromises.push(
            fetchCollectionMetadata(raffle.holderCollection)
              .then(metadata => ({ holderCollectionMetadata: metadata }))
          );
        }

        // Wait for all metadata fetches
        const metadataResults = await Promise.all(metadataPromises);

        // Merge all metadata into raffle object
        return {
          ...raffle,
          ...metadataResults.reduce((acc, curr) => ({ ...acc, ...curr }), {})
        };
      })
    );

    res.json({
      success: true,
      data: {
        raffles: rafflesWithMetadata
      }
    });
  } catch (error) {
    console.error('Get ended raffles error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get platform statistics
exports.getPlatformStats = async (req, res) => {
  try {
    const [
      totalRaffles,
      activeRaffles,
      endedRaffles,
      totalUsers,
      totalTickets,
      totalRevenue
    ] = await Promise.all([
      Raffle.countDocuments({ isDeleted: false }),
      Raffle.countDocuments({ status: 'ACTIVE', isDeleted: false }),
      Raffle.countDocuments({ 
        status: { $in: ['ENDED', 'DRAWN', 'CLAIMED'] }, 
        isDeleted: false 
      }),
      User.countDocuments({ isActive: true }),
      Ticket.aggregate([
        { $match: { isValid: true } },
        { $group: { _id: null, total: { $sum: '$ticketCount' } } }
      ]),
      Ticket.aggregate([
        { $match: { isValid: true } },
        { $group: { _id: null, total: { $sum: { $toDouble: '$totalCost' } } } }
      ])
    ]);

    res.json({
      success: true,
      activeRaffles: activeRaffles,
      totalUsers: totalUsers,
      totalPrizes: totalTickets[0]?.total || 0,
      data: {
        raffles: {
          total: totalRaffles,
          active: activeRaffles,
          ended: endedRaffles
        },
        users: {
          total: totalUsers
        },
        tickets: {
          total: totalTickets[0]?.total || 0
        },
        revenue: {
          total: totalRevenue[0]?.total?.toString() || '0'
        }
      }
    });
  } catch (error) {
    console.error('Get platform stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get raffle participants
exports.getRaffleParticipants = async (req, res) => {
  try {
    const { id: raffleId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    // Find the raffle first
    const raffle = await Raffle.findOne({ raffleId, isDeleted: false });
    
    if (!raffle) {
      return res.status(404).json({
        success: false,
        message: 'Raffle not found'
      });
    }
    
    // Check if participants are visible
    if (!raffle.participantsVisible) {
      return res.status(403).json({
        success: false,
        message: 'Participants list is not visible for this raffle'
      });
    }
    
    // Get total ticket count for calculating win chances
    const totalTicketStats = await Ticket.getTotalTicketsForRaffle(raffleId);
    const totalTickets = totalTicketStats.totalTickets;
    
    // Get participants with their ticket counts
    const participants = await Ticket.aggregate([
      { $match: { raffleId, isValid: true } },
      { 
        $group: {
          _id: '$owner',
          totalTickets: { $sum: '$ticketCount' },
          totalSpent: { $sum: '$totalCostFormatted' },
          purchaseCount: { $sum: 1 },
          firstPurchase: { $min: '$purchasedAt' },
          lastPurchase: { $max: '$purchasedAt' },
          isWinning: { $max: '$isWinning' }
        }
      },
      { $sort: { totalTickets: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) },
      {
        $addFields: {
          address: '$_id',
          winChance: totalTickets > 0 ? { $multiply: [{ $divide: ['$totalTickets', totalTickets] }, 100] } : 0,
          winChanceFormatted: totalTickets > 0 ? {
            $concat: [
              { $toString: { $round: [{ $multiply: [{ $divide: ['$totalTickets', totalTickets] }, 100] }, 2] } },
              '%'
            ]
          } : '0%'
        }
      },
      {
        $project: {
          _id: 0,
          address: 1,
          totalTickets: 1,
          totalSpent: 1,
          purchaseCount: 1,
          firstPurchase: 1,
          lastPurchase: 1,
          isWinning: 1,
          winChance: 1,
          winChanceFormatted: 1
        }
      }
    ]);
    
    // Get total participant count
    const totalParticipants = await Ticket.aggregate([
      { $match: { raffleId, isValid: true } },
      { $group: { _id: '$owner' } },
      { $count: 'total' }
    ]);
    
    const total = totalParticipants[0]?.total || 0;
    
    res.json({
      success: true,
      data: {
        participants,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        stats: {
          totalParticipants: total,
          totalTickets: totalTickets,
          averageTicketsPerParticipant: total > 0 ? (totalTickets / total).toFixed(2) : 0
        }
      }
    });
  } catch (error) {
    console.error('Get raffle participants error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Helper functions for other controllers that might need these
exports.createRaffle = async (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Raffle creation is handled by smart contracts'
  });
};

exports.updateRaffle = async (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Raffle updates are handled by smart contracts'
  });
};

exports.deleteRaffle = async (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Raffle deletion is handled by smart contracts'
  });
};

exports.getUserRaffles = async (req, res) => {
  try {
    const { address } = req.params;

    if (!ethers.isAddress(address.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user address'
      });
    }

    const raffles = await Raffle.find({
      owner: address.toLowerCase(),
      isDeleted: false
    })
    .sort({ createdAt: -1 })
    .lean();

    const enrichedRaffles = await Promise.all(
      raffles.map(async (raffle) => {
        const ticketStats = await Ticket.getTotalTicketsForRaffle(raffle.raffleId);

        // Get simple participants list
        let participants = [];
        if (raffle.participantsVisible) {
          const participantData = await Ticket.aggregate([
            { $match: { raffleId: raffle.raffleId, isValid: true } },
            { $group: { _id: '$owner', tickets: { $sum: '$ticketCount' } } },
            { $project: { address: '$_id', tickets: 1, _id: 0 } },
            { $sort: { tickets: -1 } }
          ]);
          participants = participantData;
        }

        // Fetch NFT metadata and holder collection metadata in parallel
        const metadataPromises = [];

        if (raffle.prizeType === 'NFT' && raffle.prizeContractAddress && raffle.prizeTokenId) {
          metadataPromises.push(
            fetchNFTMetadata(raffle.prizeContractAddress, raffle.prizeTokenId)
              .then(metadata => ({ prizeNFTMetadata: metadata }))
          );
        }

        if (raffle.isHolderOnly && raffle.holderCollection) {
          metadataPromises.push(
            fetchCollectionMetadata(raffle.holderCollection)
              .then(metadata => ({ holderCollectionMetadata: metadata }))
          );
        }

        const metadataResults = await Promise.all(metadataPromises);
        const allMetadata = metadataResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});

        // Determine actual status
        const actualStatus = (raffle.status === 'DRAWN' && raffle.prizeClaimTransactionHash)
          ? 'CLAIMED'
          : raffle.status;

        // Set timeRemaining to 0 for CLAIMED raffles
        const timeRemaining = actualStatus === 'CLAIMED'
          ? 0
          : Math.max(0, new Date(raffle.endTime) - new Date());

        return {
          ...raffle,
          status: actualStatus,  // Override status if prize is claimed
          totalTicketsSold: ticketStats.totalTickets,
          totalParticipants: ticketStats.totalParticipants,
          participants: raffle.participantsVisible ? participants : null,
          timeRemaining,
          isEnded: actualStatus === 'CLAIMED' ? true : new Date() > new Date(raffle.endTime),
          ...allMetadata
        };
      })
    );

    res.json({
      success: true,
      data: enrichedRaffles
    });
  } catch (error) {
    console.error('Get user raffles error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get NFT tickets remaining for holder-only raffle
exports.getNFTTicketsRemaining = async (req, res) => {
  try {
    const { id: raffleId } = req.params;
    const { nftIds } = req.query;

    if (!nftIds) {
      return res.status(400).json({
        success: false,
        message: 'NFT IDs are required (comma-separated)'
      });
    }

    // Find raffle
    const raffle = await Raffle.findOne({ raffleId, isDeleted: false }).lean();

    if (!raffle) {
      return res.status(404).json({
        success: false,
        message: 'Raffle not found'
      });
    }

    // Check if raffle is holder-only
    if (!raffle.isHolderOnly) {
      return res.status(400).json({
        success: false,
        message: 'This is not a holder-only raffle'
      });
    }

    // Parse NFT IDs
    const nftIdArray = nftIds.split(',').map(id => parseInt(id.trim()));

    // Get raffle contract
    const { getNetworkConfig } = require('../config/config');
    const networkConfig = getNetworkConfig();
    const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);

    const raffleABI = [
      'function nftTicketsUsed(uint256) view returns (uint256)',
      'function ticketsPerNFT() view returns (uint256)'
    ];

    const raffleContract = new ethers.Contract(raffle.contractAddress, raffleABI, provider);

    // Get remaining tickets for each NFT
    const results = await Promise.all(
      nftIdArray.map(async (nftId) => {
        try {
          const used = await raffleContract.nftTicketsUsed(nftId);
          const ticketsPerNFT = raffle.ticketsPerNFT;
          const remaining = Math.max(0, ticketsPerNFT - Number(used));

          return {
            nftId,
            used: Number(used),
            remaining,
            total: ticketsPerNFT
          };
        } catch (error) {
          console.error(`Error getting tickets for NFT #${nftId}:`, error.message);
          return {
            nftId,
            used: 0,
            remaining: raffle.ticketsPerNFT,
            total: raffle.ticketsPerNFT,
            error: error.message
          };
        }
      })
    );

    res.json({
      success: true,
      data: {
        raffleId,
        ticketsPerNFT: raffle.ticketsPerNFT,
        holderCollection: raffle.holderCollection,
        nfts: results
      }
    });
  } catch (error) {
    console.error('Get NFT tickets remaining error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user's NFT usage in a raffle (DIRECT RPC CALL - no database)
exports.getUserNFTUsage = async (req, res) => {
  try {
    const { id: raffleId } = req.params;
    const { userAddress, nftIds } = req.query;

    if (!userAddress || !ethers.isAddress(userAddress.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Valid user address is required'
      });
    }

    if (!nftIds) {
      return res.status(400).json({
        success: false,
        message: 'NFT IDs are required (comma-separated)'
      });
    }

    // Find raffle
    const raffle = await Raffle.findOne({ raffleId, isDeleted: false }).lean();

    if (!raffle) {
      return res.status(404).json({
        success: false,
        message: 'Raffle not found'
      });
    }

    // Check if raffle is holder-only
    if (!raffle.isHolderOnly) {
      return res.status(400).json({
        success: false,
        message: 'This is not a holder-only raffle'
      });
    }

    // Parse NFT IDs
    const nftIdArray = nftIds.split(',').map(id => parseInt(id.trim()));

    // Get raffle contract
    const { getNetworkConfig } = require('../config/config');
    const networkConfig = getNetworkConfig();
    const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);

    const raffleABI = [
      'function nftTicketsUsed(uint256) view returns (uint256)',
      'function ticketsPerNFT() view returns (uint256)',
      'function tickets(address) view returns (uint256)'
    ];

    const raffleContract = new ethers.Contract(raffle.contractAddress, raffleABI, provider);

    // Get user's total tickets
    const userTotalTickets = await raffleContract.tickets(userAddress);

    // Get usage for each NFT (DIRECT RPC CALL)
    const nftsUsed = await Promise.all(
      nftIdArray.map(async (nftId) => {
        try {
          const used = await raffleContract.nftTicketsUsed(nftId);
          const ticketsPerNFT = raffle.ticketsPerNFT;
          const remaining = Math.max(0, ticketsPerNFT - Number(used));

          return {
            nftId,
            used: Number(used),
            remaining,
            total: ticketsPerNFT
          };
        } catch (error) {
          console.error(`Error getting usage for NFT #${nftId}:`, error.message);
          return {
            nftId,
            used: 0,
            remaining: raffle.ticketsPerNFT,
            total: raffle.ticketsPerNFT,
            error: error.message
          };
        }
      })
    );

    // Filter only used NFTs
    const usedNFTs = nftsUsed.filter(nft => nft.used > 0);

    res.json({
      success: true,
      data: {
        raffleId,
        userAddress: userAddress.toLowerCase(),
        totalTickets: Number(userTotalTickets),
        ticketsPerNFT: raffle.ticketsPerNFT,
        nftsUsed: usedNFTs
      }
    });
  } catch (error) {
    console.error('Get user NFT usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get recent updates/activities
exports.getRecentUpdates = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // Get recent raffles
    const recentRaffles = await Raffle.find({
      isDeleted: false
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit) / 2)
    .lean();

    // Get recent ticket purchases
    const recentTickets = await Ticket.find({
      isValid: true
    })
    .sort({ purchasedAt: -1 })
    .limit(parseInt(limit) / 2)
    .lean();

    // Get recent winners
    const recentWinners = await Raffle.find({
      winner: { $ne: null },
      winnerDrawnAt: { $ne: null }
    })
    .sort({ winnerDrawnAt: -1 })
    .limit(parseInt(limit) / 2)
    .lean();

    const activities = [];

    // Add raffle creations
    recentRaffles.forEach(raffle => {
      activities.push({
        type: 'raffle_created',
        timestamp: raffle.createdAt,
        data: {
          raffleId: raffle.raffleId,
          owner: raffle.owner,
          prizeType: raffle.prizeType,
          prizeMetadata: raffle.prizeMetadata
        }
      });
    });

    // Add ticket purchases
    recentTickets.forEach(ticket => {
      activities.push({
        type: 'ticket_purchased',
        timestamp: ticket.purchasedAt,
        data: {
          raffleId: ticket.raffleId,
          buyer: ticket.owner,
          ticketCount: ticket.ticketCount
        }
      });
    });

    // Add winners
    recentWinners.forEach(raffle => {
      activities.push({
        type: 'winner_drawn',
        timestamp: raffle.winnerDrawnAt,
        data: {
          raffleId: raffle.raffleId,
          winner: raffle.winner,
          prizeType: raffle.prizeType,
          prizeMetadata: raffle.prizeMetadata
        }
      });
    });

    // Sort by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limitedActivities = activities.slice(0, parseInt(limit));

    res.json({
      success: true,
      data: limitedActivities
    });
  } catch (error) {
    console.error('Get recent updates error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};