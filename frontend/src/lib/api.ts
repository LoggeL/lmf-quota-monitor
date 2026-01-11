import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import type { WSMessage, Account } from '../types';

const API_BASE = '';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const { setAccounts, setConnected, setError } = useStore();

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    function connect() {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected');
        setConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          if (msg.accounts) {
            setAccounts(msg.accounts);
          }
          if (msg.error) {
            setError(msg.error);
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected, reconnecting...');
        setConnected(false);
        setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, [setAccounts, setConnected, setError]);
}

export async function refreshQuotas(): Promise<Account[]> {
  const response = await fetch(`${API_BASE}/api/accounts/refresh`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to refresh quotas');
  }
  return response.json();
}
