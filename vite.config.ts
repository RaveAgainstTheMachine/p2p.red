import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { join } from 'path'

const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'))

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_BUILD_VERSION': JSON.stringify(pkg.version),
  },
  plugins: [react()],
  build: {
    // Cache busting with timestamp
    rollupOptions: {
      output: {
        entryFileNames: (chunkInfo) => {
          return `assets/${chunkInfo.name}-${Date.now()}.js`;
        },
        chunkFileNames: (chunkInfo) => {
          const safeName = (chunkInfo.name || 'chunk').replace(/[^a-zA-Z0-9_-]/g, '_');
          return `assets/${safeName}-${Date.now()}.js`;
        },
        assetFileNames: (assetInfo) => {
          const ext = assetInfo.name.split('.').pop() || 'bin';
          return `assets/${assetInfo.name}-${Date.now()}.${ext}`;
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3002,
    allowedHosts: true,
    proxy: {
      '/api/metadata': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('X-Real-Ip', '127.0.0.1');
            proxyReq.setHeader('X-Forwarded-For', '127.0.0.1');
            proxyReq.setHeader('X-Forwarded-Proto', 'http');
            proxyReq.setHeader('X-Forwarded-Host', '127.0.0.1:3000');
          });
          proxy.on('proxyRes', (proxyRes) => {
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['content-security-policy-report-only'];
            proxyRes.headers['content-security-policy'] =
              "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://127.0.0.1:3000";
          });
        }
      },
      '/api/metadata/': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('X-Real-Ip', '127.0.0.1');
            proxyReq.setHeader('X-Forwarded-For', '127.0.0.1');
            proxyReq.setHeader('X-Forwarded-Proto', 'http');
            proxyReq.setHeader('X-Forwarded-Host', '127.0.0.1:3000');
          });
          proxy.on('proxyRes', (proxyRes) => {
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['content-security-policy-report-only'];
            proxyRes.headers['content-security-policy'] =
              "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://127.0.0.1:3000";
          });
        }
      },
      '/.within.website': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('X-Real-Ip', '127.0.0.1');
            proxyReq.setHeader('X-Forwarded-For', '127.0.0.1');
            proxyReq.setHeader('X-Forwarded-Proto', 'http');
            proxyReq.setHeader('X-Forwarded-Host', '127.0.0.1:3000');
          });
          proxy.on('proxyRes', (proxyRes) => {
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['content-security-policy-report-only'];
            proxyRes.headers['content-security-policy'] =
              "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://127.0.0.1:3000";
            if (typeof proxyRes.headers.location === 'string') {
              proxyRes.headers.location = proxyRes.headers.location.replace(
                /\/api\/metadata(\b|\?)/,
                '/'
              );
            }
          });
        }
      },
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true
      },
      '/peerjs': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
        ws: true
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true
  }
})
