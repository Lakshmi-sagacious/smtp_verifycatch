import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Import @smtp/shared directly from source. The dist/ build targets CJS for Nest — its
      // runtime __exportStar helper defeats Rollup's static analysis during `vite build`.
      // Vite handles the TS at build time, so no rebuild step is needed for shared.
      '@smtp/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
