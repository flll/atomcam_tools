import { expect, test } from '@playwright/test';

test('言語切替で UI 文言が ja ⇄ en で切り替わる', async ({ page }) => {
  await page.goto('/');
  const sidebar = page.locator('aside');
  await expect(sidebar.getByRole('link', { name: 'メンテナンス' })).toBeVisible();

  await page.getByRole('button', { name: '言語' }).click();
  await expect(sidebar.getByRole('link', { name: 'Maintenance' })).toBeVisible();

  await page.getByRole('button', { name: 'Language' }).click();
  await expect(sidebar.getByRole('link', { name: 'メンテナンス' })).toBeVisible();
});
