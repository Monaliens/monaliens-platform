import { useEffect, useRef, useCallback } from 'react';

const WS_URL = process.env.REACT_APP_HILO_WS_URL || 'wss://your-api-url/ws/hilo';

/**
 * Hook for WebSocket connection to HiLo backend
 * Subscribes to game updates and calls onFirstCardRevealed when backend reveals
 */
export const useHiLoWebSocket = (gameId, onFirstCardRevealed) => {
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        // Subscribe to game if we have a gameId
        if (gameId) {
          ws.send(JSON.stringify({ type: 'subscribe', gameId: gameId.toString() }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.event === 'firstCardRevealed' && data.gameId === gameId?.toString()) {
            if (onFirstCardRevealed) {
              onFirstCardRevealed(data.firstCard, data.txHash);
            }
          }
        } catch (err) {
          // Silent fail for parse errors
        }
      };

      ws.onclose = () => {
        // Reconnect after 2 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        // Silent fail for WS errors
      };

      wsRef.current = ws;
    } catch (err) {
      // Silent fail for connection errors
    }
  }, [gameId, onFirstCardRevealed]);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Subscribe to game when gameId changes
  useEffect(() => {
    if (gameId && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', gameId: gameId.toString() }));
    }
  }, [gameId]);

  return wsRef.current;
};
