import { useState, useCallback, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { peerJsConfig } from '../config/environments';

const TURN_HOSTS = ['turn1.p2p.red', 'turn2.p2p.red'];
const TURN_TCP_PORT = 3478;
const TURN_TLS_PORT = 5349;
const TURN_REALM = 'p2p.red';

const shuffleArray = <T,>(items: T[]): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const getApiBaseUrl = (): string => {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
  const metaUrl = metaEnv?.VITE_API_URL;
  if (metaUrl) {
    return metaUrl;
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://p2p.red';
};

const createTurnCredentials = async () => {
  const baseUrl = getApiBaseUrl().replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/api/turn-credentials`, {
    credentials: 'omit'
  });

  if (!response.ok) {
    throw new Error(`TURN credentials request failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data?.username || !data?.credential) {
    throw new Error('TURN credentials response missing username or credential');
  }

  return { username: data.username, credential: data.credential };
};

const buildIceServers = (username: string, credential: string) => {
  const turnHosts = shuffleArray(TURN_HOSTS);
  const turnServers = turnHosts.flatMap((host) => [
    { urls: `turn:${host}:${TURN_TCP_PORT}` },
    { urls: `turn:${host}:${TURN_TCP_PORT}?transport=tcp` },
    { urls: `turns:${host}:${TURN_TLS_PORT}` }
  ]);

  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    ...turnServers.map((server) => ({
      ...server,
      username,
      credential,
      realm: TURN_REALM
    }))
  ];
};

export const useWebRTC = () => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [peerId, setPeerId] = useState<string>('');
  const [connections, setConnections] = useState<Map<string, DataConnection>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connected' | 'disconnected' | 'reconnecting' | 'failed'>('disconnected');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const peerRef = useRef<Peer | null>(null);

  const initializePeer = useCallback(() => {
    let cleanup: (() => void) | undefined;

    const setupPeer = async () => {
      let iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ];

      try {
        const { username, credential } = await createTurnCredentials();
        iceServers = buildIceServers(username, credential);
      } catch (error) {
        console.warn('⚠️ TURN credentials unavailable, using STUN only.', error);
      }

      const newPeer = new Peer({
        host: peerJsConfig.host,
        port: peerJsConfig.port,
        path: peerJsConfig.path,
        secure: peerJsConfig.secure,
        config: {
          iceServers,
          iceCandidatePoolSize: 10,
          iceTransportPolicy: 'all',
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require'
        }
      });

      newPeer.on('open', (id) => {
        console.log('✅ Peer connected with ID:', id);
        setPeerId(id);
        setPeer(newPeer);
        peerRef.current = newPeer;
        setIsConnected(true);
        setConnectionState('connected');
      });

      newPeer.on('connection', (conn) => {
        console.log('📞 Incoming connection from:', conn.peer);
        handleConnection(conn);
      });

      newPeer.on('disconnected', () => {
        console.warn('⚠️ Peer disconnected from signaling server');
        setIsConnected(false);
        setConnectionState('disconnected');
        
        // Attempt reconnection
        console.log('🔄 Attempting to reconnect...');
        setConnectionState('reconnecting');
        setTimeout(() => {
          if (newPeer && !newPeer.destroyed) {
            newPeer.reconnect();
          }
        }, 1000);
      });

      newPeer.on('error', (err) => {
        console.error('❌ Peer error:', err.type, err.message);
        if (err.type === 'network' || err.type === 'server-error') {
          setIsConnected(false);
          setConnectionState('failed');
        } else if (err.type === 'peer-unavailable') {
          console.warn('⚠️ Remote peer unavailable');
          setConnectionState('failed');
        } else if (err.type === 'disconnected') {
          setConnectionState('disconnected');
        }
      });

      // Monitor network connectivity
      const handleOnline = () => {
        console.log('🌐 Network connection restored');
        setIsOnline(true);
        if (newPeer && !newPeer.destroyed && !newPeer.disconnected) {
          setConnectionState('reconnecting');
          newPeer.reconnect();
        }
      };

      const handleOffline = () => {
        console.warn('📡 Network connection lost');
        setIsOnline(false);
        setConnectionState('disconnected');
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Cleanup
      cleanup = () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    };

    void setupPeer();

    return () => {
      cleanup?.();
    };
  }, []);

  const handleConnection = useCallback((conn: DataConnection) => {
    conn.on('open', () => {
      console.log('Connection opened with:', conn.peer);
      setConnections(prev => new Map(prev.set(conn.peer, conn)));
    });

    conn.on('close', () => {
      console.log('Connection closed with:', conn.peer);
      setConnections(prev => {
        const newMap = new Map(prev);
        newMap.delete(conn.peer);
        return newMap;
      });
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
    });
  }, []);

  const connectToPeer = useCallback((remotePeerId: string) => {
    if (!peerRef.current) {
      console.error('Peer not initialized');
      return null;
    }

    console.log('Attempting to connect to peer:', remotePeerId);
    console.log('My peer ref:', peerRef.current.id);
    
    const conn = peerRef.current.connect(remotePeerId, {
      reliable: false,  // Unreliable for maximum speed (UDP-like)
      serialization: 'binary',
      metadata: { timestamp: Date.now() }
    });

    console.log('Connection object created:', conn);
    
    conn.on('open', () => {
      console.log('DataChannel OPEN with:', remotePeerId);
    });
    
    conn.on('error', (err) => {
      console.error('DataChannel ERROR:', err);
    });
    
    conn.on('close', () => {
      console.log('DataChannel CLOSED with:', remotePeerId);
    });
    
    // Log ICE connection state changes
    conn.peerConnection?.addEventListener('iceconnectionstatechange', () => {
      const state = conn.peerConnection?.iceConnectionState;
      console.log('🧊 ICE connection state:', state);
      if (state === 'failed' || state === 'disconnected') {
        console.error('❌ ICE connection failed - TURN server may not be working');
      }
    });
    
    conn.peerConnection?.addEventListener('icegatheringstatechange', () => {
      console.log('🧊 ICE gathering state:', conn.peerConnection?.iceGatheringState);
    });
    
    conn.peerConnection?.addEventListener('connectionstatechange', () => {
      console.log('🔌 Connection state:', conn.peerConnection?.connectionState);
    });
    
    // Log ICE candidates
    conn.peerConnection?.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        const candidate = event.candidate;
        console.log('🧊 ICE candidate:', {
          type: candidate.type,
          protocol: candidate.protocol,
          address: candidate.address,
          port: candidate.port,
          relatedAddress: candidate.relatedAddress,
          relatedPort: candidate.relatedPort
        });
      } else {
        console.log('🧊 ICE gathering complete');
      }
    });

    handleConnection(conn);
    return conn;
  }, []);

  const disconnect = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
      setPeer(null);
      setPeerId('');
      setConnections(new Map());
      setIsConnected(false);
    }
  }, []);

  return {
    peer,
    peerId,
    connections,
    isConnected,
    connectionState,
    isOnline,
    initializePeer,
    connectToPeer,
    disconnect
  };
};
