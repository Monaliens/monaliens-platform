import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useGameWallet } from '../../context';
import {
  reportClientError,
  normalizeUnhandledRejection,
  shouldIgnoreClientError,
} from '../../services/clientErrorTelemetry';

const isChunkLoadError = (message = '', stack = '') => {
  const m = String(message || '').toLowerCase();
  const s = String(stack || '').toLowerCase();
  return m.includes('loading chunk') || s.includes('chunkloaderror');
};

const CHUNK_RELOAD_KEY = 'chunk_reload_ts';
const CHUNK_RELOAD_COOLDOWN = 30_000;

const getDiscordId = () => {
  try {
    const raw = localStorage.getItem('discord_auth');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return parsed?.discordUser?.id || parsed?.id || '';
  } catch {
    return '';
  }
};

const ClientErrorReporter = () => {
  const location = useLocation();
  const { address } = useAccount();
  const { address: gameWalletAddress, hasGameWallet } = useGameWallet();

  useEffect(() => {
    const route = location.pathname;

    const onError = (event) => {
      const msg = event?.message || event?.error?.message || 'Window error';
      const stk = event?.error?.stack || '';
      const filename = event?.filename || '';

      if (shouldIgnoreClientError(msg, stk, filename)) return;

      if (isChunkLoadError(msg, stk)) {
        const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
        if (Date.now() - lastReload > CHUNK_RELOAD_COOLDOWN) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
          window.location.reload();
        }
        return;
      }

      reportClientError({
        message: msg,
        stack: stk,
        route,
        wallet: address || '',
        discordId: getDiscordId(),
        metadata: {
          gameWallet: hasGameWallet ? gameWalletAddress : '',
          filename: event?.filename,
          lineno: event?.lineno,
          colno: event?.colno,
        },
      });
    };

    const onUnhandledRejection = (event) => {
      const normalized = normalizeUnhandledRejection(event?.reason);

      if (shouldIgnoreClientError(normalized.message, normalized.stack)) return;

      if (isChunkLoadError(normalized.message, normalized.stack)) {
        const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
        if (Date.now() - lastReload > CHUNK_RELOAD_COOLDOWN) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
          window.location.reload();
        }
        return;
      }

      reportClientError({
        message: normalized.message,
        stack: normalized.stack,
        route,
        wallet: address || '',
        discordId: getDiscordId(),
        metadata: {
          gameWallet: hasGameWallet ? gameWalletAddress : '',
          reasonType: typeof event?.reason,
        },
      });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [location.pathname, address, hasGameWallet, gameWalletAddress]);

  return null;
};

export default ClientErrorReporter;
