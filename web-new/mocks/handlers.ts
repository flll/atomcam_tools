import { http, HttpResponse } from 'msw';
import { makeFrameSvg } from './frame';
import { applyExec, mock } from './store';

// ベース相対の ./cgi-bin/* と、デモ配信時の絶対パス両方に一致させる。
const cgi = (name: string) => new RegExp(`/cgi-bin/${name}(\\?.*)?$`);

function statusText(): string {
  const lines = [
    `LATESTVER=6.3`,
    `TIMELAPSE=stop`,
    `TIMESTAMP=${new Date().toLocaleString('ja-JP', { hour12: false }).replace(/-/g, '/')}`,
    `CENTER=ok`,
    `FLIP=0`,
    `MEDIASIZE=23068672 31154176`,
    `MOTORPOS=${mock.pan} ${mock.tilt} ${mock.horSwitch} ${mock.verSwitch} 0`,
  ];
  return lines.join('\n');
}

function hackIniText(): string {
  return Object.entries(mock.hackIni)
    .map(([k, v]) => `${k} ${v}`)
    .join('\n');
}

export const handlers = [
  http.get(cgi('get_jpeg.cgi'), () => {
    return new HttpResponse(makeFrameSvg(mock.pan, mock.tilt), {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' },
    });
  }),

  http.get(cgi('cmd.cgi'), ({ request }) => {
    const url = new URL(request.url);
    const name = url.searchParams.get('name');
    if (name === 'latest-ver') return HttpResponse.text('LATESTVER=6.3');
    if (name === 'media-size') return HttpResponse.text('MEDIASIZE=23068672 31154176');
    // 実機 cmd.cgi の storage-info/storage-du を模擬。MEMAVAILABLE は
    // kernel 3.10 に存在しないため出さない(MemFree+Cached フォールバックを踏む)
    if (name === 'storage-info')
      return HttpResponse.text(
        [
          'MOUNTED=1',
          'MOUNTDEV=/dev/mmcblk0p1',
          'MOUNTFS=vfat',
          'MOUNTOPT=rw,relatime,fmask=0000',
          'DF=30735872 29360128 1375744',
          'SWAP1=/dev/zram0 65532 21024',
          'SWAP2=/media/mmc/.swapfile 131068 4096',
          'MEMTOTAL=59404',
          'MEMFREE=6120',
          'CACHED=18200',
        ].join('\n'),
      );
    if (name === 'storage-du')
      return HttpResponse.text(
        ['DU_record=25165824', 'DU_alarm_record=2097152', 'DU_time_lapse=1048576'].join('\n'),
      );
    return HttpResponse.text(statusText());
  }),

  http.post(cgi('cmd.cgi'), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { exec?: string };
    const res = body.exec ? applyExec(body.exec) : 'ok';
    return HttpResponse.text(res);
  }),

  http.get(cgi('hack_ini.cgi'), () => HttpResponse.text(hackIniText())),

  http.post(cgi('hack_ini.cgi'), async ({ request }) => {
    // 実機の hack_ini.cgi は awk で {"KEY":"value",...} の JSON を前提とし、
    // システム由来キーを除外した上でファイルを全置換する。同じ挙動を模擬して
    // クライアントが誤った形式(テキスト行)を送ると E2E で落ちるようにする。
    const body = (await request.json().catch(() => null)) as Record<string, string> | null;
    if (!body) return HttpResponse.text('bad request', { status: 400 });
    const SYSTEM_KEYS = ['appver', 'PRODUCT_MODEL', 'HOSTNAME', 'KERNELVER', 'ATOMHACKVER', 'HWADDR'];
    const next: Record<string, string> = {};
    for (const k of SYSTEM_KEYS) {
      if (k in mock.hackIni) next[k] = mock.hackIni[k];
    }
    for (const [k, v] of Object.entries(body)) {
      if (!SYSTEM_KEYS.includes(k)) next[k] = String(v);
    }
    mock.hackIni = next;
    return HttpResponse.text('ok');
  }),

  // AUTO(expmode=auto)の間は明るさ等が緩やかに揺らぎ、AUTO 可視化の
  // 「バーが動く」挙動をモックでも確認できるようにする
  http.get(cgi('video_isp.cgi'), () => {
    const base: Record<string, string> = {
      cont: '128',
      bri: '128',
      sat: '128',
      sharp: '128',
      again: '205',
      expmode: 'auto',
      ...mock.isp,
    };
    if (base.expmode === 'auto') {
      base.bri = String(128 + Math.round(24 * Math.sin(Date.now() / 3000)));
      base.cont = String(128 + Math.round(10 * Math.sin(Date.now() / 5000 + 1)));
    }
    return HttpResponse.text(
      Object.entries(base)
        .map(([k, v]) => `${k} ${v}`)
        .join('\n'),
    );
  }),


  http.post(cgi('video_isp.cgi'), async ({ request }) => {
    const text = await request.text();
    text.split('\n').forEach((line) => {
      const key = line.split(/[ \t=]/)[0]?.trim();
      if (!key) return;
      mock.isp[key] = line.replace(new RegExp(`${key}[ \t=]*`), '').trim();
    });
    return HttpResponse.text('ok');
  }),

  http.get(cgi('watermark.cgi'), () => {
    const width = 120;
    const height = 40;
    const buf = new Uint8Array(8 + width * height * 4);
    const view = new DataView(buf.buffer);
    view.setUint16(0, height, true);
    view.setUint16(4, width, true);
    return new HttpResponse(buf, { headers: { 'Content-Type': 'application/octet-stream' } });
  }),

  http.post(cgi('watermark.cgi'), () => HttpResponse.text('ok')),

  // go2rtc HomeKit（最小）
  http.get(/:1984\/api\/homekit\/pairing$/, () => HttpResponse.json({ paired: false })),

  // /sdcard: 実機は lighttpd の dir-listing が返る。モックで模擬しないと
  // SPA フォールバックが index.html を返し、iframe 内にアプリ自身が
  // 再帰表示される(合わせ鏡)ため必須。
  http.get(/\/sdcard(\/.*)?$/, ({ request }) => {
    const path = new URL(request.url).pathname.replace(/^.*\/sdcard/, '') || '/';
    const rows =
      path === '/'
        ? ['record/', 'alarm_record/', 'time_lapse/']
        : ['20260701/', '20260702/', '20260703/'];
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Index of /sdcard${path}</title>
<style>body{font:14px/1.8 system-ui;margin:16px;color:#333}a{color:#0b57d0;text-decoration:none}a:hover{text-decoration:underline}</style>
</head><body><h2>Index of /sdcard${path} (mock)</h2><hr>
${rows.map((r) => `<a href="${r}">${r}</a><br>`).join('')}
<hr></body></html>`;
    return new HttpResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }),
];
