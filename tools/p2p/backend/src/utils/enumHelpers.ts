import { AssetType, OfferType, OfferStatus } from '../types';

export function getAssetTypeName(assetType: number): string {
  switch (assetType) {
    case AssetType.NATIVE: return 'NATIVE';
    case AssetType.ERC20: return 'ERC20';
    case AssetType.ERC721: return 'ERC721';
    case AssetType.ERC1155: return 'ERC1155';
    default: return 'UNKNOWN';
  }
}

export function getOfferTypeName(offerType: number): string {
  switch (offerType) {
    case OfferType.SINGLE: return 'SINGLE';
    case OfferType.MULTI: return 'MULTI';
    case OfferType.COLLECTION: return 'COLLECTION';
    case OfferType.OPEN: return 'OPEN';
    default: return 'UNKNOWN';
  }
}

export function getOfferStatusName(status: number): string {
  switch (status) {
    case OfferStatus.CREATED: return 'CREATED';
    case OfferStatus.ACTIVE: return 'ACTIVE';
    case OfferStatus.ACCEPTED: return 'ACCEPTED';
    case OfferStatus.CANCELLED: return 'CANCELLED';
    case OfferStatus.EXPIRED: return 'EXPIRED';
    default: return 'UNKNOWN';
  }
}

export function enrichOfferWithEnums(offer: any): any {
  return {
    ...offer,
    offerTypeString: getOfferTypeName(offer.offerType),
    statusString: getOfferStatusName(offer.status),
    offeredAssets: offer.offeredAssets?.map((asset: any) => ({
      ...asset,
      assetTypeString: getAssetTypeName(asset.assetType),
    })) || [],
    requestedAssets: offer.requestedAssets?.map((asset: any) => ({
      ...asset,
      assetTypeString: getAssetTypeName(asset.assetType),
    })) || [],
  };
}