/**
 * Client-side WebSocket helper.
 * Usage in a component:
 *
 *   import { useRealtime } from '@/lib/realtime';
 *   const { connected } = useRealtime({
 *     onNotification: (n) => toast(n.title),
 *     onLowStock:     (p) => setAlerts(a => [...a, p]),
 *   });
 */
import { useEffect, useRef, useState } from 'react';
import Cookies from 'js-cookie';

const getWsUrl = () => {
  const apiBase = typeof window !== 'undefined'
    ? ((window as any).electronAPI?.isDesktop 
        ? 'http://localhost:4000/api/v1' 
        : (process.env.NEXT_PUBLIC_API_URL || `${window.location.origin}/api/v1`))
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1');
  return apiBase.replace('/api/v1', '').replace('http', 'ws');
};
const WS_URL = getWsUrl();

interface RealtimeHandlers {
  onNotification?: (data: any) => void;
  onLowStock?:     (data: any) => void;
  onNewOrder?:     (data: any) => void;
  onStockUpdated?: (data: any) => void;
}

export function useRealtime(handlers: RealtimeHandlers = {}) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers; // always use latest handlers without re-subscribing

  useEffect(() => {
    const token = Cookies.get('accessToken');
    if (!token) return;

    // Socket.IO uses polling then upgrades to WS — use raw WS for simplicity
    // For full Socket.IO support, install socket.io-client and replace below.
    const ws = new WebSocket(`${WS_URL}/realtime?token=${token}`);
    wsRef.current = ws;

    ws.onopen  = () => { setConnected(true); ws.send(JSON.stringify({ event: 'ping', data: {} })); };
    ws.onclose = () => setConnected(false);

    ws.onmessage = (e) => {
      try {
        const { event, data } = JSON.parse(e.data);
        const h = handlersRef.current;
        if (event === 'notification'   && h.onNotification) h.onNotification(data);
        if (event === 'low_stock'      && h.onLowStock)     h.onLowStock(data);
        if (event === 'new_order'      && h.onNewOrder)     h.onNewOrder(data);
        if (event === 'stock_updated'  && h.onStockUpdated) h.onStockUpdated(data);
      } catch {}
    };

    return () => { ws.close(); };
  }, []); // connect once on mount

  return { connected };
}
