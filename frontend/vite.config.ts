import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
const backendTarget = process.env.VITE_BACKEND_URL || 'http://localhost:8000';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/docs': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/redoc': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/openapi.json': {
        target: backendTarget,
        changeOrigin: true,
      }
    }
  }
});
