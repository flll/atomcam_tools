import {
  parseHackIni,
  parseStatus,
  serializeHackIni,
} from './parse';
import type { CameraStatus, CmdPort, HackIni } from './types';

// 実機では lighttpd の / 直下に SPA が配信され、CGI は ./cgi-bin/ に同居する。
// go2rtc は同一ホストの :1984。デモ/開発では MSW がこれらを横取りする。
const CGI_BASE = './cgi-bin';

function go2rtcBase(): string {
  return `${window.location.protocol}//${window.location.hostname}:1984`;
}

async function getText(path: string): Promise<string> {
  const res = await fetch(`${path}${path.includes('?') ? '&' : '?'}t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.text();
}

export const api = {
  // hack.ini 全体を取得
  async getHackIni(): Promise<HackIni> {
    return parseHackIni(await getText(`${CGI_BASE}/hack_ini.cgi`));
  },

  // hack.ini を保存（差分ではなく全量 POST が現行仕様）
  async saveHackIni(config: HackIni): Promise<void> {
    const res = await fetch(`${CGI_BASE}/hack_ini.cgi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      body: serializeHackIni(config),
    });
    if (!res.ok) throw new Error(`POST hack_ini.cgi -> ${res.status}`);
  },

  // カメラステータス（既定 or name 指定）
  async getStatus(name?: 'status' | 'media-size' | 'latest-ver'): Promise<CameraStatus> {
    const q = name ? `?name=${name}` : '';
    return parseStatus(await getText(`${CGI_BASE}/cmd.cgi${q}`));
  },

  // ライブ JPEG を Blob URL として取得（呼び出し側で revoke する）
  async getJpegObjectUrl(): Promise<string> {
    const res = await fetch(`${CGI_BASE}/get_jpeg.cgi?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`GET get_jpeg.cgi -> ${res.status}`);
    return URL.createObjectURL(await res.blob());
  },

  // コマンド実行（PTZ / night など）
  async exec(cmd: string, port: CmdPort = 'socket'): Promise<string> {
    const res = await fetch(`${CGI_BASE}/cmd.cgi?port=${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      body: JSON.stringify({ exec: cmd }),
    });
    if (!res.ok) throw new Error(`POST cmd.cgi -> ${res.status}`);
    return res.text();
  },

  // go2rtc HomeKit ペアリング情報
  async homekitPairing(): Promise<unknown> {
    const res = await fetch(`${go2rtcBase()}/api/homekit/pairing`);
    if (!res.ok) throw new Error(`homekit pairing -> ${res.status}`);
    return res.json();
  },
};

export type Api = typeof api;
