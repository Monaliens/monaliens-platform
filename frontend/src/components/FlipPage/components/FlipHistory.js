import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { getRecentFlips, getUserFlips } from '../utils/flipApi';
import { formatEther } from 'viem';
import monadImage from '../../../assets/images/monad.png';
import { useWatchContractEvent } from 'wagmi';
import { COIN_FLIP_CONTRACT_ADDRESS, COIN_FLIP_ABI } from '../utils/constants';
import { useGameWallet } from '../../../context';
import HistoryAddressSearch from '../../common/HistoryAddressSearch';
import { useHistoryFetchLoading } from '../../../hooks/useHistoryFetchLoading';

// Coin images
const coinHeadsImage = '/assets/images/flip/head.png';
const coinTailsImage = '/assets/images/flip/tail.png';

// Styled components
const FlipsHistoryContainer = styled.div`
  max-width: 1000px;
  margin: 0 auto 4rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  margin-top: 3rem;
  
  @media (min-width: 768px) {
    flex-direction: row;
    gap: 1.5rem;
  }
`;

const FlipsPanel = styled.div`
  background: var(--bg-glass);
  border-radius: 20px;
  padding: 1.5rem;
  flex: 1;
  box-shadow: 0 10px 30px var(--shadow-color);
  border: 1px solid var(--border-light);
  backdrop-filter: blur(8px);

  h3 {
    font-size: 1.4rem;
    font-weight: 700;
    margin-bottom: 1rem;
    color: var(--accent-primary);
    text-transform: uppercase;
    letter-spacing: 1px;
    text-align: center;

    @media (min-width: 768px) {
      font-size: 1.6rem;
    }
  }
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;

  h3 {
    margin: 0;
    text-align: left;
  }
`;

const FlipsList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 450px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
    background-color: var(--table-header-bg);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: var(--border-color);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: var(--accent-primary);
  }
`;

const HistoryFlipItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-bottom: 1px solid var(--border-light);
  position: relative;

  .flip-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    box-shadow: 0 2px 5px var(--shadow-color);
    flex-shrink: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;

    img {
      width: 140%;
      height: 140%;
      object-fit: contain;
      image-rendering: auto;
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
      -webkit-transform: translateZ(0);
      transform: translateZ(0);
    }
  }

  .flip-details {
    flex: 1;

    .flip-label {
      font-weight: 600;
      color: var(--text-primary);
      font-size: 0.85rem;
      margin-bottom: 4px;
    }

    .flip-date {
      font-size: 0.8rem;
      color: var(--text-secondary);
    }

    .wallet-address {
      font-size: 0.8rem;
      color: var(--accent-primary);
      font-weight: 500;
      font-family: monospace;
      margin-top: 2px;
    }
  }
`;

const InfoButton = styled.button`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--table-header-bg);
  border: 1.5px solid var(--border-color);
  color: var(--accent-primary);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background: var(--border-color);
    border-color: var(--accent-primary);
    transform: scale(1.1);
  }
`;

const InfoTooltip = styled.div`
  position: fixed;
  background: var(--bg-card);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 1.25rem 1.25rem;
  box-shadow: 0 8px 25px var(--shadow-color);
  min-width: 280px;
  z-index: 99999;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0;
  gap: 1rem;
  border-bottom: 1px solid var(--border-light);

  &:last-child {
    border-bottom: none;
  }
`;

const InfoLabel = styled.span`
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const InfoValue = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  font-family: ${props => props.$mono ? 'monospace' : 'inherit'};
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: ${props => props.$copyable ? 'pointer' : 'default'};

  ${props => props.$copyable && `
    &:hover {
      color: var(--accent-primary);
    }
  `}
`;

const ProfitBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  color: ${props => props.$isPositive ? 'var(--accent-green)' : 'var(--accent-red)'};
  margin-left: 8px;

  img {
    width: 14px;
    height: 14px;
  }
`;

const TxLink = styled.a`
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent-primary);
  text-decoration: none;
  font-family: monospace;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;

  &:hover {
    color: #8e44ad;
    text-decoration: underline;
  }

  &::after {
    content: '↗';
    font-size: 0.7rem;
  }
`;

const LoadingText = styled.div`
  color: var(--text-secondary);
  font-size: 0.9rem;
  text-align: center;
  padding: 2rem;
`;

const EmptyText = styled.div`
  color: var(--text-secondary);
  font-size: 0.9rem;
  text-align: center;
  padding: 2rem;
`;

/**
 * FlipHistory Component - Displays user flip history and recent flips
 */
const FlipHistory = ({
  userAddress,
  isConnected = false,
  refreshTrigger = 0
}) => {
  const { address: gameWalletAddress, hasGameWallet } = useGameWallet();
  const [userFlips, setUserFlips] = useState([]);
  const [recentFlips, setRecentFlips] = useState([]);
  const [searchedAddress, setSearchedAddress] = useState('');
  const [searchedFlips, setSearchedFlips] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isRecentSearchOpen, setIsRecentSearchOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(true);
  const [openTooltip, setOpenTooltip] = useState(null); // Track which tooltip is open
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [selectedFlip, setSelectedFlip] = useState(null); // Store flip data for tooltip
  const { shouldBlockUI: shouldBlockRecentUI, markLoaded: markRecentLoaded } = useHistoryFetchLoading();
  const { shouldBlockUI: shouldBlockUserUI, markLoaded: markUserLoaded } = useHistoryFetchLoading();

  const fetchRecentFlips = useCallback(async ({ silent = false } = {}) => {
    if (shouldBlockRecentUI({ silent })) {
      setLoading(true);
    }
    try {
        const data = await getRecentFlips(20);
        if (data.success && data.data) {
          // Filter out incomplete flips (result: null or undefined)
          const completedFlips = data.data.filter(flip => 
            flip.result !== null && flip.result !== undefined && flip.result !== ''
          );
          
          setRecentFlips(completedFlips);
        }
    } catch (err) {
      // Error fetching recent flips
    } finally {
      setLoading(false);
      markRecentLoaded();
    }
  }, [shouldBlockRecentUI, markRecentLoaded]);

  useEffect(() => {
    fetchRecentFlips();
  }, [fetchRecentFlips]);

  useEffect(() => {
    if (refreshTrigger <= 0) return;
    fetchRecentFlips({ silent: true });
  }, [refreshTrigger, fetchRecentFlips]);

  const fetchUserFlips = useCallback(async ({ silent = false } = {}) => {
    if (!isConnected || !userAddress) {
      setUserFlips([]);
      setUserLoading(false);
      return;
    }

    if (shouldBlockUserUI({ silent })) {
      setUserLoading(true);
    }

    try {
        // Fetch main wallet flips
        const mainData = await getUserFlips(userAddress, 20);
        let allFlips = [];

        if (mainData.success && mainData.data) {
          const mainFlips = mainData.data.filter(flip =>
            flip.result !== null && flip.result !== undefined && flip.result !== ''
          ).map(flip => ({ ...flip, walletType: 'main' }));
          allFlips = [...mainFlips];
        }

        // Fetch game wallet flips if exists
        if (hasGameWallet && gameWalletAddress) {
          const gameData = await getUserFlips(gameWalletAddress, 20);
          if (gameData.success && gameData.data) {
            const gameFlips = gameData.data.filter(flip =>
              flip.result !== null && flip.result !== undefined && flip.result !== ''
            ).map(flip => ({ ...flip, walletType: 'game' }));
            allFlips = [...allFlips, ...gameFlips];
          }
        }

        // Sort by timestamp (newest first) and remove duplicates
        allFlips.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const uniqueFlips = allFlips.filter((flip, index, self) =>
          index === self.findIndex(f => f.sequenceNumber?.toString() === flip.sequenceNumber?.toString())
        ).slice(0, 20);

      setUserFlips(uniqueFlips);
    } catch (err) {
      // Error fetching user flips
    } finally {
      setUserLoading(false);
      markUserLoaded();
    }
  }, [isConnected, userAddress, hasGameWallet, gameWalletAddress, shouldBlockUserUI, markUserLoaded]);

  useEffect(() => {
    fetchUserFlips();
  }, [fetchUserFlips]);

  useEffect(() => {
    if (refreshTrigger <= 0) return;
    fetchUserFlips({ silent: true });
  }, [refreshTrigger, fetchUserFlips]);

  useEffect(() => {
    if (!searchedAddress) {
      setSearchedFlips([]);
      setSearchLoading(false);
      return;
    }

    const fetchSearchedFlips = async () => {
      try {
        setSearchLoading(true);
        const data = await getUserFlips(searchedAddress, 20);
        if (data.success && data.data) {
          const completedFlips = data.data.filter(flip =>
            flip.result !== null && flip.result !== undefined && flip.result !== ''
          );
          setSearchedFlips(completedFlips);
        } else {
          setSearchedFlips([]);
        }
      } catch (err) {
        setSearchedFlips([]);
      } finally {
        setSearchLoading(false);
      }
    };

    fetchSearchedFlips();
  }, [searchedAddress]);

  const handleAddressSearch = (address) => {
    setSearchedAddress(address);
  };

  const handleClearSearch = () => {
    setSearchedAddress('');
    setSearchedFlips([]);
  };

  // Pending games - CoinflipStarted event'lerini kaydet
  const pendingGames = useRef({});

  // CoinflipStarted event'ini dinle - amount bilgisini kaydet
  useWatchContractEvent({
    address: COIN_FLIP_CONTRACT_ADDRESS,
    abi: COIN_FLIP_ABI,
    eventName: 'CoinflipStarted',
    enabled: true,
    onLogs: (logs) => {
      logs.forEach((log) => {
        try {
          const seqNum = log.args.sequenceNumber?.toString();
          if (seqNum) {
            pendingGames.current[seqNum] = {
              player: log.args.player,
              choice: log.args.choice,
              amount: log.args.amount,
              isNative: log.args.isNative,
              timestamp: new Date().toISOString()
            };
          }
        } catch (err) {
          // Error processing CoinflipStarted event
        }
      });
    }
  });

  // CoinflipResult event'ini dinle - Recent Flips'e ekle
  useWatchContractEvent({
    address: COIN_FLIP_CONTRACT_ADDRESS,
    abi: COIN_FLIP_ABI,
    eventName: 'CoinflipResult',
    enabled: true,
    onLogs: (logs) => {
      logs.forEach((log) => {
        try {
          const seqNum = log.args.sequenceNumber?.toString();
          const player = log.args.player;
          const choice = log.args.choice;
          const result = log.args.result;
          const winner = log.args.winner;
          const randomNumber = log.args.randomNumber;

          // Pending game'den amount bilgisini al
          const pendingGame = pendingGames.current[seqNum];
          const amount = pendingGame?.amount;

          if (!amount) {

            setTimeout(async () => {
              try {
                const data = await getRecentFlips(20);
                if (data.success && data.data) {
                  const completedFlips = data.data.filter(flip =>
                    flip.result !== null && flip.result !== undefined && flip.result !== ''
                  );
                  setRecentFlips(completedFlips);
                }
              } catch (err) {}
            }, 2000);
            return;
          }


          const newFlip = {
            sequenceNumber: seqNum,
            player: player,
            choice: choice ? 'heads' : 'tails',
            result: result ? 'heads' : 'tails',
            winner: winner,
            amount: amount.toString(),
            isNative: pendingGame?.isNative ?? true,
            randomNumber: randomNumber,
            timestamp: pendingGame?.timestamp || new Date().toISOString(),
            transactionHash: log.transactionHash,
            resultTransactionHash: log.transactionHash
          };


          setRecentFlips(prev => {

            const exists = prev.some(f => f.sequenceNumber?.toString() === seqNum);
            if (exists) return prev;

            const updated = [newFlip, ...prev].slice(0, 20);
            return updated;
          });

          if (searchedAddress && player?.toLowerCase() === searchedAddress.toLowerCase()) {
            setSearchedFlips(prev => {
              const exists = prev.some(f => f.sequenceNumber?.toString() === seqNum);
              if (exists) return prev;
              return [newFlip, ...prev].slice(0, 20);
            });
          }


          const isMainWallet = userAddress && player?.toLowerCase() === userAddress?.toLowerCase();
          const isGameWallet = gameWalletAddress && player?.toLowerCase() === gameWalletAddress?.toLowerCase();

          if (isMainWallet || isGameWallet) {
            const flipWithType = { ...newFlip, walletType: isGameWallet ? 'game' : 'main' };
            setUserFlips(prev => {
              const exists = prev.some(f => f.sequenceNumber?.toString() === seqNum);
              if (exists) return prev;

              const updated = [flipWithType, ...prev].slice(0, 20);
              return updated;
            });
          }

          // Pending game'i temizle
          delete pendingGames.current[seqNum];
        } catch (err) {
          // Error processing CoinflipResult event
        }
      });
    }
  });

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown';
    }
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 5)}${address.slice(-3)}`;
  };

  const formatAmount = (amount, isNative) => {
    try {
      const amountEther = formatEther(BigInt(amount));
      return parseFloat(amountEther).toFixed(2);
    } catch {
      return '0';
    }
  };

  const getFlipLabel = (flip) => {
    const amount = formatAmount(flip.amount, flip.isNative);
    const token = flip.isNative ? 'MON' : 'LMON';
    const choice = flip.choice === 'heads' ? 'Heads' : 'Tails';
    const result = flip.winner ? 'WON' : 'LOST';
    return `Bet ${amount} ${token} on ${choice} - ${result}`;
  };

  const getFlipProfit = (flip) => {
    const amount = parseFloat(formatAmount(flip.amount, flip.isNative));
    if (flip.winner) {
      const profit = (amount * 0.95).toFixed(2);
      return { value: `+${profit}`, isPositive: true };
    } else {
      return { value: `-${amount.toFixed(2)}`, isPositive: false };
    }
  };

  const truncateHash = (hash) => {
    if (!hash) return '';
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  const copyToClipboard = (e, text) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
  };

  const getExplorerUrl = (hash) => {
    return `https://monadvision.com/tx/${hash}`;
  };

  const handleInfoClick = (flipId, flip, e) => {
    e.stopPropagation();

    if (openTooltip === flipId) {
      setOpenTooltip(null);
      setSelectedFlip(null);
      return;
    }

    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();


    setTooltipPos({
      top: rect.top - 100,
      left: rect.left - 285
    });
    setSelectedFlip(flip);
    setOpenTooltip(flipId);
  };

  // Close tooltip when clicking outside or scrolling
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openTooltip && !event.target.closest('.info-tooltip-wrapper') && !event.target.closest('.info-tooltip')) {
        setOpenTooltip(null);
        setSelectedFlip(null);
      }
    };

    const handleScroll = () => {
      if (openTooltip) {
        setOpenTooltip(null);
        setSelectedFlip(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [openTooltip]);

  const displayedRecentFlips = searchedAddress ? searchedFlips : recentFlips;
  const displayedRecentLoading = searchedAddress ? searchLoading : loading;

  return (
    <FlipsHistoryContainer>
      {/* User Flips Panel */}
      <FlipsPanel>
        <PanelHeader>
          <h3>Your Flips</h3>
        </PanelHeader>
        {userLoading ? (
          <LoadingText>Loading...</LoadingText>
        ) : !isConnected ? (
          <EmptyText>Connect wallet to see your flips</EmptyText>
        ) : userFlips.length === 0 ? (
          <EmptyText>No flips yet</EmptyText>
        ) : (
          <FlipsList>
            {userFlips.map((flip) => {
              // Determine which coin image to show based on result
              const coinImage = flip.result === 'heads' ? coinHeadsImage : coinTailsImage;
              const flipId = `user-${flip.sequenceNumber || flip.transactionHash}`;

              return (
                <HistoryFlipItem key={flip.sequenceNumber || flip.transactionHash}>
                  <div className="flip-icon">
                    <img src={coinImage} alt={flip.result === 'heads' ? 'Heads' : 'Tails'} />
                  </div>
                  <div className="flip-details">
                    <div className="flip-label" style={{ color: flip.winner ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {getFlipLabel(flip)}
                      <ProfitBadge $isPositive={getFlipProfit(flip).isPositive}>
                        {getFlipProfit(flip).value}
                        <img src={monadImage} alt="MON" />
                      </ProfitBadge>
                    </div>
                    <div className="flip-date">{formatDate(flip.timestamp)}</div>
                  </div>
                  <div className="info-tooltip-wrapper">
                    <InfoButton onClick={(e) => handleInfoClick(flipId, flip, e)}>i</InfoButton>
                  </div>
                </HistoryFlipItem>
              );
            })}
          </FlipsList>
        )}
      </FlipsPanel>

      {/* Recent Flips Panel */}
      <FlipsPanel>
        <PanelHeader>
          <h3>{isRecentSearchOpen || searchedAddress ? 'Flips' : 'Recent Flips'}</h3>
          <HistoryAddressSearch
            active={Boolean(searchedAddress)}
            searchedAddress={searchedAddress}
            onSearch={handleAddressSearch}
            onClear={handleClearSearch}
            formatAddress={formatAddress}
            onOpenChange={setIsRecentSearchOpen}
            compact
          />
        </PanelHeader>
        {displayedRecentLoading ? (
          <LoadingText>Loading...</LoadingText>
        ) : displayedRecentFlips.length === 0 ? (
          <EmptyText>{searchedAddress ? 'No flips found for this address' : 'No recent flips'}</EmptyText>
        ) : (
          <FlipsList>
            {displayedRecentFlips.map((flip) => {
              // Determine which coin image to show based on result
              const coinImage = flip.result === 'heads' ? coinHeadsImage : coinTailsImage;
              const flipId = `recent-${flip.sequenceNumber || flip.transactionHash}`;

              return (
                <HistoryFlipItem key={flip.sequenceNumber || flip.transactionHash}>
                  <div className="flip-icon">
                    <img src={coinImage} alt={flip.result === 'heads' ? 'Heads' : 'Tails'} />
                  </div>
                  <div className="flip-details">
                    <div className="flip-label" style={{ color: flip.winner ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {getFlipLabel(flip)}
                      <ProfitBadge $isPositive={getFlipProfit(flip).isPositive}>
                        {getFlipProfit(flip).value}
                        <img src={monadImage} alt="MON" />
                      </ProfitBadge>
                    </div>
                    {flip.player && (
                      <div className="flip-date">
                        {formatAddress(flip.player)} {formatDate(flip.timestamp)}
                      </div>
                    )}
                  </div>
                  <div className="info-tooltip-wrapper">
                    <InfoButton onClick={(e) => handleInfoClick(flipId, flip, e)}>i</InfoButton>
                  </div>
                </HistoryFlipItem>
              );
            })}
          </FlipsList>
        )}
      </FlipsPanel>

      {/* Global Tooltip - rendered outside panels to avoid stacking context issues */}
      {openTooltip && selectedFlip && (
        <InfoTooltip className="info-tooltip" style={{ top: tooltipPos.top, left: tooltipPos.left }}>
          <InfoRow>
            <InfoLabel>Choice</InfoLabel>
            <InfoValue>{selectedFlip.choice === 'heads' ? 'Heads' : 'Tails'}</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Result</InfoLabel>
            <InfoValue>{selectedFlip.result === 'heads' ? 'Heads' : 'Tails'}</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Sequence</InfoLabel>
            <TxLink href={`https://entropy-explorer.pyth.network/?search=${selectedFlip.sequenceNumber}&chain=monad`} target="_blank" rel="noopener noreferrer">
              #{selectedFlip.sequenceNumber}
            </TxLink>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Random Number</InfoLabel>
            <InfoValue
              $mono
              $copyable
              title="Click to copy"
              onClick={(e) => copyToClipboard(e, selectedFlip.randomNumber)}
            >
              {truncateHash(selectedFlip.randomNumber)}
            </InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Submit Tx</InfoLabel>
            <TxLink href={getExplorerUrl(selectedFlip.transactionHash)} target="_blank" rel="noopener noreferrer">
              {truncateHash(selectedFlip.transactionHash)}
            </TxLink>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Result Tx</InfoLabel>
            <TxLink href={getExplorerUrl(selectedFlip.resultTransactionHash)} target="_blank" rel="noopener noreferrer">
              {truncateHash(selectedFlip.resultTransactionHash)}
            </TxLink>
          </InfoRow>
          {selectedFlip.timestamp && (
            <InfoRow>
              <InfoLabel>Date</InfoLabel>
              <InfoValue>
                {new Date(selectedFlip.timestamp).toLocaleString()}
              </InfoValue>
            </InfoRow>
          )}
        </InfoTooltip>
      )}
    </FlipsHistoryContainer>
  );
};

export default FlipHistory;

