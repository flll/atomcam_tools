import { test } from '@playwright/test';

// ユーザーレビュー用スクリーンショット収集(M2/M3 マイルストーン)。
// 通常の CI では skip。実行: SCREENS=1 npx playwright test e2e/screenshots.spec.ts
test.skip(process.env.SCREENS !== '1', 'SCREENS=1 のときだけ実行');

const THEMES = ['dark', 'light'] as const;

for (const theme of THEMES) {
  test(`Live ${theme}(コントロール表示/非表示)`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
    await page.goto('/');
    await page.waitForTimeout(1500);
    await page.mouse.move(520, 320);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `shots/live-${theme}-controls.png` });
    await page.mouse.move(0, 0);
    await page.waitForTimeout(3800);
    await page.screenshot({ path: `shots/live-${theme}-idle.png` });
  });

  test(`Storage ${theme}`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
    await page.goto('/#/settings/storage');
    await page.waitForTimeout(900);
    await page.screenshot({ path: `shots/storage-${theme}.png`, fullPage: true });
  });
}

test('Live PTZ パネル(dark)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.goto('/');
  await page.waitForTimeout(1200);
  await page.mouse.move(520, 320);
  await page.getByRole('button', { name: 'パン/チルト操作' }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'shots/live-dark-ptz.png' });
});

test.describe('モバイル(375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('Live + Storage mobile(dark)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    await page.goto('/');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'shots/live-mobile-dark.png' });
    await page.goto('/#/settings/storage');
    await page.waitForTimeout(900);
    await page.screenshot({ path: 'shots/storage-mobile-dark.png' });
  });
});
