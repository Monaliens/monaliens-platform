import { ASSET_TYPES } from '../../utils/constants';

export const shortenAddress = (address) => {
  if (!address) return 'Unknown';
  const normalized = String(address);
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatRelativeDeadline = (value) => {
  if (!value) return 'No deadline';
  const deadline = new Date(value).getTime();
  if (Number.isNaN(deadline)) return 'No deadline';
  const diff = deadline - Date.now();
  if (diff <= 0) return 'Expired';

  const minutes = Math.floor(diff / 60000);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;

  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const toMonAmount = (raw) => {
  if (!raw) return '0 MON';
  const amount = Number(raw) / 1e18;
  if (!Number.isFinite(amount)) return '—';
  return `${amount.toFixed(amount >= 1 ? 2 : 4)} MON`;
};

const toLmonAmount = (raw) => {
  if (!raw) return '0';
  // LMON has 18 decimals, convert from wei
  const amount = Number(raw) / 1e18;
  if (!Number.isFinite(amount)) return '—';
  return amount.toFixed(amount >= 1 ? 2 : 4);
};

export const formatAssetForDisplay = (asset) => {
  if (!asset) {
    return {
      title: 'Unknown asset',
      subtitle: '',
      badge: '—'
    };
  }

  switch (asset.assetType) {
    case ASSET_TYPES.NATIVE:
      return {
        title: toMonAmount(asset.tokenIdOrAmount),
        subtitle: 'Monad Token (MON)',
        badge: 'MON',
        image: '/assets/images/monad.png'
      };
    case ASSET_TYPES.ERC20: {
      const isLmon = asset.contractAddress?.toLowerCase() === '0xecc6f8fb4962cbf02d83cee8c4d9c2c96204a17d';

      if (isLmon) {
        return {
          title: `${toLmonAmount(asset.tokenIdOrAmount)} LMON`,
          subtitle: 'LMON Token',
          badge: 'LMON',
          image: '/images/lmonphoto.png'
        };
      }

      return {
        title: `${asset.tokenIdOrAmount} Tokens`,
        subtitle: asset.metadata?.symbol || 'ERC-20',
        badge: 'ERC20'
      };
    }
    case ASSET_TYPES.ERC721: {
      const collection = asset.metadata?.collectionName || 'NFT';
      const amountValue = Number(asset.amount || 0);
      const isCollectionRequest = !asset.isSpecific && amountValue > 1;
      const title = isCollectionRequest
        ? `${amountValue}x ${collection}`
        : asset.metadata?.name || (asset.isSpecific ? `Token #${asset.tokenIdOrAmount}` : `${asset.amount || 1}x ${collection}`);
      const subtitle = isCollectionRequest
        ? asset.metadata?.name || collection
        : collection;

      // Special contract address check - Last Invitation NFT
      const isSpecialNFT = asset.contractAddress?.toLowerCase() === '0x85a219f66b5be2afccf81fbfd4de236af93259a6';

      return {
        title,
        subtitle,
        badge: asset.isSpecific ? 'NFT' : `${asset.amount || 1}x`,
        image: isSpecialNFT
          ? '/raffle-images/last-invitation.gif'
          : (asset.metadata?.image || asset.metadata?.imageLarge || asset.metadata?.imageSmall || '/raffle-images/nftphoto.png')
      };
    }
    case ASSET_TYPES.ERC1155:
      return {
        title: `${asset.amount || 1}x Token #${asset.tokenIdOrAmount}`,
        subtitle: 'ERC-1155',
        badge: '1155'
      };
    default:
      return {
        title: 'Unknown asset',
        subtitle: asset.contractAddress,
        badge: '?'
      };
  }
};

export const extractAttributes = (asset) => {
  if (!asset?.metadata?.attributes?.length) {
    return [];
  }
  return asset.metadata.attributes.map((attribute, index) => ({
    id: `${attribute.key}-${attribute.value}-${index}`,
    key: attribute.key,
    value: attribute.value
  }));
};

export const buildExplorerLink = (hash, type = 'address') => {
  if (!hash) return '#';
  return `https://testnet.monadexplorer.com/${type}/${hash}`;
};
