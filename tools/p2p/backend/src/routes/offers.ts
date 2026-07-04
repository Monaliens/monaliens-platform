import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler';
import { 
  offersCacheMiddleware, 
  statsCacheMiddleware, 
  userCacheMiddleware, 
  collectionCacheMiddleware,
  CACHE_TTL 
} from '../middleware/cacheMiddleware';
import { Offer } from '../models/Offer';
import { ValidationError, NotFoundError } from '../types';
import { AssetType, OfferType, OfferStatus } from '../types';
import { CreateOfferSchema } from '../types';
import { enrichAssetsWithMetadata } from '../services/nftMetadata';
import { enrichOfferWithEnums } from '../utils/enumHelpers';

const router = Router();

// Validation schemas
const AssetSchema = z.object({
  assetType: z.nativeEnum(AssetType),
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address'),
  tokenIdOrAmount: z.string().regex(/^\d+$/, 'Must be a valid number string'),
  amount: z.string().regex(/^\d+$/, 'Must be a valid number string').optional().default('0'),
});

const GetOffersQuerySchema = z.object({
  collection: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  tokenId: z.string().regex(/^\d+$/).optional(),
  maker: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  isActive: z.string().transform(val => val === 'true').optional(),
  page: z.string().transform(val => parseInt(val)).default('1'),
  limit: z.string().transform(val => Math.min(parseInt(val), 100)).default('20'),
  sortBy: z.enum(['deadline', 'createdAt', 'offerId']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Get offers with filtering and pagination
 * GET /api/offers
 */
router.get('/', offersCacheMiddleware(CACHE_TTL.MEDIUM), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      maker,
      targetUser,
      collectionAddress,
      status,
      offerType,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter: any = {};
    if (maker) filter.maker = maker;
    if (targetUser) filter.targetUser = targetUser;
    if (collectionAddress) filter.collectionAddress = collectionAddress;
    if (status) filter.status = { $in: Array.isArray(status) ? status : [status] };
    if (offerType) filter.offerType = { $in: Array.isArray(offerType) ? offerType : [offerType] };

    // Pagination
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const [offers, total] = await Promise.all([
      Offer.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Offer.countDocuments(filter)
    ]);

    // Enrich offers with NFT metadata and enum strings
    const enrichedOffers = await Promise.all(
      offers.map(async (offer) => {
        const offerWithMetadata = {
          ...offer,
          requestedAssets: await enrichAssetsWithMetadata(offer.requestedAssets),
          offeredAssets: await enrichAssetsWithMetadata(offer.offeredAssets),
        };
        return enrichOfferWithEnums(offerWithMetadata);
      })
    );

    res.json({
      success: true,
      data: enrichedOffers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      timestamp: Date.now(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Get offers for a specific collection
 * GET /api/offers/collection/:address
 */
router.get('/collection/:address', collectionCacheMiddleware(CACHE_TTL.MEDIUM), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.params;
    
    const offers = await Offer.find({
      $or: [
        { collectionAddress: address },
        { 'offeredAssets.contractAddress': address },
        { 'requestedAssets.contractAddress': address }
      ],
      status: { $in: [0, 1] } // Only CREATED and ACTIVE offers
    })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

    // Enrich offers with NFT metadata and enum strings
    const enrichedOffers = await Promise.all(
      offers.map(async (offer) => {
        const offerWithMetadata = {
          ...offer,
          requestedAssets: await enrichAssetsWithMetadata(offer.requestedAssets),
          offeredAssets: await enrichAssetsWithMetadata(offer.offeredAssets),
        };
        return enrichOfferWithEnums(offerWithMetadata);
      })
    );

    res.json({
      success: true,
      data: enrichedOffers,
      timestamp: Date.now(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Get offers for a specific NFT
 * GET /api/offers/collection/:address/:tokenId
 */
router.get('/collection/:address/:tokenId', collectionCacheMiddleware(CACHE_TTL.MEDIUM), asyncHandler(async (req: Request, res: Response) => {
  const { address, tokenId } = req.params;
  const { isActive = 'true' } = req.query;
  
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new ValidationError('Invalid contract address format');
  }
  
  if (!/^\d+$/.test(tokenId)) {
    throw new ValidationError('Invalid token ID format');
  }

  const offers = await Offer.findByTokenId(address, tokenId, isActive === 'true');
  
  // Enrich offers with NFT metadata
  const enrichedOffers = await Promise.all(
    offers.map(async (offer) => ({
      ...offer,
      requestedAssets: await enrichAssetsWithMetadata(offer.requestedAssets),
      offeredAssets: await enrichAssetsWithMetadata(offer.offeredAssets),
    }))
  );
  
  res.json({
    success: true,
    data: {
      collection: address,
      tokenId,
      offers: enrichedOffers,
      total: offers.length,
      isActive: isActive === 'true',
    },
  });
}));

/**
 * Get offers made by a specific address
 * GET /api/offers/maker/:address
 */
router.get('/maker/:address', userCacheMiddleware(CACHE_TTL.LONG), asyncHandler(async (req: Request, res: Response) => {
  const { address } = req.params;
  const { isActive, page = '1', limit = '20' } = req.query;
  
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new ValidationError('Invalid maker address format');
  }

  const query = GetOffersQuerySchema.parse({
    maker: address,
    isActive: isActive as string,
    page: page as string,
    limit: limit as string,
  });

  const offers = await Offer.findByMaker(
    address, 
    query.isActive
  );
  
  // Apply pagination
  const total = offers.length;
  const skip = (query.page - 1) * query.limit;
  const paginatedOffers = offers.slice(skip, skip + query.limit);

  // Enrich offers with NFT metadata
  const enrichedOffers = await Promise.all(
    paginatedOffers.map(async (offer) => ({
      ...offer,
      requestedAssets: await enrichAssetsWithMetadata(offer.requestedAssets),
      offeredAssets: await enrichAssetsWithMetadata(offer.offeredAssets),
    }))
  );

  res.json({
    success: true,
    data: {
      maker: address,
      offers: enrichedOffers,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        hasNext: skip + query.limit < total,
        hasPrev: query.page > 1,
        totalPages: Math.ceil(total / query.limit),
      },
      isActive: query.isActive,
    },
  });
}));

/**
 * Get a specific offer by ID
 * GET /api/offers/:id
 */
router.get('/:id', offersCacheMiddleware(CACHE_TTL.MEDIUM), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const offer = await Offer.findOne({ offerId: parseInt(id) }).lean();
    
    if (!offer) {
      throw new NotFoundError(`Offer with ID ${id} not found`);
    }

    // Enrich offer with NFT metadata and enum strings
    const offerWithMetadata = {
      ...offer,
      requestedAssets: await enrichAssetsWithMetadata(offer.requestedAssets),
      offeredAssets: await enrichAssetsWithMetadata(offer.offeredAssets),
    };
    const enrichedOffer = enrichOfferWithEnums(offerWithMetadata);

    res.json({
      success: true,
      data: enrichedOffer,
      timestamp: Date.now(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Get offers statistics
 * GET /api/offers/stats/summary
 */
router.get('/stats/summary', statsCacheMiddleware(CACHE_TTL.VERY_LONG), asyncHandler(async (req: Request, res: Response) => {
  console.log(' Fetching offer statistics...');
  
  const [
    totalOffers,
    activeOffers,
    acceptedOffers,
  ] = await Promise.all([
    Offer.countDocuments({}),
    Offer.countDocuments({ status: { $in: [0, 1] } }), // CREATED + ACTIVE
    Offer.countDocuments({ status: 2 }), // ACCEPTED
  ]);

  // Calculate success rate (accepted / total * 100)
  const successRate = totalOffers > 0 ? (acceptedOffers / totalOffers) * 100 : 0;

  // Volume is not tracked yet, so return 0 MON
  const volume24h = "0 MON";

  console.log(' Stats:', { totalOffers, activeOffers, acceptedOffers, successRate });

  res.json({
    success: true,
    data: {
      totalOffers,
      activeOffers,
      volume24h,
      successRate: Number(successRate.toFixed(1))
      },
    timestamp: Date.now(),
  });
}));

// Frontend should interact directly with smart contracts
// Backend only provides READ-ONLY operations and event listening

/**
 * Create a new offer
 * POST /api/offers
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const offerData = CreateOfferSchema.parse(req.body);
  
  // Note: This endpoint is for tracking purposes only
  // The actual offer creation happens on-chain via smart contract
  // Frontend should call this AFTER successful on-chain creation
  
  const { 
    offerType, 
    targetUser, 
    collectionAddress, 
    duration,
    targetOfferId = 0,
    title = "",
    description = "",
    offeredAssets, 
    requestedAssets 
  } = offerData;

  // Calculate deadline
  const deadline = new Date(Date.now() + duration * 1000);

  // For tracking - frontend will provide actual contract address and offerId after blockchain deployment
  res.json({
    success: true,
    data: {
      message: 'Offer data validated. Proceed with on-chain creation.',
      validation: {
        offerType,
        targetOfferId,
        title: title.slice(0, 20), // Truncate to 20 chars
        description: description.slice(0, 100), // Truncate to 100 chars
        targetUser,
        collectionAddress,
        deadline: deadline.toISOString(),
        offeredAssets: offeredAssets.length,
        requestedAssets: requestedAssets?.length || 0,
      }
    },
    timestamp: Date.now(),
  });
}));

/**
 * Enhanced user offers endpoint - supports my-offers functionality
 * GET /api/offers/user/:address
 */
router.get('/user/:address', userCacheMiddleware(CACHE_TTL.LONG), asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;
  const { 
    type = 'made',      // 'made', 'received', 'all' 
    status = 'all',     // 'active', 'completed', 'cancelled', 'all'
    includeChildren = 'false' // Include counter-offers for made offers
  } = req.query;
  
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new ValidationError('Invalid address format');
  }

    let filter: any = {};

  // Filter by user relationship
    if (type === 'made') {
      filter.maker = address;
    } else if (type === 'received') {
      filter.targetUser = address;
    } else {
      filter.$or = [
        { maker: address },
        { targetUser: address }
      ];
    }

  // Filter by status if specified
  if (status === 'active') {
    filter.status = { $in: [0, 1] }; // CREATED, ACTIVE
  } else if (status === 'completed') {
    filter.status = 2; // ACCEPTED
  } else if (status === 'cancelled') {
    filter.status = { $in: [3, 4] }; // CANCELLED, EXPIRED
  }

    const offers = await Offer.find(filter)
      .sort({ createdAt: -1 })
      .lean();

  // Include counter-offers if requested (for my-offers functionality)
  let offersData: any = offers;
  if (includeChildren === 'true' && type === 'made') {
    offersData = await Promise.all(
      offers.map(async (offer) => {
        const children = await Offer.find({
          targetOfferId: offer.offerId
          // No status filter - show all children regardless of status
        }).lean();

        // Enrich counter-offers with metadata too
        const enrichedChildren = await Promise.all(
          children.map(async (child) => ({
            ...child,
            requestedAssets: await enrichAssetsWithMetadata(child.requestedAssets),
            offeredAssets: await enrichAssetsWithMetadata(child.offeredAssets),
          }))
        );
        
        return {
          ...offer,
          requestedAssets: await enrichAssetsWithMetadata(offer.requestedAssets),
          offeredAssets: await enrichAssetsWithMetadata(offer.offeredAssets),
          counterOffers: enrichedChildren,
          counterOffersCount: children.length
        };
      })
    );
  } else {
    // Enrich regular offers with metadata
    offersData = await Promise.all(
      offers.map(async (offer) => ({
        ...offer,
        requestedAssets: await enrichAssetsWithMetadata(offer.requestedAssets),
        offeredAssets: await enrichAssetsWithMetadata(offer.offeredAssets),
      }))
    );
  }

    res.json({
      success: true,
    data: {
      address,
      offers: offersData,
      total: offers.length,
      filters: {
        type,
        status,
        includeChildren: includeChildren === 'true'
      }
    },
      timestamp: Date.now(),
    });
}));

/**
 * Get counter-offers for a specific offer (unified system)
 * GET /api/offers/:id/children
 */
router.get('/:id/children', offersCacheMiddleware(CACHE_TTL.MEDIUM), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const offerId = parseInt(id);
  
  if (isNaN(offerId)) {
    throw new ValidationError('Invalid offer ID');
  }

  // Find all offers that target this offer (all statuses)
  const counterOffers = await Offer.find({
    targetOfferId: offerId
    // No status filter - show all target relationships regardless of status
  })
  .sort({ createdAt: -1 })
  .lean();

  // Enrich counter-offers with NFT metadata
  const enrichedCounterOffers = await Promise.all(
    counterOffers.map(async (offer) => ({
      ...offer,
      requestedAssets: await enrichAssetsWithMetadata(offer.requestedAssets),
      offeredAssets: await enrichAssetsWithMetadata(offer.offeredAssets),
    }))
  );

  res.json({
    success: true,
    data: {
      targetOfferId: offerId,
      counterOffers: enrichedCounterOffers,
      total: counterOffers.length,
    },
    timestamp: Date.now(),
  });
}));

// Enhanced user offers with counter-offers (my-offers functionality)

export default router; 