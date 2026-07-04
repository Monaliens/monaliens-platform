import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import connectDB from '@/lib/mongodb';
import Flip from '@/models/Flip';

// Cache configuration - 1 minute for flip (serverless can't share state with listener)
const CACHE_TTL = 1 * 60 * 1000; // 1 minute in milliseconds

interface CacheEntry {
  data: any;
  timestamp: number;
}

interface LeaderboardStats {
  points: string;
  pnl: string;
}

interface DiscordUser {
  wallet: string;
  discordId: string;
  username: string;
  globalName: string;
  avatarUrl: string;
}

interface LeaderboardEntry {
  rank: number;
  player: string;
  discord: DiscordUser | null;
  stats: LeaderboardStats;
}

// In-memory cache
const cache: Map<string, CacheEntry> = new Map();

// Discord API URL
const DISCORD_API_URL = process.env.DISCORD_API_URL || 'http://host.docker.internal:11111/api';

// Get cache key
function getCacheKey(period: string, sortBy: string, limit: number): string {
  return `leaderboard:${period}:${sortBy}:${limit}`;
}

// Check if cache is valid
function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL;
}

// Fetch Discord user info by wallets
async function fetchDiscordUsers(wallets: string[]): Promise<Map<string, DiscordUser>> {
  const userMap = new Map<string, DiscordUser>();

  if (wallets.length === 0) return userMap;

  try {
    const response = await fetch(`${DISCORD_API_URL}/users-by-wallets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ wallets }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.users && Array.isArray(data.users)) {
        for (const user of data.users) {
          userMap.set(user.wallet.toLowerCase(), user);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching Discord users:', error);
    // Continue without Discord data
  }

  return userMap;
}

// Get date filter based on period
function getDateFilter(period: string): Date | null {
  const now = new Date();

  switch (period) {
    case 'daily':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'monthly':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'all':
    default:
      return null;
  }
}

// Get sort field for MongoDB
function getSortField(sortBy: string): Record<string, 1 | -1> {
  switch (sortBy) {
    case 'pnl':
      return { pnlRaw: -1, totalGames: -1 };
    case 'points':
    default:
      return { totalVolumeRaw: -1, totalGames: -1 };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'all';
    const sortBy = searchParams.get('sortBy') || 'points';
    const limitParam = searchParams.get('limit');
    const limit = Math.min(Math.max(parseInt(limitParam || '10', 10) || 10, 1), 100);

    // Validate parameters
    const validPeriods = ['daily', 'weekly', 'monthly', 'all'];
    const validSortBy = ['points', 'pnl'];

    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        { success: false, error: 'Invalid period. Use: daily, weekly, monthly, all' },
        { status: 400 }
      );
    }

    if (!validSortBy.includes(sortBy)) {
      return NextResponse.json(
        { success: false, error: 'Invalid sortBy. Use: points, pnl' },
        { status: 400 }
      );
    }

    // Check cache
    const cacheKey = getCacheKey(period, sortBy, limit);
    const cachedEntry = cache.get(cacheKey);

    if (cachedEntry && isCacheValid(cachedEntry)) {
      console.log(`[Leaderboard] Cache hit for ${cacheKey}`);
      return NextResponse.json({
        ...cachedEntry.data,
        cached: true,
        cacheAge: Math.floor((Date.now() - cachedEntry.timestamp) / 1000),
      });
    }

    console.log(`[Leaderboard] Cache miss for ${cacheKey}, computing...`);

    // Connect to MongoDB
    await connectDB();

    // Build match stage
    const matchStage: any = {
      completed: true, // Only completed games
    };

    const dateFilter = getDateFilter(period);
    if (dateFilter) {
      matchStage.timestamp = { $gte: dateFilter };
    }

    // Aggregation pipeline
    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$player',
          totalGames: { $sum: 1 },
          wins: {
            $sum: { $cond: [{ $eq: ['$winner', true] }, 1, 0] },
          },
          losses: {
            $sum: { $cond: [{ $eq: ['$winner', false] }, 1, 0] },
          },
          // Sum of all amounts (as strings, need to convert)
          totalVolumeRaw: {
            $sum: {
              $convert: {
                input: '$amount',
                to: 'double',
                onError: 0,
                onNull: 0,
              },
            },
          },
          // PnL: win = +amount, loss = -amount
          pnlRaw: {
            $sum: {
              $cond: [
                { $eq: ['$winner', true] },
                {
                  $convert: {
                    input: '$amount',
                    to: 'double',
                    onError: 0,
                    onNull: 0,
                  },
                },
                {
                  $multiply: [
                    -1,
                    {
                      $convert: {
                        input: '$amount',
                        to: 'double',
                        onError: 0,
                        onNull: 0,
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      { $sort: getSortField(sortBy) },
      { $limit: limit },
    ];

    const results = await Flip.aggregate(pipeline);

    // Get all wallet addresses
    const wallets = results.map((r: any) => r._id);

    // Fetch Discord users
    const discordUsers = await fetchDiscordUsers(wallets);

    // Format leaderboard
    const leaderboard: LeaderboardEntry[] = results.map((r: any, index: number) => {
      const player = r._id.toLowerCase();
      const discordUser = discordUsers.get(player) || null;

      // Format points and PnL from wei to ether
      const pointsEther = ethers.formatEther(BigInt(Math.floor(r.totalVolumeRaw)));
      const pnlEther = ethers.formatEther(BigInt(Math.floor(Math.abs(r.pnlRaw))));
      const pnlFormatted = r.pnlRaw >= 0 ? `+${pnlEther}` : `-${pnlEther}`;

      return {
        rank: index + 1,
        player,
        discord: discordUser,
        stats: {
          points: pointsEther,
          pnl: pnlFormatted,
        },
      };
    });

    // Prepare response
    const responseData = {
      success: true,
      period,
      sortBy,
      limit,
      count: leaderboard.length,
      leaderboard,
      generatedAt: new Date().toISOString(),
    };

    // Store in cache
    cache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now(),
    });

    console.log(`[Leaderboard] Cached ${cacheKey} with ${leaderboard.length} entries`);

    return NextResponse.json({
      ...responseData,
      cached: false,
    });
  } catch (error: any) {
    console.error('Error generating leaderboard:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate leaderboard',
      },
      { status: 500 }
    );
  }
}
