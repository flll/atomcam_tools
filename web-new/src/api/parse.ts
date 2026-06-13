import type { CameraStatus, HackIni, MotorPos } from './types';

// CGI は `KEY value` または `KEY=value` 行を返す。
// 先頭トークンをキー、残りを値として取り出す（現行 Setting.vue 互換）。
export function parseKeyValue(text: string): Record<string, string> {
  return text.split('\n').reduce<Record<string, string>>((acc, line) => {
    const name = line.split(/[ \t=]/)[0]?.trim();
    if (!name) return acc;
    acc[name] = line.replace(new RegExp(`${escapeRe(name)}[ \t=]*`), '').trim();
    return acc;
  }, {});
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseHackIni(text: string): HackIni {
  return parseKeyValue(text) as HackIni;
}

export function parseStatus(text: string): CameraStatus {
  return parseKeyValue(text) as CameraStatus;
}

// "pan tilt horSwitch verSwitch 0" -> MotorPos
export function parseMotorPos(value: string | undefined): MotorPos | null {
  if (!value) return null;
  const p = value.trim().split(/\s+/).map(Number);
  if (p.length < 2 || Number.isNaN(p[0]) || Number.isNaN(p[1])) return null;
  return {
    pan: Math.round(p[0]),
    tilt: Math.round(p[1]),
    horSwitch: p[2] ?? 0,
    verSwitch: p[3] ?? 0,
  };
}

// "available total"（KB）-> { available, total }（バイト）
export function parseMediaSize(value: string | undefined): { available: number; total: number } | null {
  if (!value) return null;
  const [avail, total] = value.trim().split(/\s+/).map(Number);
  if (Number.isNaN(avail) || Number.isNaN(total)) return null;
  return { available: avail * 1024, total: total * 1024 };
}

// HackIni オブジェクトを CGI POST 用の `KEY value` テキストへ戻す。
export function serializeHackIni(config: HackIni): string {
  return Object.entries(config)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k} ${v}`)
    .join('\n');
}
