import React, { useState } from 'react';
import { useBalance, useReadContract } from 'wagmi';
import { formatEther } from 'viem';
import {
  StepSlot,
  StepCard,
  StepTitle,
  StepDescription,
  HelperText,
  AssetGrid,
  AssetCard,
  AssetImage,
  AssetInfo,
  AssetName,
  AssetCollection,
  TokenSelectorContainer,
  TokenSelectorRow,
  TokenToggle,
  TokenToggleThumb,
  TokenToggleButton,
  TokenLogo,
  TokenInputWrapper,
  TokenInput,
  TokenBalance
} from '../styles';

// LMON contract address
const LMON_CONTRACT = '0xECc6F8fB4962cBF02D83CEE8c4d9c2C96204A17D';

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
];

const SelectAssetsStep = ({
  loading,
  error,
  nfts,
  selectedAssets,
  onToggleAsset,
  offeredNativeAmount,
  onNativeAmountChange,
  offeredLmonAmount,
  onLmonAmountChange,
  walletAddress,
  descriptionOverride,
  disabled = false
}) => {
  // Token selector state
  const [selectedToken, setSelectedToken] = useState('MON');

  // Fetch MON balance
  const { data: monBalance } = useBalance({
    address: walletAddress,
    watch: true
  });

  // Fetch LMON balance
  const { data: lmonBalanceRaw } = useReadContract({
    address: LMON_CONTRACT,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    query: {
      enabled: !!walletAddress
    }
  });

  const formatBalance = (balance) => {
    if (!balance) return '0';
    try {
      const formatted = formatEther(balance);
      const num = parseFloat(formatted);
      if (num === 0) return '0';
      if (num < 0.01) return '<0.01';
      if (num > 1000000) return (num / 1000000).toFixed(2) + 'M';
      if (num > 1000) return (num / 1000).toFixed(2) + 'K';
      return num.toFixed(2);
    } catch {
      return '0';
    }
  };

  const displayBalance = selectedToken === 'MON'
    ? formatBalance(monBalance?.value)
    : formatBalance(lmonBalanceRaw);

  const getMaxAmount = (token) => {
    if (token === 'MON' && monBalance?.value) {
      const balanceInEther = parseFloat(formatEther(monBalance.value));
      return Math.max(0, balanceInEther - 2);
    }
    if (token === 'LMON' && lmonBalanceRaw) {
      return parseFloat(formatEther(lmonBalanceRaw));
    }
    return null;
  };

  const handleAmountChange = (value, token) => {
    // Only allow integers (no decimals)
    const sanitized = value.replace(/[^0-9]/g, '');

    const maxAmount = getMaxAmount(token);
    if (maxAmount !== null && sanitized) {
      const numValue = parseInt(sanitized, 10);
      const maxInt = Math.floor(maxAmount);
      if (numValue > maxInt) {
        value = maxInt.toString();
      } else {
        value = sanitized;
      }
    } else {
      value = sanitized;
    }

    if (token === 'MON') {
      onNativeAmountChange(value);
    } else {
      onLmonAmountChange(value);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px' }}>
          Loading your NFTs...
        </div>
      );
    }

    if (error) {
      return (
        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: 'red' }}>
          {walletAddress ? 'Failed to load NFTs' : 'Connect wallet to see your NFTs'}
        </div>
      );
    }

    if (!nfts.length) {
      return (
        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px' }}>
          {walletAddress ? 'No NFTs found in your wallet' : 'Connect wallet to see your NFTs'}
        </div>
      );
    }

    return nfts.map((nft) => (
      <AssetCard
        key={nft.id}
        $selected={selectedAssets.find((item) => item.id === nft.id)}
        onClick={() => !disabled && onToggleAsset(nft)}
        style={{
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          pointerEvents: disabled ? 'none' : 'auto'
        }}
      >
        {nft.image ? (
          <AssetImage src={nft.image} alt={nft.name} />
        ) : (
          <AssetImage as="div" className="placeholder">
            <span>NFT</span>
          </AssetImage>
        )}
        <AssetInfo>
          <AssetName>{nft.name}</AssetName>
          <AssetCollection>{nft.collection.name}</AssetCollection>
        </AssetInfo>
      </AssetCard>
    ));
  };

  return (
    <StepSlot data-active="true">
      <StepCard>
        <StepTitle>Select Your Assets</StepTitle>
        <StepDescription>
          {descriptionOverride
            ? descriptionOverride
            : loading
              ? 'Loading your NFTs...'
              : error
                ? 'Error loading NFTs'
                : `Choose assets to offer (${selectedAssets.length} selected)`}
        </StepDescription>

        <TokenSelectorContainer>
          <TokenSelectorRow>
            <TokenToggle>
              <TokenToggleThumb
                style={{
                  transform: selectedToken === 'LMON' ? 'translateX(calc(100% - 1px))' : 'translateX(0)'
                }}
              />
              <TokenToggleButton
                type="button"
                $active={selectedToken === 'MON'}
                onClick={() => setSelectedToken('MON')}
                disabled={disabled}
              >
                <TokenLogo src="/assets/images/monad.png" alt="MON" />
                MON
              </TokenToggleButton>
              <TokenToggleButton
                type="button"
                $active={selectedToken === 'LMON'}
                onClick={() => setSelectedToken('LMON')}
                disabled={disabled}
              >
                <TokenLogo src="/images/lmonphoto.png" alt="LMON" />
                LMON
              </TokenToggleButton>
            </TokenToggle>

            <TokenInputWrapper>
              <TokenInput
                placeholder={`${selectedToken} amount`}
                value={selectedToken === 'MON' ? (offeredNativeAmount || '') : (offeredLmonAmount || '')}
                onChange={(e) => {
                  if (disabled) return;
                  handleAmountChange(e.target.value, selectedToken);
                }}
                disabled={disabled}
                type="text"
                inputMode="numeric"
              />
              {walletAddress && (
                <TokenBalance $hasValue={selectedToken === 'MON' ? !!offeredNativeAmount : !!offeredLmonAmount}>
                  Balance: {displayBalance}
                </TokenBalance>
              )}
            </TokenInputWrapper>
          </TokenSelectorRow>

          <HelperText>
            {offeredNativeAmount && parseFloat(offeredNativeAmount) > 0 && `Offering ${offeredNativeAmount} MON`}
            {offeredLmonAmount && parseFloat(offeredLmonAmount) > 0 && offeredNativeAmount && parseFloat(offeredNativeAmount) > 0 && ' + '}
            {offeredLmonAmount && parseFloat(offeredLmonAmount) > 0 && `${offeredLmonAmount} LMON`}
            {(!offeredNativeAmount || parseFloat(offeredNativeAmount) <= 0) && (!offeredLmonAmount || parseFloat(offeredLmonAmount) <= 0) && 'Enter token amount, or leave empty to only offer NFTs'}
          </HelperText>
        </TokenSelectorContainer>

        <AssetGrid>{renderContent()}</AssetGrid>
      </StepCard>
    </StepSlot>
  );
};

export default SelectAssetsStep;
