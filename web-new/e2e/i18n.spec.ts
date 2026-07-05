import { expect, test } from '@playwright/test';

test('言語切替で UI 文言が ja ⇄ en で切り替わる', async ({ page }) => {
  await page.goto('/');
  const sidebar = page.locator('aside');
  await expect(sidebar.getByRole('link', { name: 'メンテナンス' })).toBeVisible();

  // 言語メニューから English を選択
  await sidebar.getByRole('button', { name: '言語' }).click();
  await page.getByRole('menuitemradio', { name: 'English' }).click();
  await expect(sidebar.getByRole('link', { name: 'Maintenance' })).toBeVisible();

  // 日本語へ戻す
  await sidebar.getByRole('button', { name: 'Language' }).click();
  await page.getByRole('menuitemradio', { name: '日本語' }).click();
  await expect(sidebar.getByRole('link', { name: 'メンテナンス' })).toBeVisible();
});
