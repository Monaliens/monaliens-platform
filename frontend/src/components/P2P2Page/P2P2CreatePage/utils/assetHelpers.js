import { formatEther } from 'viem';
import { ASSET_TYPES } from './constants';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const normalizeAddress = (value = '') => value.toLowerCase();

export const shortenAddress = (value = '') => {
  if (!value) return '';
  return value.length > 10 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
};

export const toMonDisplay = (raw) => {
  if (raw === null || raw === undefined) return '0';
  try {
    const formatted = formatEther(BigInt(raw));
    if (!formatted.includes('.')) return formatted;
    const [whole, fraction = ''] = formatted.split('.');
    const trimmedFraction = fraction.replace(/0+$/, '');
    return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
  } catch (err) {
    if (typeof raw === 'number') return String(raw);
    if (typeof raw === 'string') return raw;
    return '0';
  }
};

export const parseBigInt = (value) => {
  if (value === null || value === undefined) return null;
  try {
    return BigInt(String(value));
  } catch (err) {
    return null;
  }
};

export const createRequestedId = () => `prefill-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

export const shouldIgnoreAsset = (asset) => {
  if (!asset) return true;

  const type = asset.assetType;
  if (type === ASSET_TYPES.NATIVE || type === ASSET_TYPES.ERC20) {
    return false;
  }

  if (type !== ASSET_TYPES.ERC721) {
    return true;
  }

  const labelCandidates = [
    asset.metadata?.collectionName,
    asset.metadata?.collection?.name,
    asset.metadata?.name,
    asset.name
  ]
    .filter(Boolean)
    .map((value) => value.toLowerCase());

  if (labelCandidates.some((label) => label.includes('unknown'))) {
    return true;
  }

  return false;
};
