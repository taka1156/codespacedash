import { resolve } from 'node:path';
import { cloudflare } from '@cloudflare/vite-plugin';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import react from '@vitejs/plugin-react-swc';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  return {
    resolve: {
      alias: {
        '@': resolve(import.meta.dirname, './src'),
      },
    },
    plugins: [
      react(),
      vanillaExtractPlugin(),
      // server/index.ts(Hono) を Workers ランタイムで動かす。dev でも /api が同じオリジンで動く
      cloudflare(),
      mode === 'analyze' && visualizer(),
    ],
    server: {
      port: 5173,
    },
    // ベンダー分割はブラウザ向けのビルドだけ（Worker は1ファイルのままでよい）
    environments: {
      client: {
        build: {
          rolldownOptions: {
            output: {
              codeSplitting: {
                groups: [
                  {
                    name: 'react-vendor',
                    test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                    priority: 30,
                  },
                  {
                    name: 'charts-vendor',
                    test: /node_modules[\\/](recharts|d3|d3-[^\\/]+)[\\/]/,
                    priority: 20,
                  },
                  {
                    name: 'other-vendor',
                    test: /node_modules/,
                    priority: 10,
                  },
                ],
              },
            },
          },
        },
      },
    },
  };
});
