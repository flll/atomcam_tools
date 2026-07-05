// hack.ini / CGI で扱う値の型定義。
// CGI は KEY=value もしくは KEY value のテキストを返すため、値は基本 string。
// on/off 文字列を boolean 的に扱うヘルパは hooks 側で提供する。

export type OnOff = 'on' | 'off';

// hack.ini の主要キー。現行 Setting.vue の config 既定値を正本とする。
// 全キーを optional の string にしておき、ページ側で必要なものを参照する。
export interface HackIni {
  CONFIG_VER?: string;
  appver?: string;
  ATOMHACKVER?: string;
  PRODUCT_MODEL?: string;
  HOSTNAME?: string;
  HWADDR?: string;
  DIGEST?: string;
  REBOOT?: OnOff;
  REBOOT_SCHEDULE?: string;
  RTSP_VIDEO0?: OnOff;
  RTSP_AUDIO0?: string;
  RTSP_VIDEO1?: OnOff;
  RTSP_AUDIO1?: string;
  RTSP_VIDEO2?: OnOff;
  RTSP_AUDIO2?: string;
  RTSP_OVER_HTTP?: OnOff;
  RTSP_AUTH?: OnOff;
  RTSP_USER?: string;
  RTSP_PASSWD?: string;
  HOMEKIT_ENABLE?: OnOff;
  WEBRTC_ENABLE?: OnOff;
  RTMP_ENABLE?: OnOff;
  RTMP_URL?: string;
  PERIODICREC_SDCARD?: OnOff;
  ALARMREC_SDCARD?: OnOff;
  TIMELAPSE_SDCARD?: OnOff;
  STORAGE_SDCARD_PUBLISH?: OnOff;
  WEBHOOK_URL?: string;
  CRUISE?: OnOff;
  CRUISE_LIST?: string;
  LOCALE?: string;
  FRAMERATE?: string;
  TAILSCALE_ENABLE?: OnOff;
  TAILSCALE_HOSTNAME?: string;
  // 上記以外のキーも素通しで保持する
  [key: string]: string | undefined;
}

// cmd.cgi (?name=status / 既定) が返すステータス。
export interface CameraStatus {
  LATESTVER?: string;
  TIMELAPSE?: string;
  TIMESTAMP?: string;
  CENTER?: string;
  FLIP?: string;
  // "available total"（KB）
  MEDIASIZE?: string;
  // "pan tilt horSwitch verSwitch 0"
  MOTORPOS?: string;
  [key: string]: string | undefined;
}

// MOTORPOS をパースした PTZ 状態。
export interface MotorPos {
  pan: number;
  tilt: number;
  horSwitch: number;
  verSwitch: number;
}

// video_isp.cgi の値。数値スライダー中心。
export interface IspSettings {
  cont: number;
  bri: number;
  sat: number;
  sharp: number;
  sinter: number;
  temper: number;
  dpc: number;
  drc: number;
  hilight: number;
  again: number;
  dgain: number;
  aecomp: number;
  expmode: 'auto' | 'manual';
  aeitmin: number;
  aeitmax: number;
  expline: number;
}

// cmd.cgi name=storage-info の結果(SDマウント状態・swap・メモリ)。
export interface SwapInfo {
  name: string;
  sizeKb: number;
  usedKb: number;
}

export interface StorageInfo {
  mounted: boolean;
  dev?: string;
  fs?: string;
  /** マウントオプション先頭が rw かどうか(ro 落ちの検知用) */
  rw?: boolean;
  df?: { totalKb: number; usedKb: number; availKb: number };
  swaps: SwapInfo[];
  memTotalKb?: number;
  memAvailKb?: number;
}

// cmd.cgi name=storage-du の結果(録画フォルダ別使用量 kB)。
export type StorageDu = Partial<Record<'record' | 'alarm_record' | 'time_lapse', number>>;

// cmd.cgi POST の宛先。socket は go2rtc 制御ポート(localhost:4000)直、
// 既定は /var/run/webcmd 経由。

export interface CameraProperty {
  valid?: boolean;
  nightVision?: string;
  nightCutThr?: string;
  IrLED?: string;
  motionDet?: string;
  motionLevel?: string;
  motionArea?: string;
  soundDet?: string;
  soundLevel?: string;
  cautionDet?: string;
  drawBoxSwitch?: string;
  recordType?: string;
  indicator?: string;
  rotate?: string;
  audioRec?: string;
  timestamp?: string;
  watermark?: string;
  [key: string]: string | boolean | undefined;
}

export interface ScheduleEntry {
  dayOfWeekSelect: number[];
  startTime: string;
  endTime: string;
}

export interface TimelapseScheduleEntry extends ScheduleEntry {
  interval: number;
  count: number;
}

export interface RebootSchedule {
  dayOfWeekSelect: number[];
  startTime: string;
}

export type CmdPort = 'socket' | 'fifo';
