import { chromium } from '@playwright/test';
const b = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 1000, height: 1500 }, locale: 'ja-JP' });
  const p = await ctx.newPage();
  await p.addInitScript((t) => localStorage.setItem('theme', t), theme);
  // Tailscale ページ(有効化してステータス・連携カードを表示)
  await p.goto('http://127.0.0.1:4198/?mockModel=ATOMCAM2#/settings/system/tailscale', { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  await p.getByRole('switch', { name: /^Tailscale有効化 / }).click();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `shots/design/ts-page-${theme}.png`, fullPage: true });
  // Maintenance ページ(ボタン配置修正の確認)
  await p.goto('http://127.0.0.1:4198/?mockModel=ATOMCAM2#/maintenance', { waitUntil: 'load' });
  await p.waitForTimeout(1000);
  await p.screenshot({ path: `shots/design/maint-${theme}.png`, clip: { x: 0, y: 0, width: 1000, height: 800 } });
  await ctx.close();
}
await b.close();
console.log('done');
