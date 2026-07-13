// 連携先(Frigate / Home Assistant 等)向けの設定スニペット生成。
// URL パスは v4l2rtspserver の実パス videoN_unicast(実機 ffprobe で確認済み。
// /videoN は 404)。Frigate は公式推奨の2ストリーム構成
// (検知=低解像度サブ / 録画=高解像度メイン)に準拠する。
// 参照: docs.frigate.video/configuration/restream(2026-07-10)

export interface RtspAuth {
  on: boolean;
  user: string;
  pass: string;
}

export interface StreamFlags {
  main: boolean;
  sub: boolean;
  hevc: boolean;
}

function cred(auth: RtspAuth): string {
  return auth.on && auth.user ? `${auth.user}:${auth.pass}@` : '';
}

export function rtspUrl(host: string, stream: 'video0' | 'video1' | 'video2', auth: RtspAuth): string {
  return `rtsp://${cred(auth)}${host}:8554/${stream}_unicast`;
}

export function webrtcPageUrl(host: string, protocol = 'http:'): string {
  return `${protocol}//${host}:1984/webrtc.html?src=video0`;
}

// Frigate config.yml: go2rtc restream + detect(サブ)/record(メイン)の2ロール
export function frigateSnippet(host: string, name: string, auth: RtspAuth): string {
  const main = rtspUrl(host, 'video0', auth);
  const sub = rtspUrl(host, 'video1', auth);
  return `go2rtc:
  streams:
    ${name}:
      - ${main}
    ${name}_sub:
      - ${sub}

cameras:
  ${name}:
    ffmpeg:
      output_args:
        record: preset-record-generic-audio-aac
      inputs:
        - path: rtsp://127.0.0.1:8554/${name}
          input_args: preset-rtsp-restream
          roles:
            - record
        - path: rtsp://127.0.0.1:8554/${name}_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
    detect:
      width: 640
      height: 360`;
}

// auth key を識別できる範囲だけ見せる: 接頭辞(tskey-auth-)+末尾4桁。全文は再表示しない。
export function maskAuthKey(k: string): string {
  if (!k) return '';
  if (k.length <= 8) return '••••';
  const m = k.match(/^(tskey-[a-z]*-?)/);
  const prefix = m ? m[1] : k.slice(0, 6);
  return `${prefix}••••${k.slice(-4)}`;
}

// Tailscale ACL(grants): 指定タグのデバイスに WebUI(80)と RTSP(8554)だけ許可する雛形。
// 適用は管理コンソール(login.tailscale.com/admin/acls)側。tag は advertise-tags と揃える。
export function tailscaleAclSnippet(tag: string): string {
  const t = tag && tag.startsWith('tag:') ? tag : 'tag:cctv';
  return `{
  "tagOwners": {
    "${t}": ["autogroup:admin"]
  },
  "grants": [
    {
      "src": ["autogroup:member"],
      "dst": ["${t}"],
      "ip": ["80", "8554"]
    }
  ]
}`;
}

// Home Assistant: go2rtc アドオン/WebRTC カード向けと generic camera 向け
export function homeAssistantSnippet(host: string, name: string, auth: RtspAuth): string {
  const main = rtspUrl(host, 'video0', auth);
  return `# go2rtc (WebRTC card / add-on)
streams:
  ${name}:
    - ${main}

# または Generic Camera 統合:
#   Stream source: ${main}`;
}
