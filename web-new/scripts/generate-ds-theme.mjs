// design-system(LDSG v1.5.0 色 / Atlassian 骨格)から src/styles/tokens.css を生成する。
// 旧 generate-theme.mjs(M3 tonal palette)の置き換え。既存 Tailwind が参照する
// --md-* 変数名を互換のまま、値を DS パレット由来に差し替える(全ページ自動移行)。
// 実行: npx tsx scripts/generate-ds-theme.mjs
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// LDSG palette(design-system assets/tokens.css・palette-rainbow.css より)
const P = {
  white: '#FFFFFF', black: '#000000',
  gray100: '#FCFCFC', gray150: '#F5F5F5', gray200: '#EFEFEF', gray250: '#E8E8E8',
  gray300: '#DFDFDF', gray350: '#C8C8C8', gray400: '#B7B7B7', gray500: '#949494',
  gray600: '#777777', gray650: '#616161', gray700: '#555555', gray750: '#3F3F3F',
  gray770: '#383838', gray800: '#2A2A2A', gray850: '#1F1F1F', gray870: '#1A1A1A',
  gray900: '#111111',
  skyblue300: '#ABDCFF', skyblue400: '#78CBFF', skyblue500: '#40B6FF',
  skyblue600: '#1A9CFF', skyblue700: '#0279D4', skyblue800: '#095796', skyblue900: '#1C476B',
  skyblue300p: '#C5D6E3',
  navy400: '#C8CFDC', navy600: '#707991', navy800: '#323B54', navy900: '#202A43',
  teal300: '#8EEDD9', teal400: '#5CE5C8', teal600: '#19BFA1', teal900: '#14594C',
  red300: '#FCC5CB', red500: '#FF697A', red600: '#FF334B', red900: '#85101E',
};

// hex → Tailwind hsl(var()) 用の "H S% L%" トリプレット
function hsl(hex) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return `${Math.round(h)} ${Math.round(s * 1000) / 10}% ${Math.round(l * 1000) / 10}%`;
}

// --md-* 互換名 → DS 値(light / dark)
const roles = {
  'surface':                   [P.white,       P.gray900],
  'surface-dim':               [P.gray200,     P.gray900],
  'surface-bright':            [P.gray100,     P.gray770],
  'surface-container-lowest':  [P.white,       P.black],
  'surface-container-low':     [P.gray100,     P.gray870],
  'surface-container':         [P.gray150,     P.gray850],
  'surface-container-high':    [P.gray200,     P.gray800],
  'surface-container-highest': [P.gray250,     P.gray770],
  'on-surface':                [P.black,       P.white],
  'on-surface-variant':        [P.gray650,     P.gray400],
  'primary':                   [P.skyblue600,  P.skyblue500],
  'on-primary':                [P.white,       P.skyblue900],
  'primary-container':         [P.skyblue300,  P.skyblue800],
  'on-primary-container':      [P.skyblue900,  P.skyblue300],
  'inverse-primary':           [P.skyblue400,  P.skyblue700],
  'secondary':                 [P.navy600,     P.navy400],
  'on-secondary':              [P.white,       P.navy900],
  'secondary-container':       [P.skyblue300p, P.navy800],
  'on-secondary-container':    [P.navy800,     P.navy400],
  'tertiary':                  [P.teal600,     P.teal400],
  'tertiary-container':        [P.teal300,     P.teal900],
  'on-tertiary':               [P.white,       P.teal900],
  'on-tertiary-container':     [P.teal900,     P.teal300],
  'error':                     [P.red600,      P.red500],
  'on-error':                  [P.white,       P.red900],
  'error-container':           [P.red300,      P.red900],
  'on-error-container':        [P.red900,      P.red300],
  'outline':                   [P.gray400,     P.gray600],
  'outline-variant':           [P.gray300,     P.gray750],
  'inverse-surface':           [P.navy900,     P.gray200],
  'inverse-on-surface':        [P.white,       P.gray900],
  'scrim':                     [P.black,       P.black],
  'shadow':                    [P.black,       P.black],
};

const emit = (dark) =>
  Object.entries(roles)
    .map(([k, v]) => `  --md-${k}: ${hsl(v[dark ? 1 : 0])};`)
    .join('\n');

const css = `/* 自動生成: scripts/generate-ds-theme.mjs — 手で編集しない
   design-system(色=LDSG v1.5.0 / 骨格=Atlassian)由来。
   変数名は旧 M3 実装との互換のため --md-* のまま、値は DS パレット。
   primary = Rainbow skyblue 600 #1A9CFF(LINE Green は公開 OSS のため不採用) */
:root {
${emit(false)}
}
.dark {
${emit(true)}
}
`;

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../src/styles/tokens.css');
writeFileSync(out, css);
console.log('wrote', out);
