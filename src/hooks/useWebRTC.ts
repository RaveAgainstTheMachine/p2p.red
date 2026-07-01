import { debugLog, debugWarn, debugError } from '../utils/logger';
import { useState, useCallback, useRef, useEffect } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { peerJsConfig } from '../config/environments';
import { sendTelemetry } from '../services/telemetry';

import { apiUrl, siteDomain } from '../config/environments';

// If VITE_TURN_HOSTS is defined (comma-separated), use it, otherwise fall back to siteDomain
const rawTurnHosts = import.meta.env.VITE_TURN_HOSTS;
const TURN_HOSTS = rawTurnHosts 
  ? rawTurnHosts.split(',').map((h: string) => h.trim())
  : [siteDomain];
const TURN_TCP_PORT = Number(import.meta.env.VITE_TURN_PORT || 3478);
const TURN_TLS_PORT = Number(import.meta.env.VITE_TURN_TLS_PORT || 5349);
const TURN_REALM = import.meta.env.VITE_TURN_REALM || siteDomain;

const shuffleArray = <T,>(items: T[]): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const getApiBaseUrl = (): string => {
  return apiUrl;
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

  const handleConnection = useCallback((conn: DataConnection) => {
    conn.on('open', () => {
      debugLog('Connection opened with:', conn.peer);
      setConnections(prev => new Map(prev.set(conn.peer, conn)));
    });

    conn.on('close', () => {
      debugLog('Connection closed with:', conn.peer);
      setConnections(prev => {
        const newMap = new Map(prev);
        newMap.delete(conn.peer);
        return newMap;
      });
    });

    conn.on('error', (err) => {
      debugError('Connection error:', err);
    });
  }, []);

  useEffect(() => {
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
        debugWarn('⚠️ TURN credentials unavailable, using STUN only.', error);
      }

      if (peerRef.current) return; // Already initialized

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
        debugLog('✅ Peer connected with ID:', id);
        setPeerId(id);
        setPeer(newPeer);
        peerRef.current = newPeer;
        setIsConnected(true);
        setConnectionState('connected');
      });

      newPeer.on('connection', (conn) => {
        debugLog('📞 Incoming connection from:', conn.peer);
        handleConnection(conn);
      });

      newPeer.on('disconnected', () => {
        debugWarn('⚠️ Peer disconnected from signaling server');
        setIsConnected(false);
        setConnectionState('disconnected');

        void sendTelemetry({
          eventType: 'peer_disconnected',
          role: 'client',
          stage: 'signal',
          connectionType: 'signaling'
        });
        
        // Attempt reconnection
        debugLog('🔄 Attempting to reconnect...');
        setConnectionState('reconnecting');
        setTimeout(() => {
          if (newPeer && !newPeer.destroyed) {
            newPeer.reconnect();
          }
        }, 1000);
      });

      newPeer.on('error', (err) => {
        debugError('❌ Peer error:', err.type, err.message);
        void sendTelemetry({
          eventType: 'peer_error',
          role: 'client',
          stage: 'signal',
          errorCode: err.type,
          errorMessage: err.message
        });
        if (err.type === 'network' || err.type === 'server-error') {
          setIsConnected(false);
          setConnectionState('failed');
        } else if (err.type === 'peer-unavailable') {
          debugWarn('⚠️ Remote peer unavailable');
          setConnectionState('failed');
        } else if (err.type === 'disconnected') {
          setConnectionState('disconnected');
        }
      });

      // Monitor network connectivity
      const handleOnline = () => {
        debugLog('🌐 Network connection restored');
        setIsOnline(true);
        if (newPeer && !newPeer.destroyed && !newPeer.disconnected) {
          setConnectionState('reconnecting');
          newPeer.reconnect();
        }
      };

      const handleOffline = () => {
        debugWarn('📡 Network connection lost');
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
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
    };
  }, [handleConnection]);

  const connectToPeer = useCallback((remotePeerId: string) => {
    if (!peerRef.current) {
      debugError('Peer not initialized');
      return null;
    }

    debugLog('Attempting to connect to peer:', remotePeerId);
    debugLog('My peer ref:', peerRef.current.id);
    
    const conn = peerRef.current.connect(remotePeerId, {
      reliable: true,
      serialization: 'binary',
      metadata: { timestamp: Date.now() }
    });

    debugLog('Connection object created:', conn);
    
    conn.on('open', () => {
      debugLog('DataChannel OPEN with:', remotePeerId);
    });
    
    conn.on('error', (err) => {
      debugError('DataChannel ERROR:', err);
    });
    
    conn.on('close', () => {
      debugLog('DataChannel CLOSED with:', remotePeerId);
    });
    
    // Log ICE connection state changes
    conn.peerConnection?.addEventListener('iceconnectionstatechange', () => {
      const state = conn.peerConnection?.iceConnectionState;
      debugLog('🧊 ICE connection state:', state);
      if (state === 'failed' || state === 'disconnected') {
        debugError('❌ ICE connection failed - TURN server may not be working');
      }
    });
    
    conn.peerConnection?.addEventListener('icegatheringstatechange', () => {
      debugLog('🧊 ICE gathering state:', conn.peerConnection?.iceGatheringState);
    });
    
    conn.peerConnection?.addEventListener('connectionstatechange', () => {
      debugLog('🔌 Connection state:', conn.peerConnection?.connectionState);
    });
    
    // Log ICE candidates
    conn.peerConnection?.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        const candidate = event.candidate;
        debugLog('🧊 ICE candidate:', {
          type: candidate.type,
          protocol: candidate.protocol,
          address: candidate.address,
          port: candidate.port,
          relatedAddress: candidate.relatedAddress,
          relatedPort: candidate.relatedPort
        });
      } else {
        debugLog('🧊 ICE gathering complete');
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
    connectToPeer,
    disconnect
  };
};
