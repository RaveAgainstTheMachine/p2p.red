interface EnvironmentConfig {
  apiUrl: string;
  peerJsConfig: {
    host: string;
    port: number;
    path: string;
    secure?: boolean;
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
      secure: false
    },
    logging: 'debug',
    monitoring: false,
    analytics: false,
    maxFileSize: 100 * 1024 * 1024, // 100MB
    chunkSize: 64 * 1024, // 64KB
    connectionTimeout: 30000 // 30 seconds
  },
  production: {
    apiUrl: 'https://p2p.red',
    peerJsConfig: {
      host: 'p2p.red',
      port: 443,
      path: '/peerjs',
      secure: true
    },
    logging: 'error',
    monitoring: true,
    analytics: true,
    maxFileSize: 1024 * 1024 * 1024, // 1GB
    chunkSize: 256 * 1024, // 256KB
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
