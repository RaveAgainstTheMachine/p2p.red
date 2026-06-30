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
  siteName: string;
  siteDomain: string;
}

export const environments: Record<string, EnvironmentConfig> = {
  development: {
    apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:5173',
    peerJsConfig: {
      host: import.meta.env.VITE_PEERJS_HOST ?? 'localhost',
      port: Number(import.meta.env.VITE_PEERJS_PORT ?? 3002),
      path: import.meta.env.VITE_PEERJS_PATH ?? '/',
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
    connectionTimeout: 30000, // 30 seconds
    siteName: import.meta.env.VITE_SITE_NAME ?? 'P2P File Share (Dev)',
    siteDomain: import.meta.env.VITE_SITE_DOMAIN ?? 'localhost'
  },
  production: {
    apiUrl: import.meta.env.VITE_API_URL ?? (typeof window !== 'undefined' ? window.location.origin : 'https://p2p.red'),
    peerJsConfig: {
      host: import.meta.env.VITE_PEERJS_HOST ?? (typeof window !== 'undefined' ? window.location.hostname : 'p2p.red'),
      port: Number(
        import.meta.env.VITE_PEERJS_PORT ??
          (typeof window !== 'undefined'
            ? window.location.port || (window.location.protocol === 'https:' ? 443 : 80)
            : 443)
      ),
      path: import.meta.env.VITE_PEERJS_PATH ?? '/',
      secure: String(
        import.meta.env.VITE_PEERJS_SECURE ??
          (typeof window !== 'undefined' ? window.location.protocol === 'https:' : 'true')
      ) === 'true',
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
    connectionTimeout: 60000, // 60 seconds
    siteName: import.meta.env.VITE_SITE_NAME ?? 'P2P File Share',
    siteDomain: import.meta.env.VITE_SITE_DOMAIN ?? (typeof window !== 'undefined' ? window.location.hostname : 'p2p.red')
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
  connectionTimeout,
  siteName,
  siteDomain
} = config;
