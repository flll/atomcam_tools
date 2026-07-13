import { expect, test } from '@playwright/test';

// Tailscale 設定はナビの独立項目から到達する(以前はルート設定ミスで到達不能だった回帰テスト)
test('ナビから Tailscale 設定に到達できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Tailscale' }).click();
  await expect(page).toHaveURL(/settings\/system\/tailscale/);
  await expect(page.getByRole('switch', { name: /^Tailscale有効化 / })).toBeVisible();
  // システム設定(device)セクションは表示されない(専用ページ)
  await expect(page.getByRole('heading', { name: 'ビデオ設定' })).toHaveCount(0);
});
