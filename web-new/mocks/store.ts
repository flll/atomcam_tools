// MSW ハンドラ間で共有するモックカメラ状態。
// 操作（PTZ・設定保存）が反映され、操作感を確認できるようにする。

export interface MockState {
  pan: number;
  tilt: number;
  horSwitch: number;
  verSwitch: number;
  hackIni: Record<string, string>;
  isp: Record<string, string>;
  property: Record<string, string>;
  lastNotify?: { channel: string; event: string; ok: boolean; at: string };
}

const DEFAULT_HACK_INI: Record<string, string> = {
  CONFIG_VER: '1.0.1',
  ATOMHACKVER: '6.3',
  PRODUCT_MODEL: 'ATOM_CAKP1JZJP',
  HOSTNAME: 'atomcam',
  HWADDR: '00:11:22:33:44:55',
  DIGEST: '',
  LOCALE: 'ja',
  FRAMERATE: '20',
  RTSP_VIDEO0: 'on',
  RTSP_AUDIO0: 'OPUS',
  HOMEKIT_ENABLE: 'off',
  WEBRTC_ENABLE: 'on',
  PERIODICREC_SDCARD: 'on',
  ALARMREC_SDCARD: 'on',
  CRUISE: 'off',
  TAILSCALE_ENABLE: 'off',
};

// 開発/E2E 用: `?mockModel=ATOMCAM2` 等で機種を上書きできる(既定は AtomSwing)。
// /settings/camera(ATOM 専用ページ)をモック環境で表示するために使う。
const mockModel =
  typeof location !== 'undefined' ? new URLSearchParams(location.search).get('mockModel') : null;

export const mock: MockState = {
  pan: 177,
  tilt: 90,
  horSwitch: 0,
  verSwitch: 0,
  hackIni: { ...DEFAULT_HACK_INI, ...(mockModel ? { PRODUCT_MODEL: mockModel } : {}) },
  isp: { cont: '128', bri: '128', expmode: 'auto' },
  property: { nightVision: 'auto', motionDet: 'on', recordType: 'cont', watermark: 'off' },
};

// AtomSwing 風に move コマンドへ反応する（pan/tilt をクランプ）。
export function applyExec(cmd: string): string {
  const args = cmd.trim().split(/\s+/);
  if (args[0] === 'move') {
    if (args[1] != null) mock.pan = clamp(Number(args[1]), 0, 355);
    if (args[2] != null) mock.tilt = clamp(Number(args[2]), 0, 180);
    return 'ok';
  }
  // night x は property nightVision に反映する(実機挙動は deploy-test で照合)
  if (args[0] === 'night') {
    if (args[1]) mock.property.nightVision = args[1];
    return 'ok';
  }
  if (args[0] === 'property' && args.length === 1) {
    return `${Object.entries(mock.property)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')}\nok`;
  }
  // property <key> <value...> は書き込み(実機同様に読み返しへ反映)
  if (args[0] === 'property' && args.length >= 3) {
    mock.property[args[1]] = args.slice(2).join(' ');
    return 'ok';
  }
  if (args[0] === 'property') return 'ok';
  return 'ok';
}

function clamp(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, v));
}
