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

test('有効化すると接続ステータス・連携カード・ACLスニペットが出る', async ({ page }) => {
  await page.goto('/#/settings/system/tailscale');
  await page.getByRole('switch', { name: /^Tailscale有効化 / }).click();

  // 接続ステータス(モックは Running を返す)
  await expect(page.getByRole('heading', { name: '接続状態' })).toBeVisible();
  await expect(page.getByText('接続済み')).toBeVisible();
  await expect(page.getByText('100.101.102.103')).toBeVisible();

  // 管理コンソール/デバイスへのアクセスボタン
  await expect(page.getByRole('link', { name: '管理コンソール', exact: true })).toBeVisible();

  // ACL スニペット(tag:cctv に 8554)
  await page.getByText('設定例を表示').last().click();
  const pre = page.locator('pre').last();
  await expect(pre).toContainText('tag:cctv');
  await expect(pre).toContainText('8554');
});
