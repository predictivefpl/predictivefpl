import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/fpl': {
        target: 'https://fantasy.premierleague.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fpl/, '/api'),
      },
      '/engine': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/engine/, ''),
      }
    }
  }
})
