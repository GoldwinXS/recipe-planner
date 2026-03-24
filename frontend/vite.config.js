import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm'],
  },
  server: {
    host: '0.0.0.0',
    port: 5200,
    hmr: { host: 'localhost' },
    // Required for SharedArrayBuffer used by WebLLM
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/api': {
        target: 'http://backend:8001',
        changeOrigin: true,
      }
    }
  }
})
