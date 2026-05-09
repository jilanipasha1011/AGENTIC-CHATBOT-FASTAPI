import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy /chat to local backend during development
      '/chat': {
        target: 'https://fast-api-du5z.onrender.com/',
        changeOrigin: true,
      }
    }
  }
})
