import path from 'node:path';
import { defineConfig } from 'vitest/config';

// ロジックテストは node 環境が既定。コンポーネント/フックのテストは
// ファイル先頭の `// @vitest-environment jsdom` プラグマで切り替える。
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  define: {
    __DEMO__: JSON.stringify(false),
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
