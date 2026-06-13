// 旧 web/source/vue/i18n-{ja,en}.yaml を react-i18next 用 JSON へ変換する。
// 出力: public/locales/{ja,en}/translation.json
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcDir = path.resolve(root, '../web/source/vue');
const outDir = path.resolve(root, 'public/locales');

for (const lang of ['ja', 'en']) {
  const srcFile = path.join(srcDir, `i18n-${lang}.yaml`);
  const data = yaml.load(readFileSync(srcFile, 'utf8'));
  const dir = path.join(outDir, lang);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'translation.json'), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`wrote ${path.relative(root, path.join(dir, 'translation.json'))}`);
}
