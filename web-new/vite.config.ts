import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { compression } from 'vite-plugin-compression2';

// カメラ実機ビルドでは MSW の service worker を配布物から除外する
function dropMockWorker(isDemo: boolean): Plugin {
  return {
    name: 'drop-mock-worker',
    apply: 'build',
    closeBundle() {
      if (isDemo) return;
      const worker = path.resolve(__dirname, 'dist/mockServiceWorker.js');
      if (existsSync(worker)) rmSync(worker);
    },
  };
}

export default defineConfig(({ mode }) => {
  const isDemo = mode === 'demo';
  return {
    // カメラは lighttpd の / 直下配信、デモは GitHub Pages のサブパス配信
    base: './',
    plugins: [
      react(),
      dropMockWorker(isDemo),
      // lighttpd rewrite 互換: .gz と .br を事前生成（オリジナルは保持し、
      // 実機配置時に local_build.sh 側で削除する方式を踏襲）
      compression({
        include: /\.(js|css|html|json|svg)$/,
        algorithms: ['gzip'],
        skipIfLargerOrEqual: true,
      }),
      compression({
        include: /\.(js|css|html|json|svg)$/,
        algorithms: ['brotliCompress'],
        skipIfLargerOrEqual: true,
      }),
    ],
    define: {
      __DEMO__: JSON.stringify(isDemo),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      manifest: true,
      rollupOptions: {
        output: {
          // 初回ロードを小さく保つ: vendor は React コアのみ。
          // konva 等の重量級は Phase 4 でページ単位の dynamic import にする。
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            // motion は manualChunks で固定しない: LazyMotion/m の静的 import(軽量)と
            // domMax の動的 import(重量)を Rollup の自然な分割に任せる。
            // 固定チャンクにすると静的 import が全体を同期ロードに巻き込む。
            if (id.includes('react-router') || id.includes('/@remix-run/')) return 'router';
            if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n';
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/scheduler/')
            ) {
              return 'react-vendor';
            }
          },
        },
      },
    },
  };
});
