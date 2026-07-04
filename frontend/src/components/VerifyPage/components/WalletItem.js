import React, { useState } from 'react';
import { useWalletNFTs } from '../hooks/useWalletNFTs';
import {
  WalletItemContainer,
  WalletHeader,
  WalletInfo,
  WalletDetails,
  WalletAddress,
  WalletStatus,
  WalletActions,
  DeleteButton,
  ExpandButton,
  NFTGridContainer,
  NFTGrid,
  NFTCard,
  NFTImage,
  NFTName,
  NFTLoadingText,
  NFTEmptyText,
  WalletTypeBadge,
  PrimaryBadge,
  SetPrimaryButton,
} from '../styles';

/**
 * Convert IPFS URL to HTTP gateway URL
 * @param {string} ipfsUrl - IPFS URL (ipfs://...)
 * @returns {string} HTTP URL
 */
const convertIpfsUrl = (ipfsUrl) => {
  if (!ipfsUrl) return '';
  if (ipfsUrl.startsWith('ipfs://')) {
    return ipfsUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }
  if (ipfsUrl.startsWith('https://ipfs.io/ipfs/')) {
    return ipfsUrl;
  }
  return ipfsUrl;
};

/**
 * Get explorer URL based on wallet type
 * @param {string} address - Wallet address
 * @param {string} walletType - 'evm' or 'solana'
 * @returns {string} Explorer URL
 */
const getExplorerUrl = (address, walletType) => {
  if (walletType === 'solana') {
    return `https://solscan.io/account/${address}`;
  }
  return `https://monadvision.com/address/${address}`;
};

/**
 * WalletItem Component
 * Displays a single wallet with expandable NFT list
 *
 * @param {Object} props - Component props
 * @param {string|Object} props.wallet - Wallet data (string address or object with address)
 * @param {number} props.index - Wallet index for badge number
 * @param {Function} props.onRemove - Remove wallet handler
 * @param {boolean} props.isPrimary - Whether this wallet is the primary wallet
 * @param {Function} props.onSetPrimary - Set as primary wallet handler
 * @param {boolean} props.isSettingPrimary - Whether setting primary is in progress
 */
const WalletItem = ({ wallet, index, onRemove, isPrimary, onSetPrimary, isSettingPrimary }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const walletAddress = typeof wallet === 'string' ? wallet : wallet.address;
  const walletType = typeof wallet === 'object' ? wallet.walletType || 'evm' : 'evm';
  const nftCount = typeof wallet === 'object' ? wallet.nftCount || 0 : 0;
  const isSolana = walletType === 'solana';

  // Fetch NFTs only when expanded (only for EVM wallets)
  const { nfts, loading, error } = useWalletNFTs(isSolana ? null : walletAddress, isExpanded && !isSolana);

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <WalletItemContainer $index={index}>
      <WalletHeader>
        <WalletInfo>
          <WalletTypeBadge $isSolana={isSolana}>
            {isSolana ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.6 5.2L13.4 12l4.2 6.8h-3.2L11 12l3.4-6.8h3.2zm-6.6 0L6.8 12l4.2 6.8H7.8L4.4 12 7.8 5.2h3.2z"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            )}
            {isSolana ? 'SOL' : 'EVM'}
          </WalletTypeBadge>
          <WalletDetails>
            <WalletAddress
              as="a"
              href={getExplorerUrl(walletAddress, walletType)}
              target="_blank"
              rel="noopener noreferrer"
              title="View on explorer"
            >
              {walletAddress}
            </WalletAddress>
            {!isSolana && (
              <WalletStatus $hasNFTs={nftCount > 0}>
                {`${nftCount} NFT${nftCount !== 1 ? 's' : ''}`}
              </WalletStatus>
            )}
          </WalletDetails>
        </WalletInfo>

        <WalletActions>
          {/* Primary wallet indicator/button - only for EVM wallets */}
          {!isSolana && (
            isPrimary ? (
              <PrimaryBadge title="Primary wallet for rewards">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                Primary
              </PrimaryBadge>
            ) : (
              <SetPrimaryButton
                onClick={() => onSetPrimary(walletAddress)}
                disabled={isSettingPrimary}
                title="Set as primary wallet for rewards"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                Set Primary
              </SetPrimaryButton>
            )
          )}
          <DeleteButton onClick={() => onRemove(wallet)} title="Remove wallet">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </DeleteButton>
          {!isSolana && (
            <ExpandButton
              onClick={handleToggleExpand}
              $isExpanded={isExpanded}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </ExpandButton>
          )}
        </WalletActions>
      </WalletHeader>

      {!isSolana && (
        <NFTGridContainer $isExpanded={isExpanded}>
          {loading && <NFTLoadingText>Loading NFTs...</NFTLoadingText>}

          {!loading && error && <NFTEmptyText>Error loading NFTs</NFTEmptyText>}

          {!loading && !error && nfts.length === 0 && isExpanded && (
            <NFTEmptyText>No NFTs found in this wallet</NFTEmptyText>
          )}

          {!loading && !error && nfts.length > 0 && (
            <NFTGrid>
              {nfts.map((nft, idx) => {
                const magicEdenUrl = `https://magiceden.io/item-details/monad/${nft.token_address}/${nft.token_id}`;

                return (
                  <NFTCard
                    key={`${nft.token_id}-${idx}`}
                    $index={idx}
                    onClick={() => window.open(magicEdenUrl, '_blank')}
                  >
                    <NFTImage
                      src={convertIpfsUrl(nft.image || nft.metadata?.image)}
                      alt={nft.metadata?.name || `NFT #${nft.token_id}`}
                      onError={(e) => {
                        e.target.src = '/raffle-images/nftphoto.png';
                      }}
                    />
                    <NFTName>
                      {nft.metadata?.name || `#${nft.token_id}`}
                    </NFTName>
                  </NFTCard>
                );
              })}
            </NFTGrid>
          )}
        </NFTGridContainer>
      )}
    </WalletItemContainer>
  );
};

export default WalletItem;
