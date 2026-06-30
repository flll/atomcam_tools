// MSW ハンドラ間で共有するモックカメラ状態。
// 操作（PTZ・設定保存）が反映され、操作感を確認できるようにする。

export interface MockState {
  pan: number;
  tilt: number;
  horSwitch: number;
  verSwitch: number;
  hackIni: Record<string, string>;
  isp: Record<string, string>;
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

export const mock: MockState = {
  pan: 177,
  tilt: 90,
  horSwitch: 0,
  verSwitch: 0,
  hackIni: { ...DEFAULT_HACK_INI },
  isp: { cont: '128', bri: '128', expmode: 'auto' },
};

// AtomSwing 風に move コマンドへ反応する（pan/tilt をクランプ）。
export function applyExec(cmd: string): string {
  const args = cmd.trim().split(/\s+/);
  if (args[0] === 'move') {
    if (args[1] != null) mock.pan = clamp(Number(args[1]), 0, 355);
    if (args[2] != null) mock.tilt = clamp(Number(args[2]), 0, 180);
    return 'ok';
  }
  if (args[0] === 'night') return 'ok';
  if (args[0] === 'property' && args.length === 1) {
    return 'nightVision=auto\nmotionDet=on\nrecordType=cont\nwatermark=off\nok';
  }
  if (args[0] === 'property') return 'ok';
  return 'ok';
}

function clamp(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, v));
}
