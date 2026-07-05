import { expect, test } from '@playwright/test';

// カメラ設定ページ(ATOM 専用)。モック既定は Swing のため mockModel で機種を上書きする。
const CAMERA_URL = '/?mockModel=ATOMCAM2#/settings/camera';

test('最下部のスライダーへスクロールしてもプレビューが画面内に留まる', async ({ page }) => {
  await page.goto(CAMERA_URL);
  const preview = page.getByTestId('camera-preview');
  await expect(preview).toBeVisible();

  const slider = page.getByRole('slider', { name: 'シャープネス' });
  await slider.scrollIntoViewIfNeeded();
  await expect(slider).toBeInViewport();

  const box = await preview.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box).not.toBeNull();
  // sticky でプレビューの大部分が viewport 内に残る
  expect(box!.y).toBeGreaterThanOrEqual(-8);
  expect(box!.y).toBeLessThan(viewport.height / 2);
});

test('AUTO ではスライダー操作不可、マニュアル切替で操作でき OSD が出る', async ({ page }) => {
  await page.goto(CAMERA_URL);
  const slider = page.getByRole('slider', { name: 'コントラスト' });
  // 既定は AUTO(モックの expmode=auto)
  await expect(slider).toBeDisabled();

  await page.getByRole('radio', { name: 'マニュアル' }).click();
  await expect(slider).toBeEnabled();

  await slider.fill('180');
  await expect(page.getByTestId('preview-osd')).toHaveText('コントラスト 180');

  // AUTO に戻すと再び操作不可
  await page.getByRole('radio', { name: 'AUTO' }).click();
  await expect(slider).toBeDisabled();
});

test('比較トグルで変更前⇄変更後を切り替えられる', async ({ page }) => {
  await page.goto(CAMERA_URL);
  await page.getByRole('radio', { name: 'マニュアル' }).click();
  const slider = page.getByRole('slider', { name: 'コントラスト' });
  await slider.fill('200');

  const compare = page.getByTestId('compare-hold');
  await expect(compare).toBeVisible();
  await compare.click();
  await expect(compare).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('preview-osd')).toHaveText('変更前');
  // 比較中はスライダー操作不可
  await expect(slider).toBeDisabled();

  await compare.click();
  await expect(compare).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('preview-osd')).toHaveText('変更後');
  await expect(slider).toBeEnabled();
});

test('言語メニューが sticky プレビューより前面に出て操作できる', async ({ page }) => {
  await page.goto(CAMERA_URL);
  await page.locator('aside').getByRole('button', { name: '言語' }).click();
  // z-index が誤っていると sticky プレビューに覆われ click が失敗する
  await page.getByRole('menuitemradio', { name: 'English' }).click();
  await expect(page.locator('aside').getByRole('link', { name: 'Camera' })).toBeVisible();
});

test.describe('モバイル(375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('設定スクロール中もプレビューが上部に固定される', async ({ page }) => {
    await page.goto(CAMERA_URL);
    const slider = page.getByRole('slider', { name: 'シャープネス' });
    await slider.scrollIntoViewIfNeeded();
    await expect(slider).toBeInViewport();
    const box = await page.getByTestId('camera-preview').boundingBox();
    expect(box).not.toBeNull();
    // モバイルヘッダー(48px)直下に留まる
    expect(box!.y).toBeGreaterThanOrEqual(40);
    expect(box!.y).toBeLessThan(120);
  });
});
