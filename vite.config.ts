import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Cache busting with timestamp
    rollupOptions: {
      output: {
        entryFileNames: (chunkInfo) => {
          return `assets/${chunkInfo.name}-${Date.now()}.js`;
        },
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.replace(/\\/g, '_') : undefined;
          return `assets/${facadeModuleId || chunkInfo.name}-${Date.now()}.js`;
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
    port: 3000,
    allowedHosts: true
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true
  }
})
