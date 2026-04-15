import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Each vendor chunk is stable across deploys → long-lived cache headers work
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/\/(leaflet|react-leaflet)\//.test(id))  return 'vendor-leaflet';
            if (/\/recharts\//.test(id))                 return 'vendor-recharts';
            if (/\/(react|react-dom|react-router-dom)\//.test(id)) return 'vendor-react';
          }
        },
      },
    },
    // We intentionally code-split every page; individual chunks are small by design
    chunkSizeWarningLimit: 600,
  },
})
