interface EnvironmentConfig {
  apiUrl: string;
  peerJsConfig: {
    host: string;
    port: number;
    path: string;
    secure: boolean;
    config?: {
      iceServers: any[];
      sdpSemantics: string;
    };
  };
  logging: 'debug' | 'info' | 'warn' | 'error';
  monitoring: boolean;
  analytics: boolean;
  maxFileSize: number; // bytes
  chunkSize: number; // bytes
  connectionTimeout: number; // milliseconds
}

export const environments: Record<string, EnvironmentConfig> = {
  development: {
    apiUrl: 'http://localhost:5173',
    peerJsConfig: {
      host: 'localhost',
      port: 9000,
      path: '/peerjs',
      secure: false,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        sdpSemantics: 'unified-plan'
      }
    },
    logging: 'debug',
    monitoring: false,
    analytics: false,
    maxFileSize: 100 * 1024 * 1024, // 100MB
    chunkSize: 16 * 1024 * 1024, // 16MB
    connectionTimeout: 30000 // 30 seconds
  },
  production: {
    apiUrl: 'https://p2p.red',
    peerJsConfig: {
      host: 'p2p.red',
      port: 443,
      path: '/peerjs',
      secure: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { 
            urls: 'turn:p2p.red:3478',
            username: 'p2puser',
            credential: 'p2ppass123'
          }
        ],
        sdpSemantics: 'unified-plan'
      }
    },
    logging: 'error',
    monitoring: true,
    analytics: true,
    maxFileSize: 1024 * 1024 * 1024, // 1GB
    chunkSize: 16 * 1024 * 1024, // 16MB
    connectionTimeout: 60000 // 60 seconds
  }
};

export const config = environments[import.meta.env.MODE || 'development'];

// Export individual config values for convenience
export const {
  apiUrl,
  peerJsConfig,
  logging,
  monitoring,
  analytics,
  maxFileSize,
  chunkSize,
  connectionTimeout
} = config;
