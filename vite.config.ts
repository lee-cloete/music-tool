import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],

  build: {
    target: 'esnext',
    // Keep chunks manageable for Vercel's edge CDN
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Isolate Tone.js (large) into its own chunk for better caching
          'tone': ['tone'],
        },
      },
    },
  },

  optimizeDeps: {
    // Pre-bundle Tone.js in development for faster HMR
    include: ['tone'],
  },
})
