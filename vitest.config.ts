import { resolve } from 'node:path';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const alias = { '@': resolve(import.meta.dirname, './src') };

// vite.config.ts は Cloudflare プラグイン込みなので、テストは別設定で動かす
export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        // Worker（Hono）と共有の型・関数
        resolve: { alias },
        test: {
          name: 'server',
          include: ['server/**/*.test.ts', 'shared/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        // React・Service Worker
        plugins: [react(), vanillaExtractPlugin()],
        resolve: { alias },
        test: {
          name: 'client',
          include: ['src/**/*.test.{ts,tsx}', 'public/**/*.test.ts'],
          environment: 'jsdom',
          setupFiles: ['./src/testing/setup.ts'],
        },
      },
    ],
    coverage: {
      // istanbul は && / || / ?? の各項も分岐として数えるので、
      // 分岐（C1）に加えて条件（C2）の真偽も網羅できているかを確認できる
      provider: 'istanbul',
      include: ['src/**', 'server/**', 'shared/**', 'public/sw.js'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/testing/**',
        // スタイル定義（vanilla-extract）と型だけのファイル
        '**/*.css.ts',
        'src/lib/types.ts',
      ],
      reporter: ['text', 'html', 'json', 'json-summary'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
