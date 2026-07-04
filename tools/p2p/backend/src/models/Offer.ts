import mongoose, { Schema, Document } from 'mongoose';
import { OfferDocument } from '../types';

// Asset subdocument schema
const AssetSchema = new Schema({
  assetType: {
    type: Number,
    required: true,
    enum: [0, 1, 2, 3], // NATIVE, ERC20, ERC721, ERC1155
  },
  contractAddress: {
    type: String,
    required: true,
  },
  tokenIdOrAmount: {
    type: String,
    required: true,
  },
  amount: {
    type: String,
    required: false,
  },
  isSpecific: {
    type: Boolean,
    required: false,
    default: false, // false: collection request, true: specific token ID
  },
}, { _id: false });

// Offer schema
const OfferSchema = new Schema({
  offerId: {
    type: Number,
    required: true,
    unique: true,
    index: true,
  },
  contractAddress: {
    type: String,
    required: true,
    index: true,
  },
  maker: {
    type: String,
    required: true,
    index: true,
  },
  offerType: {
    type: Number,
    required: true,
    enum: [0, 1, 2, 3], // SINGLE, MULTI, COLLECTION, OPEN
  },
  targetUser: {
    type: String,
    required: false,
    index: true,
  },
  collectionAddress: {
    type: String,
    required: false,
    index: true,
  },
  deadline: {
    type: Date,
    required: true,
    index: true,
  },
  targetOfferId: {
    type: Number,
    required: false,
    default: 0,
    index: true,
  },
  title: {
    type: String,
    required: false,
    maxlength: 20,
    default: "",
  },
  description: {
    type: String,
    required: false,
    maxlength: 100,
    default: "",
  },
  status: {
    type: Number,
    required: true,
    default: 0, // CREATED
    enum: [0, 1, 2, 3, 4], // CREATED, ACTIVE, ACCEPTED, CANCELLED, EXPIRED
    index: true,
  },
  offeredAssets: {
    type: [AssetSchema],
    required: true,
  },
  requestedAssets: {
    type: [AssetSchema],
    required: true,
  },
  assetsInEscrow: {
    type: Boolean,
    required: true,
    default: false,
  },
  counterOffers: {
    type: [Number],
    default: [],
  },
  parentOfferId: {
    type: Number,
    required: false,
    index: true,
  },
  txHash: {
    type: String,
    required: false,
  },
}, {
  timestamps: true,
  versionKey: false,
});

// Indexes for efficient querying
OfferSchema.index({ maker: 1, status: 1 });
OfferSchema.index({ targetUser: 1, status: 1 });
OfferSchema.index({ collectionAddress: 1, status: 1 });
OfferSchema.index({ deadline: 1, status: 1 });
OfferSchema.index({ createdAt: -1 });

export interface IOfferDocument extends Omit<OfferDocument, '_id'>, Document {}

// Static methods interface
interface OfferModel extends mongoose.Model<IOfferDocument> {
  findByTokenId(contractAddress: string, tokenId: string, isActive?: boolean): Promise<IOfferDocument[]>;
  findByMaker(makerAddress: string, isActive?: boolean): Promise<IOfferDocument[]>;
}

// Static methods for the Offer model
OfferSchema.statics.findByTokenId = function(
  contractAddress: string,
  tokenId: string,
  isActive: boolean = true
) {
  const query: any = {
    $or: [
      { 'offeredAssets.contractAddress': contractAddress, 'offeredAssets.tokenIdOrAmount': tokenId },
      { 'requestedAssets.contractAddress': contractAddress, 'requestedAssets.tokenIdOrAmount': tokenId }
    ]
  };

  if (isActive) {
    query.status = { $in: [0, 1] }; // CREATED and ACTIVE
  }

  return this.find(query).sort({ createdAt: -1 }).lean();
};

OfferSchema.statics.findByMaker = function(
  makerAddress: string,
  isActive?: boolean
) {
  const query: any = { maker: makerAddress };

  if (isActive !== undefined) {
    if (isActive) {
      query.status = { $in: [0, 1] }; // CREATED and ACTIVE
    } else {
      query.status = { $in: [2, 3, 4] }; // ACCEPTED, CANCELLED, EXPIRED
    }
  }

  return this.find(query).sort({ createdAt: -1 }).lean();
};

export const Offer = mongoose.model<IOfferDocument, OfferModel>('Offer', OfferSchema);
