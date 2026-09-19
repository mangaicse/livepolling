import { useEffect, useRef, useState, useCallback } from 'react';
import { API_BASE } from '../services/api';

export const useLivePoll = (pollId, onUpdate) => {
  const [connected, setConnected] = useState(false);
  const [viewerCount, setViewerCount] = useState(1);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const connect = useCallback(() => {
    if (!pollId) return;

    // Convert http/https API_BASE to ws/wss
    const wsBase = API_BASE.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/ws/polls/${pollId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'VIEWER_COUNT') {
            setViewerCount(data.viewer_count || 1);
          }
          if (onUpdateRef.current) {
            onUpdateRef.current(data);
          }
        } catch {
          // ignore non-json messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        // Attempt reconnect in 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // Fallback
      setConnected(false);
    }
  }, [pollId]);

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

  return { connected, viewerCount };
};
