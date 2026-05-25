import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:3001' : '');

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const s = io(SOCKET_URL, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setSocket(s);

    s.on('connect', () => {
      console.log('[WS] Connected to SOC real-time engine');
      setIsConnected(true);
    });

    s.on('disconnect', () => {
      console.log('[WS] Disconnected from SOC real-time engine');
      setIsConnected(false);
    });

    s.on('connect_error', () => {
      setIsConnected(false);
    });

    return () => {
      s.disconnect();
    };
  }, []);

  return { socket, isConnected };
};
