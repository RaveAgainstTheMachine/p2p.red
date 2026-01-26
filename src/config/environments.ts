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
    apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:5173',
    peerJsConfig: {
      host: import.meta.env.VITE_PEERJS_HOST ?? 'localhost',
      port: Number(import.meta.env.VITE_PEERJS_PORT ?? 9000),
      path: '/',
      secure: String(import.meta.env.VITE_PEERJS_SECURE ?? 'false') === 'true',
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
      host: 'signal.p2p.red',
      port: 443,
      path: '/',
      secure: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
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
