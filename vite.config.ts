import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5199,
    strictPort: true,
    proxy: {
      '/api/globalping': {
        target: 'https://api.globalping.io',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/globalping/, ''),
        headers: {
          'User-Agent': 'B3-Networks-L2-Support-Workbench/1.0',
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});

