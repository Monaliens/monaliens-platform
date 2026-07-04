const User = require('../models/User');
const Raffle = require('../models/Raffle');
const Ticket = require('../models/Ticket');
const { ethers } = require('ethers');
const Joi = require('joi');

// Validation schemas
const addressSchema = Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required();
const updateProfileSchema = Joi.object({
  username: Joi.string().max(50).allow('', null),
  email: Joi.string().email().allow('', null),
  bio: Joi.string().max(500).allow('', null),
  avatar: Joi.string().uri().allow('', null),
  notifications: Joi.object({
    email: Joi.boolean(),
    browser: Joi.boolean(),
    raffleUpdates: Joi.boolean(),
    winnerAnnouncements: Joi.boolean()
  }),
  preferredNetwork: Joi.string()
});

// Get user profile
exports.getUserProfile = async (req, res) => {
  try {
    const { error } = addressSchema.validate(req.params.address);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address'
      });
    }

    const address = req.params.address.toLowerCase();
    let user = await User.findByAddress(address);

    if (!user) {
      // Create new user if doesn't exist
      user = await User.create({ address });
    }

    // Update last active
    user.lastActive = new Date();
    await user.save();

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
  try {
    const { error: addressError } = addressSchema.validate(req.params.address);
    const { error: bodyError, value } = updateProfileSchema.validate(req.body);
    
    if (addressError || bodyError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        error: (addressError || bodyError).details[0].message
      });
    }

    const address = req.params.address.toLowerCase();
    const user = await User.createOrUpdate(address, value);

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user's raffles (created by user)
exports.getUserRaffles = async (req, res) => {
  try {
    const { error } = addressSchema.validate(req.params.address);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address'
      });
    }

    const address = req.params.address.toLowerCase();
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const filter = { owner: address, isDeleted: false };
    if (status) filter.status = status;

    const raffles = await Raffle.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Enrich with stats
    const enrichedRaffles = await Promise.all(
      raffles.map(async (raffle) => {
        const ticketStats = await Ticket.getTotalTicketsForRaffle(raffle.raffleId);
        return {
          ...raffle,
          totalTicketsSold: ticketStats.totalTickets,
          totalParticipants: ticketStats.totalParticipants,
          timeRemaining: Math.max(0, new Date(raffle.endTime) - new Date()),
          isEnded: new Date() > new Date(raffle.endTime)
        };
      })
    );

    const total = await Raffle.countDocuments(filter);

    res.json({
      success: true,
      data: {
        raffles: enrichedRaffles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get user raffles error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user's tickets (participated raffles)
exports.getUserTickets = async (req, res) => {
  try {
    const { error } = addressSchema.validate(req.params.address);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address'
      });
    }

    const address = req.params.address.toLowerCase();
    const { raffleId, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const filter = { owner: address, isValid: true };
    if (raffleId) filter.raffleId = raffleId;

    const tickets = await Ticket.find(filter)
      .sort({ purchasedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get raffle info for each ticket
    const enrichedTickets = await Promise.all(
      tickets.map(async (ticket) => {
        const raffle = await Raffle.findOne({ raffleId: ticket.raffleId }).lean();
        return {
          ...ticket,
          raffle: raffle ? {
            raffleId: raffle.raffleId,
            prizeType: raffle.prizeType,
            prizeMetadata: raffle.prizeMetadata,
            status: raffle.status,
            endTime: raffle.endTime,
            winner: raffle.winner
          } : null
        };
      })
    );

    const total = await Ticket.countDocuments(filter);

    res.json({
      success: true,
      data: {
        tickets: enrichedTickets,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get user tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user's wins
exports.getUserWins = async (req, res) => {
  try {
    const { error } = addressSchema.validate(req.params.address);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address'
      });
    }

    const address = req.params.address.toLowerCase();

    // Get raffles where user is the winner
    const wonRaffles = await Raffle.find({
      winner: address,
      status: { $in: ['DRAWN', 'CLAIMED'] },
      isDeleted: false
    })
    .sort({ winnerDrawnAt: -1 })
    .lean();

    // Get winning tickets
    const winningTickets = await Ticket.find({
      owner: address,
      isWinning: true,
      isValid: true
    })
    .sort({ purchasedAt: -1 })
    .lean();

    // Calculate total prize value
    let totalPrizeValue = 0;
    for (const raffle of wonRaffles) {
      if (raffle.prizeType === 'TOKEN') {
        totalPrizeValue += parseFloat(raffle.prizeAmount || 0);
      }
      // For NFTs, you might want to fetch current market value
    }

    res.json({
      success: true,
      data: {
        wonRaffles,
        winningTickets,
        summary: {
          totalWins: wonRaffles.length,
          totalPrizeValue: totalPrizeValue.toString(),
          recentWins: wonRaffles.slice(0, 5)
        }
      }
    });
  } catch (error) {
    console.error('Get user wins error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user statistics
exports.getUserStats = async (req, res) => {
  try {
    const { error } = addressSchema.validate(req.params.address);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address'
      });
    }

    const address = req.params.address.toLowerCase();

    const [user, ticketStats, raffleStats, winStats] = await Promise.all([
      User.findByAddress(address),
      Ticket.getUserStats(address),
      Raffle.aggregate([
        { $match: { owner: address, isDeleted: false } },
        { $group: {
            _id: null,
            totalCreated: { $sum: 1 },
            activeRaffles: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } },
            endedRaffles: { $sum: { $cond: [{ $ne: ['$status', 'ACTIVE'] }, 1, 0] } }
          }
        }
      ]),
      Raffle.countDocuments({ winner: address, status: { $in: ['DRAWN', 'CLAIMED'] } })
    ]);

    const ticketData = ticketStats[0] || {
      totalTickets: 0,
      totalSpent: '0',
      totalRaffles: 0,
      wins: 0,
      winRate: 0
    };

    const raffleData = raffleStats[0] || {
      totalCreated: 0,
      activeRaffles: 0,
      endedRaffles: 0
    };

    const stats = {
      profile: user || { address },
      participation: {
        totalRafflesParticipated: ticketData.totalRaffles,
        totalTicketsPurchased: ticketData.totalTickets,
        totalAmountSpent: ticketData.totalSpent,
        averageTicketsPerRaffle: ticketData.totalRaffles > 0 
          ? (ticketData.totalTickets / ticketData.totalRaffles).toFixed(2)
          : '0'
      },
      creation: {
        totalRafflesCreated: raffleData.totalCreated,
        activeRaffles: raffleData.activeRaffles,
        endedRaffles: raffleData.endedRaffles
      },
      wins: {
        totalWins: winStats,
        winRate: ticketData.winRate,
        totalPrizesWon: user?.stats?.totalPrizesWon || '0'
      },
      staking: user?.staking || {
        totalStaked: '0',
        totalRewardsEarned: '0',
        activeStakes: 0
      },
      referral: user?.referral || {
        totalReferrals: 0,
        totalCommissionsEarned: '0',
        currentTier: 'Bronze'
      }
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user's participated raffles (NEW)
exports.getUserParticipatedRaffles = async (req, res) => {
  try {
    const { error } = addressSchema.validate(req.params.address);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address'
      });
    }

    const address = req.params.address.toLowerCase();
    
    // Get all tickets purchased by this user
    const userTickets = await Ticket.find({ 
      owner: address, 
      isValid: true 
    }).lean();
    
    if (userTickets.length === 0) {
      return res.json({
        success: true,
        data: {
          participatedRaffles: [],
          statistics: {
            totalRafflesEntered: 0,
            totalTicketsPurchased: 0,
            totalSpent: '0',
            rafflesWon: 0
          }
        }
      });
    }
    
    // Get unique raffle IDs
    const raffleIds = [...new Set(userTickets.map(t => t.raffleId))];
    
    // Get raffle details
    const raffles = await Raffle.find({
      raffleId: { $in: raffleIds },
      isDeleted: false
    }).lean();
    
    // Create raffle map for quick lookup
    const raffleMap = {};
    raffles.forEach(r => {
      raffleMap[r.raffleId] = r;
    });
    
    // Group tickets by raffle
    const ticketsByRaffle = {};
    let totalSpent = 0;
    let totalTicketsPurchased = 0;
    
    userTickets.forEach(ticket => {
      if (!ticketsByRaffle[ticket.raffleId]) {
        ticketsByRaffle[ticket.raffleId] = {
          tickets: [],
          totalTickets: 0,
          totalSpent: 0
        };
      }
      ticketsByRaffle[ticket.raffleId].tickets.push({
        ticketCount: ticket.ticketCount,
        purchasedAt: ticket.purchasedAt,
        txHash: ticket.transactionHash
      });
      ticketsByRaffle[ticket.raffleId].totalTickets += ticket.ticketCount;
      ticketsByRaffle[ticket.raffleId].totalSpent += parseFloat(ticket.totalCost || 0);
      
      totalSpent += parseFloat(ticket.totalCost || 0);
      totalTicketsPurchased += ticket.ticketCount;
    });
    
    // Get total tickets for each raffle (for win chance calculation)
    const ticketTotals = await Ticket.aggregate([
      { $match: { raffleId: { $in: raffleIds }, isValid: true } },
      { $group: { 
        _id: '$raffleId',
        totalTickets: { $sum: '$ticketCount' },
        participantCount: { $addToSet: '$owner' }
      }},
      { $project: {
        raffleId: '$_id',
        totalTickets: 1,
        participantCount: { $size: '$participantCount' },
        _id: 0
      }}
    ]);
    
    const ticketTotalMap = {};
    ticketTotals.forEach(t => {
      ticketTotalMap[t.raffleId] = t;
    });
    
    // Build participated raffles array
    const participatedRaffles = raffleIds
      .filter(raffleId => raffleMap[raffleId]) // Only include existing raffles
      .map(raffleId => {
        const raffle = raffleMap[raffleId];
        const userTicketData = ticketsByRaffle[raffleId];
        const totalData = ticketTotalMap[raffleId] || { totalTickets: 0, participantCount: 0 };
        
        // Calculate win chance
        const winChance = totalData.totalTickets > 0 
          ? (userTicketData.totalTickets / totalData.totalTickets) * 100 
          : 0;
        
        // Calculate user's rank (simplified - would need full participant list for accurate rank)
        const rank = userTicketData.totalTickets > 0 ? 1 : null; // Placeholder
        
        return {
          raffleId,
          raffleDetails: {
            contractAddress: raffle.contractAddress,
            owner: raffle.owner,
            prizeType: raffle.prizeType,
            prizeMetadata: raffle.prizeMetadata,
            ticketPrice: raffle.ticketPrice,
            startTime: raffle.startTime,
            endTime: raffle.endTime,
            status: raffle.status,
            winner: raffle.winner,
            totalParticipants: totalData.participantCount,
            totalTicketsSold: totalData.totalTickets
          },
          userTickets: {
            totalTickets: userTicketData.totalTickets,
            totalSpent: userTicketData.totalSpent.toString(),
            purchases: userTicketData.tickets.sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt)),
            winChance,
            winChanceFormatted: `${winChance.toFixed(2)}%`
          },
          isWinner: raffle.winner?.toLowerCase() === address
        };
      })
      .sort((a, b) => new Date(b.raffleDetails.endTime) - new Date(a.raffleDetails.endTime));
    
    // Count raffles won
    const rafflesWon = participatedRaffles.filter(r => r.isWinner).length;
    
    res.json({
      success: true,
      data: {
        participatedRaffles,
        statistics: {
          totalRafflesEntered: participatedRaffles.length,
          totalTicketsPurchased,
          totalSpent: totalSpent.toString(),
          rafflesWon,
          winRate: participatedRaffles.length > 0 
            ? ((rafflesWon / participatedRaffles.length) * 100).toFixed(2) + '%'
            : '0%'
        }
      }
    });
  } catch (error) {
    console.error('Get user participated raffles error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get top users leaderboard
exports.getTopUsers = async (req, res) => {
  try {
    const { type = 'prizes', limit = 10 } = req.query;

    let sortField;
    switch (type) {
      case 'prizes':
        sortField = { 'stats.totalPrizesWon': -1 };
        break;
      case 'tickets':
        sortField = { 'stats.totalTicketsPurchased': -1 };
        break;
      case 'raffles':
        sortField = { 'stats.totalRafflesCreated': -1 };
        break;
      case 'referrals':
        sortField = { 'referral.totalReferrals': -1 };
        break;
      default:
        sortField = { 'stats.totalPrizesWon': -1 };
    }

    const topUsers = await User.find({ isActive: true })
      .sort(sortField)
      .limit(parseInt(limit))
      .select('address username stats referral')
      .lean();

    const enrichedUsers = topUsers.map((user, index) => ({
      rank: index + 1,
      address: user.address,
      displayName: user.username || `${user.address.slice(0, 6)}...${user.address.slice(-4)}`,
      stats: user.stats,
      referral: user.referral
    }));

    res.json({
      success: true,
      data: {
        type,
        users: enrichedUsers
      }
    });
  } catch (error) {
    console.error('Get top users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};