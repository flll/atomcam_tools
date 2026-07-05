// Material 3 tonal palette から CSS 変数(src/styles/tokens.css)を生成する。
// 使い方: node scripts/generate-theme.mjs [--source '#0ea5e9']
//   source 省略時は theme.config.json の値を使う。
// 出力はビルド時生成物として git 管理する(カメラ向けビルドは本スクリプトに依存しない)。
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { argbFromHex, hexFromArgb, themeFromSourceColor } from '@material/material-color-utilities';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const argIdx = process.argv.indexOf('--source');
const argSource =
  argIdx >= 0
    ? process.argv[argIdx + 1]
    : process.argv.find((a) => a.startsWith('--source='))?.split('=')[1];
const config = JSON.parse(readFileSync(path.join(root, 'theme.config.json'), 'utf8'));
const source = argSource ?? config.source;

const theme = themeFromSourceColor(argbFromHex(source));
const pal = {
  p: theme.palettes.primary,
  s: theme.palettes.secondary,
  t: theme.palettes.tertiary,
  n: theme.palettes.neutral,
  nv: theme.palettes.neutralVariant,
  e: theme.palettes.error,
};

// M3 のロール→(パレット, トーン)。旧 Scheme クラスには surface-container 系が
// 無いためトーン直指定(M3 仕様値)で構成する。
const ROLES = {
  light: {
    primary: ['p', 40], 'on-primary': ['p', 100], 'primary-container': ['p', 90], 'on-primary-container': ['p', 10],
    secondary: ['s', 40], 'on-secondary': ['s', 100], 'secondary-container': ['s', 90], 'on-secondary-container': ['s', 10],
    tertiary: ['t', 40], 'on-tertiary': ['t', 100], 'tertiary-container': ['t', 90], 'on-tertiary-container': ['t', 10],
    error: ['e', 40], 'on-error': ['e', 100], 'error-container': ['e', 90], 'on-error-container': ['e', 10],
    surface: ['n', 98], 'surface-dim': ['n', 87], 'surface-bright': ['n', 98],
    'surface-container-lowest': ['n', 100], 'surface-container-low': ['n', 96],
    'surface-container': ['n', 94], 'surface-container-high': ['n', 92], 'surface-container-highest': ['n', 90],
    'on-surface': ['n', 10], 'on-surface-variant': ['nv', 30],
    outline: ['nv', 50], 'outline-variant': ['nv', 80],
    'inverse-surface': ['n', 20], 'inverse-on-surface': ['n', 95], 'inverse-primary': ['p', 80],
    scrim: ['n', 0], shadow: ['n', 0],
  },
  dark: {
    primary: ['p', 80], 'on-primary': ['p', 20], 'primary-container': ['p', 30], 'on-primary-container': ['p', 90],
    secondary: ['s', 80], 'on-secondary': ['s', 20], 'secondary-container': ['s', 30], 'on-secondary-container': ['s', 90],
    tertiary: ['t', 80], 'on-tertiary': ['t', 20], 'tertiary-container': ['t', 30], 'on-tertiary-container': ['t', 90],
    error: ['e', 80], 'on-error': ['e', 20], 'error-container': ['e', 30], 'on-error-container': ['e', 90],
    surface: ['n', 6], 'surface-dim': ['n', 6], 'surface-bright': ['n', 24],
    'surface-container-lowest': ['n', 4], 'surface-container-low': ['n', 10],
    'surface-container': ['n', 12], 'surface-container-high': ['n', 17], 'surface-container-highest': ['n', 22],
    'on-surface': ['n', 90], 'on-surface-variant': ['nv', 80],
    outline: ['nv', 60], 'outline-variant': ['nv', 30],
    'inverse-surface': ['n', 90], 'inverse-on-surface': ['n', 20], 'inverse-primary': ['p', 40],
    scrim: ['n', 0], shadow: ['n', 0],
  },
};

// Tailwind の hsl(var(--x)) 形式に合わせて "H S% L%" トリプレットで出力する
function argbToHslTriplet(argb) {
  const r = ((argb >> 16) & 255) / 255;
  const g = ((argb >> 8) & 255) / 255;
  const b = (argb & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const round1 = (x) => Math.round(x * 10) / 10;
  return `${Math.round(h)} ${round1(s * 100)}% ${round1(l * 100)}%`;
}

function block(mode, selector) {
  const lines = Object.entries(ROLES[mode]).map(([role, [key, tone]]) => {
    const argb = pal[key].tone(tone);
    return `  --md-${role}: ${argbToHslTriplet(argb)}; /* ${hexFromArgb(argb)} */`;
  });
  return `${selector} {\n${lines.join('\n')}\n}`;
}

const css = `/* 自動生成: scripts/generate-theme.mjs — 直接編集禁止
 * source = ${source}
 * 再生成: npm run theme:generate (source 変更は theme.config.json)
 */
${block('light', ':root')}

${block('dark', '.dark')}
`;

const out = path.join(root, 'src/styles/tokens.css');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, css);
console.log(`wrote src/styles/tokens.css (source=${source})`);
