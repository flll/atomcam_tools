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
    return HttpResponse.text(statusText());
  }),

  http.post(cgi('cmd.cgi'), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { exec?: string };
    const res = body.exec ? applyExec(body.exec) : 'ok';
    return HttpResponse.text(res);
  }),

  http.get(cgi('hack_ini.cgi'), () => HttpResponse.text(hackIniText())),

  http.post(cgi('hack_ini.cgi'), async ({ request }) => {
    const text = await request.text();
    text.split('\n').forEach((line) => {
      const key = line.split(/[ \t=]/)[0]?.trim();
      if (!key) return;
      mock.hackIni[key] = line.replace(new RegExp(`${key}[ \t=]*`), '').trim();
    });
    return HttpResponse.text('ok');
  }),

  http.get(cgi('video_isp.cgi'), () =>
    HttpResponse.text(
      ['cont 128', 'bri 128', 'sat 128', 'sharp 128', 'again 205', 'expmode auto'].join('\n'),
    ),
  ),


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
];
