import { useState, useCallback, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';

export const useWebRTC = () => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [peerId, setPeerId] = useState<string>('');
  const [connections, setConnections] = useState<Map<string, DataConnection>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connected' | 'disconnected' | 'reconnecting' | 'failed'>('disconnected');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const peerRef = useRef<Peer | null>(null);

  const initializePeer = useCallback(() => {
    // Generate TURN credentials (time-limited HMAC-SHA1)
    const turnSecret = 'p2p-secret-key-123456789';
    const turnTTL = 86400; // 24 hours
    const turnTimestamp = Math.floor(Date.now() / 1000) + turnTTL;
    const turnUsername = `${turnTimestamp}:p2puser`;
    
    // Generate HMAC-SHA1 credential for TURN authentication
    const generateTurnCredential = async (username: string, secret: string): Promise<string> => {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(username));
      return btoa(String.fromCharCode(...new Uint8Array(signature)));
    };

    // Initialize peer with credentials
    const initWithCredentials = async () => {
      const turnCredential = await generateTurnCredential(turnUsername, turnSecret);
      const newPeer = new Peer({
        host: 'p2p.red',
        port: 443,
        path: '/peerjs',
        secure: true,
        config: {
          iceServers: [
            // Public STUN servers for NAT discovery
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            // Self-hosted TURN server with time-limited credentials
            { 
              urls: 'turn:p2p.red:3478',
              username: turnUsername,
              credential: turnCredential
            },
            {
              urls: 'turn:p2p.red:3478?transport=tcp',
              username: turnUsername,
              credential: turnCredential
            }
          ],
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
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    };

    initWithCredentials();
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
      reliable: true,
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
      console.log('ICE connection state:', conn.peerConnection?.iceConnectionState);
    });
    
    conn.peerConnection?.addEventListener('icegatheringstatechange', () => {
      console.log('ICE gathering state:', conn.peerConnection?.iceGatheringState);
    });
    
    conn.peerConnection?.addEventListener('connectionstatechange', () => {
      console.log('Connection state:', conn.peerConnection?.connectionState);
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
