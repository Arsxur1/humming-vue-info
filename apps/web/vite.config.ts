import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Прокси /api → NestJS, чтобы фронтенд в dev ходил без CORS-настроек.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // доступ снаружи контейнера/ВМ
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
