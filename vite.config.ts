import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  plugins: [react(), vanillaExtractPlugin()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
});
