import {
  parseHackIni,
  parseIspSettings,
  parseProperty,
  parseStatus,
  rgbaToBgra,
  serializeHackIni,
  serializeIspSettings,
} from './parse';
import type { CameraProperty, CameraStatus, CmdPort, HackIni, IspSettings } from './types';

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
  async getHackIni(): Promise<HackIni> {
    return parseHackIni(await getText(`${CGI_BASE}/hack_ini.cgi`));
  },

  async saveHackIni(config: HackIni): Promise<void> {
    const res = await fetch(`${CGI_BASE}/hack_ini.cgi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      body: serializeHackIni(config),
    });
    if (!res.ok) throw new Error(`POST hack_ini.cgi -> ${res.status}`);
  },

  async getStatus(name?: 'status' | 'media-size' | 'latest-ver'): Promise<CameraStatus> {
    const q = name ? `?name=${name}` : '';
    return parseStatus(await getText(`${CGI_BASE}/cmd.cgi${q}`));
  },

  async getJpegObjectUrl(): Promise<string> {
    const res = await fetch(`${CGI_BASE}/get_jpeg.cgi?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`GET get_jpeg.cgi -> ${res.status}`);
    return URL.createObjectURL(await res.blob());
  },

  async exec(cmd: string, port: CmdPort = 'socket'): Promise<string> {
    const res = await fetch(`${CGI_BASE}/cmd.cgi?port=${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      body: JSON.stringify({ exec: cmd }),
    });
    if (!res.ok) throw new Error(`POST cmd.cgi -> ${res.status}`);
    return res.text();
  },

  async getProperty(): Promise<CameraProperty> {
    return parseProperty(await this.exec('property', 'socket'));
  },

  async setProperty(key: string, value: string): Promise<void> {
    await this.exec(`property ${key} ${value}`, 'socket');
  },

  async getIspSettings(): Promise<IspSettings> {
    return parseIspSettings(await getText(`${CGI_BASE}/video_isp.cgi`));
  },

  async saveIspSettings(settings: IspSettings): Promise<void> {
    const res = await fetch(`${CGI_BASE}/video_isp.cgi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      body: serializeIspSettings(settings),
    });
    if (!res.ok) throw new Error(`POST video_isp.cgi -> ${res.status}`);
  },

  async applyIspLive(key: keyof IspSettings, settings: IspSettings): Promise<void> {
    if (['aeitmin', 'aeitmax', 'expmode', 'expline'].includes(key)) {
      await this.exec(
        `video expr ${settings.expmode} ${settings.expline} ${settings.aeitmin} ${settings.aeitmax}`,
        'socket',
      );
    } else {
      await this.exec(`video ${key} ${settings[key]}`, 'socket');
    }
  },

  async getWatermark(): Promise<ArrayBuffer> {
    const res = await fetch(`${CGI_BASE}/watermark.cgi?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`GET watermark.cgi -> ${res.status}`);
    return res.arrayBuffer();
  },

  async saveWatermarkFromCanvas(canvas: HTMLCanvasElement): Promise<void> {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d unavailable');
    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height).data;
    const body = rgbaToBgra(imageData, width, height);
    const res = await fetch(`${CGI_BASE}/watermark.cgi`, {
      method: 'POST',
      body,
    });
    if (!res.ok) throw new Error(`POST watermark.cgi -> ${res.status}`);
  },

  async homekitPairing(): Promise<unknown> {
    const res = await fetch(`${go2rtcBase()}/api/homekit/pairing`);
    if (!res.ok) throw new Error(`homekit pairing -> ${res.status}`);
    return res.json();
  },
};

export type Api = typeof api;
