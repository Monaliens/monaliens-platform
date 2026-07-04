import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { formatEther, keccak256 } from 'viem';
import { createPublicClient, http } from 'viem';
import { monadMainnet } from '../config/reownConfig';
import { useReownWallet } from '../hooks/useReownWallet';
import { teeWalletApi } from '../services/teeWalletApi';

// ====== CONSTANTS ======
const TEE_TOKEN_KEY_PREFIX = "teeToken_";
const MODE_STORAGE_KEY = "gameWalletMode";
const MAX_NONCE_RETRIES = 12;

const GameWalletContext = createContext(null);

const getErrorText = (err) => [
  err?.message,
  err?.shortMessage,
  err?.details,
  err?.cause?.message,
  err?.cause?.shortMessage,
  err?.cause?.details
].filter(Boolean).join(' ');

const isNonceConflictError = (err) => {
  const text = getErrorText(err).toLowerCase();
  return (
    text.includes('nonce') ||
    text.includes('higher priority') ||
    text.includes('replacement transaction underpriced') ||
    text.includes('already reserved')
  );
};

const isAlreadyKnownError = (err) => {
  const text = getErrorText(err).toLowerCase();
  return (
    text.includes('already known') ||
    text.includes('already imported') ||
    text.includes('transaction already imported')
  );
};

export const GameWalletProvider = ({ children }) => {
  const { walletAddress, signMessage, isConnected } = useReownWallet();

  // Core state
  const [gameWallet, setGameWallet] = useState(null);
  const [balance, setBalance] = useState('0');
  const [isGameMode, setIsGameMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState(null);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);

  // TEE state
  const [teeToken, setTeeToken] = useState(null);
  const [teeAvailable, setTeeAvailable] = useState(null);

  // Nonce management
  const nonceRef = useRef(null);
  const nonceLockRef = useRef(false);
  const sendQueueRef = useRef(Promise.resolve());
  const loadingCountRef = useRef(0);

  // Gas fee cache (30s TTL)
  const gasCacheRef = useRef({ data: null, ts: 0 });
  const GAS_CACHE_TTL = 30000;

  // Storage keys
  const teeTokenKey = walletAddress ? `${TEE_TOKEN_KEY_PREFIX}${walletAddress.toLowerCase()}` : null;

  // Public client for reading blockchain — explicit rpc.monad.xyz to separate
  
  const publicClient = useMemo(() => createPublicClient({
    chain: monadMainnet,
    transport: http('https://rpc.monad.xyz', { retryCount: 0 })
  }), []);

  // ====== TEE AVAILABILITY CHECK ======
  useEffect(() => {
    const checkTee = async () => {
      try {
        const health = await teeWalletApi.healthCheck();
        const available = health.available && health.teeConnected;
        setTeeAvailable(available);
      } catch (err) {
        console.warn('TEE health check failed:', err);
        setTeeAvailable(false);
      }
    };

    checkTee();
    const interval = setInterval(checkTee, 60000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  // ====== LOAD WALLET FROM STORAGE ======
  useEffect(() => {
    setHasLoadedFromStorage(false);

    if (!teeTokenKey || !walletAddress) {
      setGameWallet(null);
      setTeeToken(null);
      setIsGameMode(false);
      setHasLoadedFromStorage(true);
      return;
    }

    const loadWallet = async () => {
      const modeKey = `${MODE_STORAGE_KEY}_${walletAddress?.toLowerCase()}`;


      const storedToken = localStorage.getItem(teeTokenKey);
      if (storedToken) {
        try {
          const tokenData = JSON.parse(storedToken);


          if (tokenData.expiresAt && Date.now() < tokenData.expiresAt) {
            setTeeToken(tokenData.token);
            setGameWallet({
              address: tokenData.gameWalletAddress,
              expiresAt: tokenData.expiresAt
            });

            const savedMode = localStorage.getItem(modeKey);
            setIsGameMode(savedMode === 'true');
            setHasLoadedFromStorage(true);
            return;
          } else {
            // Token expired
            localStorage.removeItem(teeTokenKey);
          }
        } catch (err) {
          console.error('Failed to parse TEE token:', err);
          localStorage.removeItem(teeTokenKey);
        }
      }

      setGameWallet(null);
      setIsGameMode(false);
      setHasLoadedFromStorage(true);
    };

    loadWallet();
  }, [teeTokenKey, walletAddress]);

  // ====== AUTO-EXPIRE CHECK ======
  useEffect(() => {
    if (!gameWallet?.expiresAt) return;

    const checkExpiry = () => {
      if (Date.now() > gameWallet.expiresAt) {
        console.log('Game wallet session expired');
        if (teeTokenKey) localStorage.removeItem(teeTokenKey);
        setGameWallet(null);
        setTeeToken(null);
        setIsGameMode(false);
        setBalance('0');
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 30000);
    return () => clearInterval(interval);
  }, [gameWallet?.expiresAt, teeTokenKey]);

  // ====== NONCE MANAGEMENT ======
  useEffect(() => {
    nonceRef.current = null;
    sendQueueRef.current = Promise.resolve();
  }, [gameWallet?.address]);

  const initNonce = useCallback(async () => {
    if (!gameWallet?.address) return null;

    try {
      const nonce = await publicClient.getTransactionCount({
        address: gameWallet.address,
        blockTag: 'pending'
      });
      const nextNonce = nonceRef.current === null ? nonce : Math.max(nonceRef.current, nonce);
      nonceRef.current = nextNonce;
      return nextNonce;
    } catch (err) {
      console.error('Failed to fetch nonce:', err);
      return null;
    }
  }, [gameWallet?.address, publicClient]);

  const reserveNonce = useCallback(async (minimumNonce = 0) => {
    while (nonceLockRef.current) {
      await new Promise(r => setTimeout(r, 10));
    }
    nonceLockRef.current = true;

    try {
      let pendingNonce = null;
      try {
        pendingNonce = await publicClient.getTransactionCount({
          address: gameWallet.address,
          blockTag: 'pending'
        });
      } catch (err) {
        if (nonceRef.current === null) {
          throw err;
        }
        console.warn('Failed to refresh pending nonce, using cached nonce:', err);
      }

      const nonce = Math.max(
        nonceRef.current ?? pendingNonce ?? 0,
        pendingNonce ?? 0,
        minimumNonce
      );
      nonceRef.current = nonce + 1;
      return nonce;
    } finally {
      nonceLockRef.current = false;
    }
  }, [gameWallet?.address, publicClient]);

  const rollbackNonce = useCallback((nonce) => {
    if (nonceRef.current === nonce + 1) {
      nonceRef.current = nonce;
    }
  }, []);

  const markLoadingStart = useCallback(() => {
    loadingCountRef.current += 1;
    setIsLoading(true);
  }, []);

  const markLoadingEnd = useCallback(() => {
    loadingCountRef.current = Math.max(0, loadingCountRef.current - 1);
    setIsLoading(loadingCountRef.current > 0);
  }, []);

  // ====== BALANCE FETCHING ======
  useEffect(() => {
    if (!gameWallet?.address) {
      setBalance('0');
      return;
    }

    const fetchBalance = async () => {
      try {
        const bal = await publicClient.getBalance({
          address: gameWallet.address
        });
        setBalance(formatEther(bal));
      } catch (err) {
        console.error('Failed to fetch balance:', err);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [gameWallet?.address, publicClient]);

  // ====== SAVE MODE PREFERENCE ======
  useEffect(() => {
    if (!walletAddress || !hasLoadedFromStorage) return;
    const modeKey = `${MODE_STORAGE_KEY}_${walletAddress.toLowerCase()}`;
    localStorage.setItem(modeKey, isGameMode.toString());
  }, [isGameMode, walletAddress, hasLoadedFromStorage]);

  // ====== TEE ACTIVATION ======
  const activateGameWallet = useCallback(async () => {
    if (!isConnected || !walletAddress) {
      setError('Wallet not connected');
      return null;
    }

    if (!teeAvailable) {
      setError('TEE service not available');
      return null;
    }

    setIsActivating(true);
    setError(null);

    try {
      // 1. Get challenge from TEE
      const challengeData = await teeWalletApi.getChallenge(walletAddress);
      const message = challengeData.message;
      const challenge = challengeData.challenge;

      // 2. User'dan imza al
      const signature = await signMessage(message);

      // 3. TEE'ye E2E encrypted login
      const result = await teeWalletApi.login(walletAddress, signature, message, challenge);


      const expiresAt = Date.now() + (result.expiresIn * 1000);
      const tokenData = {
        token: result.token,
        gameWalletAddress: result.gameWalletAddress,
        expiresAt
      };

      localStorage.setItem(teeTokenKey, JSON.stringify(tokenData));


      setTeeToken(result.token);
      setGameWallet({
        address: result.gameWalletAddress,
        expiresAt
      });
      setIsGameMode(true);

      return { address: result.gameWalletAddress };
    } catch (err) {
      console.error('Failed to activate game wallet:', err);
      setError(err.message || 'Failed to activate');
      return null;
    } finally {
      setIsActivating(false);
    }
  }, [isConnected, walletAddress, signMessage, teeTokenKey, teeAvailable]);

  // ====== TOGGLE GAME MODE ======
  const toggleGameMode = useCallback(async () => {
    if (isGameMode) {
      setIsGameMode(false);
      return true;
    } else if (gameWallet) {
      setIsGameMode(true);
      return true;
    } else {
      const wallet = await activateGameWallet();
      return !!wallet;
    }
  }, [isGameMode, gameWallet, activateGameWallet]);

  // ====== CLEAR GAME WALLET ======
  const clearGameWallet = useCallback(async () => {
    if (walletAddress) {
      await teeWalletApi.logout(walletAddress);
    }

    if (teeTokenKey) localStorage.removeItem(teeTokenKey);
    if (walletAddress) {
      const modeKey = `${MODE_STORAGE_KEY}_${walletAddress.toLowerCase()}`;
      localStorage.removeItem(modeKey);
    }

    setGameWallet(null);
    setTeeToken(null);
    setIsGameMode(false);
    setBalance('0');
  }, [teeTokenKey, walletAddress]);

  // ====== SEND TRANSACTION ======
  const sendTransaction = useCallback(async ({ to, value, data, gasLimit: customGasLimit, waitForReceipt = true }) => {
    if (!teeToken || !gameWallet?.address) {
      throw new Error('Game wallet not active');
    }

    markLoadingStart();

    const queuedSend = sendQueueRef.current.then(async () => {
      let minimumNonce = 0;
      let lastError = null;

      for (let attempt = 0; attempt < MAX_NONCE_RETRIES; attempt += 1) {
        let nonce = null;
        let signedTx = null;

        try {
          nonce = await reserveNonce(minimumNonce);

          // Use cached gas fees if fresh (< 30s), otherwise fetch
          const now = Date.now();
          let maxFeePerGas, maxPriorityFeePerGas;
          if (gasCacheRef.current.data && (now - gasCacheRef.current.ts) < GAS_CACHE_TTL) {
            maxFeePerGas = gasCacheRef.current.data.maxFeePerGas;
            maxPriorityFeePerGas = gasCacheRef.current.data.maxPriorityFeePerGas;
          } else {
            const feeData = await publicClient.estimateFeesPerGas();
            maxFeePerGas = feeData.maxFeePerGas?.toString() || '52000000000';
            maxPriorityFeePerGas = feeData.maxPriorityFeePerGas?.toString() || '52000000000';
            gasCacheRef.current = { data: { maxFeePerGas, maxPriorityFeePerGas }, ts: now };
          }

          // Gas limit: custom > default 1M (game contracts need ~500K-800K)
          const gasLimit = customGasLimit || '1000000';

          const tx = {
            to,
            value: value ? (typeof value === 'bigint' ? value.toString() : value.toString()) : '0',
            data: data || '0x',
            nonce,
            chainId: monadMainnet.id,
            gasLimit,
            maxFeePerGas,
            maxPriorityFeePerGas
          };

          signedTx = await teeWalletApi.signTransaction(teeToken, tx);

          const hash = await publicClient.sendRawTransaction({
            serializedTransaction: signedTx
          });

          return { hash, receipt: null };
        } catch (err) {
          lastError = err;
          const errMsg = err.message || '';

          if (signedTx && isAlreadyKnownError(err)) {
            return { hash: keccak256(signedTx), receipt: null };
          }

          if (nonce !== null && isNonceConflictError(err) && attempt < MAX_NONCE_RETRIES - 1) {
            console.log(`Nonce conflict at ${nonce}, retrying with the next nonce...`);
            minimumNonce = nonce + 1;
            const syncedNonce = await initNonce();
            if (syncedNonce !== null) {
              minimumNonce = Math.max(minimumNonce, syncedNonce);
            }
            nonceRef.current = Math.max(nonceRef.current ?? 0, minimumNonce);
            continue;
          }

          if (nonce !== null && !isNonceConflictError(err)) {
            rollbackNonce(nonce);
          }

          if (errMsg === 'SESSION_EXPIRED') {
            console.log('TEE session expired, clearing...');
            if (teeTokenKey) localStorage.removeItem(teeTokenKey);
            setTeeToken(null);
            setGameWallet(null);
            setIsGameMode(false);
            throw new Error('Session expired - please re-activate game wallet');
          }

          if (errMsg === 'CONTRACT_NOT_WHITELISTED') {
            throw new Error('This contract is not whitelisted for game transactions');
          }

          console.error('Transaction failed:', err);
          throw err;
        }
      }

      console.error('Transaction failed after nonce retries:', lastError);
      throw lastError;
    });

    sendQueueRef.current = queuedSend.catch(() => {});

    try {
      const { hash } = await queuedSend;

      if (!waitForReceipt) {
        return { hash, receipt: null };
      }

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return { hash, receipt };
    } finally {
      markLoadingEnd();
    }
  }, [
    teeToken,
    teeTokenKey,
    gameWallet?.address,
    publicClient,
    reserveNonce,
    rollbackNonce,
    initNonce,
    markLoadingStart,
    markLoadingEnd
  ]);

  // ====== SIGN MESSAGE (for session tokens etc.) ======
  const signWithGameWallet = useCallback(async (message) => {
    if (!teeToken) {
      throw new Error('Game wallet not active');
    }

    try {
      const signature = await teeWalletApi.signMessage(teeToken, message);
      return signature;
    } catch (err) {
      if (err.message === 'SESSION_EXPIRED') {
        if (teeTokenKey) localStorage.removeItem(teeTokenKey);
        setTeeToken(null);
        setGameWallet(null);
        setIsGameMode(false);
        throw new Error('Session expired - please re-activate game wallet');
      }
      throw err;
    }
  }, [teeToken, teeTokenKey]);

  // ====== REFRESH BALANCE ======
  const refreshBalance = useCallback(async () => {
    if (!gameWallet?.address) return;

    try {
      const bal = await publicClient.getBalance({
        address: gameWallet.address
      });
      setBalance(formatEther(bal));
    } catch (err) {
      console.error('Failed to refresh balance:', err);
    }
  }, [gameWallet?.address, publicClient]);

  // ====== REMAINING TIME ======
  const getRemainingTime = () => {
    if (!gameWallet?.expiresAt) return null;
    const remaining = gameWallet.expiresAt - Date.now();
    if (remaining <= 0) return null;
    const minutes = Math.floor(remaining / 60000);
    return minutes;
  };

  // ====== BALANCE CHECKS ======
  const GAS_RESERVE = 0.5;

  const canAfford = useCallback((amountInMon) => {
    if (!gameWallet || !balance) return false;
    const currentBalance = parseFloat(balance);
    const needed = parseFloat(amountInMon) + GAS_RESERVE;
    return currentBalance >= needed;
  }, [balance, gameWallet]);

  const getShortage = useCallback((amountInMon) => {
    if (!balance) return amountInMon + GAS_RESERVE;
    const currentBalance = parseFloat(balance);
    const needed = parseFloat(amountInMon) + GAS_RESERVE;
    return Math.max(0, needed - currentBalance);
  }, [balance]);

  // ====== CONTEXT VALUE ======
  const value = {
    // State
    gameWallet,
    address: gameWallet?.address || null,
    balance,
    isGameMode,
    isLoading,
    isActivating,
    error,

    // TEE state
    teeAvailable,
    teeToken,

    // Derived
    hasGameWallet: !!gameWallet,
    displayAddress: gameWallet?.address
      ? `${gameWallet.address.slice(0, 6)}...${gameWallet.address.slice(-4)}`
      : null,
    formattedBalance: parseFloat(balance).toFixed(2),
    remainingMinutes: getRemainingTime(),
    expiresAt: gameWallet?.expiresAt || null,

    // Active wallet info
    activeWallet: isGameMode && gameWallet ? gameWallet.address : walletAddress,
    isUsingGameWallet: isGameMode && !!gameWallet,

    // Actions
    activateGameWallet,
    toggleGameMode,
    clearGameWallet,
    sendTransaction,
    signWithGameWallet,
    refreshBalance,

    // Balance checks
    canAfford,
    getShortage,
    GAS_RESERVE
  };

  return (
    <GameWalletContext.Provider value={value}>
      {children}
    </GameWalletContext.Provider>
  );
};

export const useGameWallet = () => {
  const context = useContext(GameWalletContext);
  if (!context) {
    throw new Error('useGameWallet must be used within GameWalletProvider');
  }
  return context;
};

export default GameWalletContext;
