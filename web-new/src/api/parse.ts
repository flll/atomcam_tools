import type { CameraProperty, CameraStatus, HackIni, IspSettings, MotorPos } from './types';

const ISP_NUMERIC_KEYS = [
  'cont', 'bri', 'sat', 'sharp', 'sinter', 'temper', 'dpc', 'drc', 'hilight',
  'again', 'dgain', 'aecomp', 'aeitmin', 'aeitmax', 'expline',
] as const;

const ISP_DEFAULTS: IspSettings = {
  cont: 128, bri: 128, sat: 128, sharp: 128, sinter: 128, temper: 128,
  dpc: 128, drc: 128, hilight: 2, again: 205, dgain: 64, aecomp: 128,
  expmode: 'auto', aeitmin: 1, aeitmax: 1683, expline: 1200,
};

// CGI は `KEY value` または `KEY=value` 行を返す。
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

export function parseMediaSize(value: string | undefined): { available: number; total: number } | null {
  if (!value) return null;
  const [avail, total] = value.trim().split(/\s+/).map(Number);
  if (Number.isNaN(avail) || Number.isNaN(total)) return null;
  return { available: avail * 1024, total: total * 1024 };
}

export function parseIspSettings(text: string): IspSettings {
  const kv = parseKeyValue(text);
  const out = { ...ISP_DEFAULTS };
  for (const key of ISP_NUMERIC_KEYS) {
    const raw = kv[key];
    if (raw != null && raw !== '') out[key] = Number(raw);
  }
  if (kv.expmode === 'manual' || kv.expmode === 'auto') out.expmode = kv.expmode;
  return out;
}

export function serializeIspSettings(settings: IspSettings): string {
  return Object.entries(settings)
    .map(([k, v]) => `${k} ${v}`)
    .join('\n');
}

// cmd.cgi property 応答: `key=value` 行
export function parseProperty(text: string): CameraProperty {
  const out: CameraProperty = { valid: false };
  // cmd.cgi は NUL 区切りで返すことがあるため \x00 も行区切りとして扱う
  // eslint-disable-next-line no-control-regex
  for (const line of text.split(/[\n\x00]/)) {
    if (!line || line === 'ok') continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (key) (out as Record<string, string>)[key] = val;
  }
  out.valid = Object.keys(out).length > 1;
  return out;
}

export function parseWatermarkDimensions(buf: ArrayBuffer): { width: number; height: number } | null {
  if (buf.byteLength < 8) return null;
  const v = new DataView(buf);
  const height = v.getUint16(0, true);
  const width = v.getUint16(4, true);
  if (!width || !height) return null;
  return { width, height };
}

export function rgbaToBgra(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const bgra = new Uint8Array(8 + width * height * 4);
  const dv = new DataView(bgra.buffer);
  dv.setUint16(0, height, true);
  dv.setUint16(4, width, true);
  for (let i = 0; i < width * height; i++) {
    bgra[8 + i * 4] = rgba[i * 4 + 2];
    bgra[8 + i * 4 + 1] = rgba[i * 4 + 1];
    bgra[8 + i * 4 + 2] = rgba[i * 4];
    bgra[8 + i * 4 + 3] = rgba[i * 4 + 3];
  }
  return bgra;
}
