import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// vite.config.ts は Cloudflare プラグイン込みなので、テストは別設定で純粋な関数だけを動かす
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    environment: 'node',
  },
});
