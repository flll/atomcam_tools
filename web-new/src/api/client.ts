import {
  parseHackIni,
  parseIspSettings,
  parseProperty,
  parseStatus,
  parseStorageDu,
  parseStorageInfo,
  rgbaToBgra,
  serializeIspSettings,
} from './parse';
import type {
  CameraProperty,
  CameraStatus,
  CmdPort,
  HackIni,
  IspSettings,
  StorageDu,
  StorageInfo,
} from './types';

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
    // hack_ini.cgi の POST は awk で {"KEY":"value",...} 形式を前提にしている
    // (KEY value のテキスト行を送ると本文全体が1レコード扱いになり、先頭キーが
    //  除外対象だと hack.ini が空になる)。必ず JSON で送る。
    const res = await fetch(`${CGI_BASE}/hack_ini.cgi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      body: JSON.stringify(config),
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

  async getStorageInfo(): Promise<StorageInfo> {
    return parseStorageInfo(await getText(`${CGI_BASE}/cmd.cgi?name=storage-info`));
  },

  // du はフォルダサイズ次第で数秒かかるため、ボタン押下時のみ呼ぶ
  async getStorageDu(): Promise<StorageDu> {
    return parseStorageDu(await getText(`${CGI_BASE}/cmd.cgi?name=storage-du`));
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
      body: body.buffer as ArrayBuffer,
    });
    if (!res.ok) throw new Error(`POST watermark.cgi -> ${res.status}`);
  },

  async homekitPairing(): Promise<unknown> {
    const res = await fetch(`${go2rtcBase()}/api/homekit/pairing`);
    if (!res.ok) throw new Error(`homekit pairing -> ${res.status}`);
    return res.json();
  },

  // go2rtc(:1984) が応答するか軽く確認する(WebRTC 有効時のみ呼ぶ)
  async probeGo2rtc(timeoutMs = 3000): Promise<boolean> {
    try {
      const res = await fetch(`${go2rtcBase()}/api/streams`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // WHEP 相当: offer SDP を POST し answer SDP を受け取る(go2rtc /api/webrtc)
  async whepOffer(sdp: string, src = 'video0'): Promise<string> {
    const res = await fetch(`${go2rtcBase()}/api/webrtc?src=${encodeURIComponent(src)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: sdp,
    });
    if (!res.ok) throw new Error(`POST go2rtc webrtc -> ${res.status}`);
    return res.text();
  },
};

export type Api = typeof api;
