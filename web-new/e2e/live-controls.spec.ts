import { expect, test } from '@playwright/test';

// Live 没入型プレイヤーのコントロール挙動。
// モック機種は ATOM_CAKP1JZJP(Swing) = PTZ あり。

test('コントロールバーはアイドルで隠れ、操作で再表示される', async ({ page }) => {
  await page.goto('/');
  const bar = page.getByTestId('player-controls');
  await expect(bar).toBeVisible();
  // 3秒アイドルで自動非表示
  await expect(bar).toBeHidden({ timeout: 6000 });
  await page.mouse.move(400, 300);
  await page.mouse.move(430, 320);
  await expect(bar).toBeVisible();
});

test('ナイトビジョンは radiogroup で切替わり、ページ往復後も維持される', async ({ page }) => {
  await page.goto('/');
  await page.mouse.move(400, 300);
  const group = page.getByRole('radiogroup', { name: 'ナイトビジョン' });
  await expect(group.getByRole('radio', { name: 'AUTO' })).toHaveAttribute('aria-checked', 'true');

  await group.getByRole('radio', { name: 'on' }).click();
  await expect(group.getByRole('radio', { name: 'on' })).toHaveAttribute('aria-checked', 'true');

  // SPA 内往復 → mock property から復元される
  await page.locator('aside').getByRole('link', { name: '録画' }).click();
  await page.locator('aside').getByRole('link', { name: 'ライブ' }).click();
  await page.mouse.move(400, 300);
  await expect(
    page.getByRole('radiogroup', { name: 'ナイトビジョン' }).getByRole('radio', { name: 'on' }),
  ).toHaveAttribute('aria-checked', 'true');
});

test('フルスクリーンボタンが aria-label 付きで存在する', async ({ page }) => {
  await page.goto('/');
  await page.mouse.move(400, 300);
  await expect(page.getByRole('button', { name: 'フルスクリーン' })).toBeVisible();
});

test('シアターモード: T で全画面化し Escape で戻る', async ({ page }) => {
  await page.goto('/');
  // lazy ロードされる Live のマウント(キーリスナー登録)を待ってから押す
  await expect(page.getByTestId('live-stage')).toBeVisible();
  await page.keyboard.press('t');
  await expect(page.getByTestId('live-stage')).toHaveClass(/fixed/);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('live-stage')).not.toHaveClass(/fixed/);
});

test.describe('モバイル(375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('PTZ ボタンでボトムシートが開閉する', async ({ page }) => {
    await page.goto('/');
    await page.mouse.move(180, 120);
    await page.getByRole('button', { name: 'パン/チルト操作' }).click();
    const dialog = page.getByRole('dialog', { name: 'パン / チルト' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '閉じる' }).click();
    await expect(dialog).toBeHidden();
  });
});
