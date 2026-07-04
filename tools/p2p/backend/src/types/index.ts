import { z } from 'zod';

// Blockchain enums
export enum AssetType {
  NATIVE = 0,   // ETH/MON
  ERC20 = 1,    // Fungible tokens
  ERC721 = 2,   // NFTs
  ERC1155 = 3   // Semi-fungible tokens
}

export enum OfferType {
  SINGLE = 0,   // NFT#123 → 50 MON
  MULTI = 1,    // NFT#123 + 20 MON → NFT#456
  COLLECTION = 2, // Any Monaliens → 40 MON
  OPEN = 3,     // Open offer → Anyone can propose (requires approval)
}

export enum OfferStatus {
  CREATED = 0,   // Initialized but no assets deposited
  ACTIVE = 1,    // Assets deposited, waiting for acceptance
  ACCEPTED = 2,  // Deal completed
  CANCELLED = 3, // Cancelled by creator
  EXPIRED = 4,   // Timeout reached
}

// Asset Schema & Type
export const AssetSchema = z.object({
  assetType: z.nativeEnum(AssetType),
  contractAddress: z.string(),
  tokenIdOrAmount: z.string(),
  amount: z.string().optional(),
  isSpecific: z.boolean().default(true), // true: belirli token ID, false: koleksiyondan herhangi biri
});

export type Asset = z.infer<typeof AssetSchema> & {
  metadata?: {
    name: string;
    image: string;
    collectionName: string;
  };
};

// Create Offer Schema & Type
export const CreateOfferSchema = z.object({
  offerType: z.nativeEnum(OfferType),
  targetUser: z.string().optional(),
  collectionAddress: z.string().optional(),
  duration: z.number().min(60).max(7 * 24 * 60 * 60), // 1 minute to 1 week
  targetOfferId: z.number().default(0), // 0 = general offer, X = targeting offer X
  title: z.string().max(20).default(""), // Max 20 characters
  description: z.string().max(100).default(""), // Max 100 characters
  offeredAssets: z.array(AssetSchema).min(1),
  requestedAssets: z.array(AssetSchema).optional(), // Optional for open offers
});

export type CreateOfferRequest = z.infer<typeof CreateOfferSchema>;

// Database types
export interface OfferDocument {
  _id: string;
  offerId: number;
  contractAddress: string;
  maker: string;
  offerType: OfferType;
  targetUser?: string;
  collectionAddress?: string;
  deadline: Date;
  targetOfferId: number; // 0 = general offer, X = targeting offer X
  title: string; // Max 20 characters
  description: string; // Max 100 characters
  status: OfferStatus;
  offeredAssets: Asset[];
  requestedAssets: Asset[];
  assetsInEscrow: boolean;
  counterOffers: number[];
  parentOfferId?: number;
  createdAt: Date;
  updatedAt: Date;
  txHash?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// WebSocket events
export interface WebSocketEvents {
  offerCreated: {
    offerId: number;
    contractAddress: string;
    maker: string;
    offerType: OfferType;
    targetOfferId: number;
    title: string;
    description: string;
    assetsInEscrow?: boolean;
    status?: OfferStatus;
  };
  
  offerActivated: {
    offerId: number;
    contractAddress: string;
    assetsDeposited: boolean;
  };
  
  offerAccepted: {
    offerId: number;
    contractAddress: string;
    acceptor: string;
  };
  
  offerCancelled: {
    offerId: number;
    contractAddress: string;
    reason: string;
  };
  
  offerExpired: {
    offerId: number;
    contractAddress: string;
  };

  proposalSubmitted: {
    offerId: number;
    proposalId: number;
    proposer: string;
    assetCount: number;
    contractAddress: string;
  };

  proposalApproved: {
    offerId: number;
    proposalId: number;
    proposer: string;
    maker: string;
    contractAddress: string;
  };
  
  settlementExecuted: {
    offerId: number;
    contractAddress: string;
    counterContractAddress?: string;
    reason?: string;
  };
  
  error: {
    message: string;
    code?: string;
  };
}

// Error types
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: any) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}
