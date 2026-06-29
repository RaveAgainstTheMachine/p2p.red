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
    host: '<ip>',
    port: 3002,
    allowedHosts: true,
    proxy: {
      '/api/metadata': {
        target: 'http://<ip>:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('X-Real-Ip', '<ip>');
            proxyReq.setHeader('X-Forwarded-For', '<ip>');
            proxyReq.setHeader('X-Forwarded-Proto', 'http');
            proxyReq.setHeader('X-Forwarded-Host', '<ip>:3000');
          });
          proxy.on('proxyRes', (proxyRes) => {
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['content-security-policy-report-only'];
            proxyRes.headers['content-security-policy'] =
              "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://<ip>:3000";
          });
        }
      },
      '/api/metadata/': {
        target: 'http://<ip>:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('X-Real-Ip', '<ip>');
            proxyReq.setHeader('X-Forwarded-For', '<ip>');
            proxyReq.setHeader('X-Forwarded-Proto', 'http');
            proxyReq.setHeader('X-Forwarded-Host', '<ip>:3000');
          });
          proxy.on('proxyRes', (proxyRes) => {
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['content-security-policy-report-only'];
            proxyRes.headers['content-security-policy'] =
              "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://<ip>:3000";
          });
        }
      },
      '/.within.website': {
        target: 'http://<ip>:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('X-Real-Ip', '<ip>');
            proxyReq.setHeader('X-Forwarded-For', '<ip>');
            proxyReq.setHeader('X-Forwarded-Proto', 'http');
            proxyReq.setHeader('X-Forwarded-Host', '<ip>:3000');
          });
          proxy.on('proxyRes', (proxyRes) => {
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['content-security-policy-report-only'];
            proxyRes.headers['content-security-policy'] =
              "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://<ip>:3000";
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
        target: 'http://<ip>:3001',
        changeOrigin: true
      },
      '/peerjs': {
        target: 'http://<ip>:9000',
        changeOrigin: true,
        ws: true
      }
    }
  },
  preview: {
    host: '<ip>',
    port: 3000,
    allowedHosts: true
  }
})
