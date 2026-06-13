// バンドル予算の enforce。
// - 初回ロード（index.html が読む entry + 初期 chunk）の gzip 合計 <= 250KB（目標）
// - dist 全 .js/.css の gzip 合計 <= 500KB（上限）
// build 後に dist/.vite/manifest.json と実ファイルの .gz を見て判定する。
import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, '../dist');

const INITIAL_TARGET = 250 * 1024;
const TOTAL_LIMIT = 500 * 1024;

if (!existsSync(dist)) {
  console.error('dist/ がありません。先に `npm run build` を実行してください。');
  process.exit(1);
}

function gzipSize(file) {
  return gzipSync(readFileSync(file), { level: 9 }).length;
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const assets = walk(dist).filter((f) => /\.(js|css)$/.test(f) && !f.endsWith('.gz') && !f.endsWith('.br'));

// 初回ロード: manifest の isEntry な chunk と、その同期 import を辿り、
// 実ファイル名（entry.file / entry.css）を集める。dynamic import は除外。
const initialRel = new Set();
const visited = new Set();
const manifestPath = path.join(dist, '.vite/manifest.json');
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const add = (key) => {
    const entry = manifest[key];
    if (!entry || visited.has(key)) return;
    visited.add(key);
    if (entry.file) initialRel.add(entry.file);
    entry.css?.forEach((c) => initialRel.add(c));
    entry.imports?.forEach(add);
  };
  Object.entries(manifest).forEach(([key, entry]) => {
    if (entry.isEntry) add(key);
  });
}

const initialFiles = [...initialRel]
  .map((rel) => path.join(dist, rel))
  .filter((f) => existsSync(f) && /\.(js|css)$/.test(f));

const initialBytes = initialFiles.reduce((sum, f) => sum + gzipSize(f), 0);
const totalBytes = assets.reduce((sum, f) => sum + gzipSize(f), 0);

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log('--- bundle budget (gzip) ---');
console.log(`initial load: ${kb(initialBytes)} / target ${kb(INITIAL_TARGET)}`);
console.log(`total assets: ${kb(totalBytes)} / limit  ${kb(TOTAL_LIMIT)}`);

let failed = false;
if (totalBytes > TOTAL_LIMIT) {
  console.error(`NG: total ${kb(totalBytes)} が上限 ${kb(TOTAL_LIMIT)} を超過`);
  failed = true;
}
if (initialBytes > INITIAL_TARGET) {
  // 目標超過は警告（CI を落とすのは上限のみ）
  console.warn(`WARN: initial ${kb(initialBytes)} が目標 ${kb(INITIAL_TARGET)} を超過`);
}
process.exit(failed ? 1 : 0);
