import { resolve } from 'node:path';
import { cloudflare } from '@cloudflare/vite-plugin';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type Plugin } from 'vite';

const PAGES_MODE = 'pages';

const stripManifest = (): Plugin => ({
  name: 'strip-manifest',
  transformIndexHtml: (html) => html.replace(/<link rel="manifest"[^>]*>/, ''),
});

export default defineConfig(({ mode }) => {
  const isPages = mode === PAGES_MODE;
  return {
    base: isPages ? (process.env.PAGES_BASE ?? '/quotadash/') : '/',
    resolve: {
      alias: {
        '@': resolve(import.meta.dirname, './src'),
      },
    },
    plugins: [
      react(),
      vanillaExtractPlugin({ identifiers: isPages ? 'short' : undefined }),
      // server/index.ts(Hono) を Workers ランタイムで動かす。dev でも /api が同じオリジンで動く
      !isPages && cloudflare(),
      isPages && stripManifest(),
      mode === 'analyze' && visualizer(),
    ],
    server: {
      port: 5173,
    },
    build: isPages ? { outDir: 'dist-pages', emptyOutDir: true } : undefined,
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
