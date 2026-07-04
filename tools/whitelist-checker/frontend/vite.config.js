import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 6002,
    host: true,
    allowedHosts: [process.env.VITE_ALLOWED_HOST || 'localhost'],
    proxy: {
      '/api': {
        target: 'http://localhost:6001',
        changeOrigin: true
      }
    }
  }
});