import { expect, test } from '@playwright/test';

// カメラ設定ページ(ATOM 専用)。モック既定は Swing のため mockModel で機種を上書きする。
const CAMERA_URL = '/?mockModel=ATOMCAM2#/settings/camera';

test('最下部のスライダーへスクロールしてもプレビューが画面内に留まる', async ({ page }) => {
  await page.goto(CAMERA_URL);
  const preview = page.getByTestId('camera-preview');
  await expect(preview).toBeVisible();

  const slider = page.getByRole('slider', { name: /シャープネス/ });
  await slider.scrollIntoViewIfNeeded();
  await expect(slider).toBeInViewport();

  const box = await preview.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box).not.toBeNull();
  // sticky でプレビューの大部分が viewport 内に残る
  expect(box!.y).toBeGreaterThanOrEqual(-8);
  expect(box!.y).toBeLessThan(viewport.height / 2);
});

test('スライダー操作で OSD チップが出て、比較ボタンが長押しに反応する', async ({ page }) => {
  await page.goto(CAMERA_URL);
  // 変更前は比較ボタンなし
  await expect(page.getByTestId('compare-hold')).toHaveCount(0);

  const slider = page.getByRole('slider', { name: /コントラスト/ });
  await slider.fill('180');
  await expect(page.getByTestId('preview-osd')).toHaveText('コントラスト 180');

  const compare = page.getByTestId('compare-hold');
  await expect(compare).toBeVisible();
  await compare.hover();
  await page.mouse.down();
  await expect(compare).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('preview-osd')).toHaveText('変更前');
  await page.mouse.up();
  await expect(compare).toHaveAttribute('aria-pressed', 'false');
});

test('リセットボタンで初期値 128 に戻る', async ({ page }) => {
  await page.goto(CAMERA_URL);
  const slider = page.getByRole('slider', { name: /コントラスト/ });
  await slider.fill('200');
  await expect(slider).toHaveValue('200');
  await page.getByRole('button', { name: '初期値に戻す' }).click();
  await expect(slider).toHaveValue('128');
});

test.describe('モバイル(375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('設定スクロール中もプレビューが上部に固定される', async ({ page }) => {
    await page.goto(CAMERA_URL);
    const slider = page.getByRole('slider', { name: /シャープネス/ });
    await slider.scrollIntoViewIfNeeded();
    await expect(slider).toBeInViewport();
    const box = await page.getByTestId('camera-preview').boundingBox();
    expect(box).not.toBeNull();
    // モバイルヘッダー(48px)直下に留まる
    expect(box!.y).toBeGreaterThanOrEqual(40);
    expect(box!.y).toBeLessThan(120);
  });
});
