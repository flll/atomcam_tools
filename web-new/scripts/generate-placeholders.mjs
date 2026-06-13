// デモ/開発の OG・poster 用に静的な poster.svg を public/ へ書き出す。
// ライブのモックフレームは実行時に MSW が生成するため、ここは静止画のみ。
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(__dirname, '../public');
mkdirSync(out, { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
  <rect width="640" height="480" fill="#0b1220"/>
  <text x="320" y="240" text-anchor="middle" font-family="monospace" font-size="22" fill="#38bdf8">ATOMCam WebUI</text>
  <text x="320" y="272" text-anchor="middle" font-family="monospace" font-size="14" fill="#64748b">no signal (mock)</text>
</svg>`;

writeFileSync(path.join(out, 'poster.svg'), svg);
console.log('wrote public/poster.svg');
