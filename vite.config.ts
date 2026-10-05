import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const apiPort = Number(process.env.PORT ?? 3001);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': `http://localhost:${apiPort}`,
      '/uploads': `http://localhost:${apiPort}`,
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
