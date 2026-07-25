import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE } from '../api/client';
import { LiveAlert } from '../types';

// MVP is single-organization; the room to join is configurable.
const ORG_ID = process.env.REACT_APP_ORG_ID || 'org_001';

/**
 * Connects to the backend Socket.IO server, joins the organization room, and
 * accumulates live alerts as the AI pushes them.
 */
export function useLiveAlerts(enabled: boolean) {
  const [connected, setConnected] = useState(false);
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const socket = io(API_BASE, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_org', { organization_id: ORG_ID });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('alert', (data: LiveAlert & { status?: string }) => {
      // The join ack reuses the 'alert' event with status 'success' — ignore it.
      if ((data as { status?: string }).status === 'success') return;
      if (!data || !data.explanation) return;
      // Re-running analysis re-emits the same event_id — replace, don't duplicate.
      setAlerts((prev) => [data, ...prev.filter((a) => a.event_id !== data.event_id)].slice(0, 50));
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [enabled]);

  return { connected, alerts, clear: () => setAlerts([]) };
}
