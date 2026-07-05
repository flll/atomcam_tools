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

// カメラ設定(sticky プレビュー+ISP 即時フィードバック)。ATOM 専用のため mockModel で上書き。
const CAMERA_URL = '/?mockModel=ATOMCAM2#/settings/camera';

for (const theme of THEMES) {
  test(`Camera ${theme}(2カラム+AUTO/マニュアル+OSD+sticky)`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
    await page.goto(CAMERA_URL);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `shots/camera-${theme}-top.png` });
    // マニュアルへ切替 → スライダー操作 → OSD チップ+比較トグル
    await page.getByRole('radio', { name: 'マニュアル' }).click();
    await page.getByRole('slider', { name: 'コントラスト' }).fill('190');
    await page.screenshot({ path: `shots/camera-${theme}-osd.png` });
    // 最下部までスクロールしてもプレビューが残る
    const sharp = page.getByRole('slider', { name: 'シャープネス' });
    await sharp.scrollIntoViewIfNeeded();
    await sharp.fill('170');
    await page.screenshot({ path: `shots/camera-${theme}-sticky.png` });
  });
}

test('Camera 比較トグル(dark)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.goto(CAMERA_URL);
  await page.waitForTimeout(1200);
  await page.getByRole('radio', { name: 'マニュアル' }).click();
  await page.getByRole('slider', { name: 'コントラスト' }).fill('210');
  const compare = page.getByTestId('compare-hold');
  await compare.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'shots/camera-dark-compare.png' });
  await compare.click();
});

test('Storage 使用状況カード(dark)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.goto('/#/settings/storage');
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: '内訳を計測' }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'shots/storage-dark-info.png', fullPage: true });
});

test.describe('カメラ設定モバイル(375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('Camera mobile(dark・sticky)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    await page.goto(CAMERA_URL);
    await page.waitForTimeout(1200);
    await page.getByRole('radio', { name: 'マニュアル' }).click();
    const sharp = page.getByRole('slider', { name: 'シャープネス' });
    await sharp.scrollIntoViewIfNeeded();
    await sharp.fill('170');
    await page.screenshot({ path: 'shots/camera-mobile-dark-sticky.png' });
  });
});
