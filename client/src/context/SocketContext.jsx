import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { socketUrl } from '../api';
import { useAuth } from './AuthContext';

const SocketCtx = createContext({ socket: null, live: false, metric: null, fraud: null });
export const useSocket = () => useContext(SocketCtx);

export function SocketProvider({ children }) {
  const { user, getToken } = useAuth();
  const [socket, setSocket] = useState(null);
  const [live, setLive] = useState(false);
  const [metric, setMetric] = useState(null);
  const [fraud, setFraud] = useState(null);

  useEffect(() => {
    if (!user) {
      setSocket(null);
      setLive(false);
      return undefined;
    }
    const s = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: (callback) => getToken().then((token) => callback({ token })).catch(() => callback({ token: '' }))
    });
    s.on('connect', () => setLive(true));
    s.on('disconnect', () => setLive(false));
    s.on('metric', (payload) => setMetric({ ...payload, at: Date.now() }));
    s.on('fraud_alert', (payload) => setFraud({ ...payload, at: Date.now() }));
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
      setLive(false);
    };
  }, [user?._id, getToken]);

  return <SocketCtx.Provider value={{ socket, live, metric, fraud }}>{children}</SocketCtx.Provider>;
}
