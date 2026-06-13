// 実機カメラ無しでも「動いている」感を出すため、リクエスト毎に
// 時刻と移動する被写体を描いた SVG フレームを生成する。
// get_jpeg.cgi の代わりに image/svg+xml として返す（<img> はそのまま描画できる）。
export function makeFrameSvg(pan: number, tilt: number): string {
  const now = new Date();
  const t = now.getTime() / 1000;
  const ts = now.toLocaleString('ja-JP', { hour12: false });

  // パン/チルトに応じて背景の格子をずらし、被写体を周回させる。
  const gx = ((pan / 355) * 80) % 80;
  const gy = ((tilt / 180) * 80) % 80;
  const cx = 320 + Math.cos(t * 0.8) * 180;
  const cy = 300 + Math.sin(t * 1.1) * 120;
  const blink = Math.floor(t) % 2 === 0;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b1220"/>
      <stop offset="1" stop-color="#1e293b"/>
    </linearGradient>
    <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="translate(${gx} ${gy})">
      <path d="M80 0H0V80" fill="none" stroke="#334155" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="640" height="480" fill="url(#sky)"/>
  <rect width="640" height="480" fill="url(#grid)"/>
  <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="26" fill="#38bdf8" opacity="0.9"/>
  <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="40" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.4"/>
  <rect x="16" y="16" width="150" height="26" rx="4" fill="#000" opacity="0.55"/>
  <circle cx="30" cy="29" r="6" fill="${blink ? '#ef4444' : '#7f1d1d'}"/>
  <text x="44" y="34" font-family="monospace" font-size="14" fill="#fff">MOCK LIVE</text>
  <text x="16" y="468" font-family="monospace" font-size="16" fill="#e2e8f0">${ts}</text>
  <text x="500" y="34" font-family="monospace" font-size="13" fill="#94a3b8">pan ${pan} / tilt ${tilt}</text>
</svg>`;
}
