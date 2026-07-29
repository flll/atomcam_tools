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

// タグ等の締め出しリスクがある編集は保存前に警告し、保存すると適用コマンドが飛ぶ
test('タグ変更で締め出し警告が出て、保存で適用される', async ({ page }) => {
  await page.goto('/#/settings/system/tailscale');
  await page.getByRole('switch', { name: /^Tailscale有効化 / }).click();

  // 有効化しただけでは警告は出ない
  await expect(page.getByRole('alert')).toHaveCount(0);

  const tags = page.getByRole('textbox', { name: /^タグ / });
  await tags.fill('tag:server');

  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('タグの変更');

  // 保存すると hack.ini 書込に加えて tailscale restart(FIFO)が送られ、適用中トーストが出る
  const applyReq = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().includes('cmd.cgi') && !req.url().includes('port=socket'),
  );
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const req = await applyReq;
  expect(req.postDataJSON()).toEqual({ exec: 'tailscale restart' });
  await expect(page.getByText('Tailscale 設定を適用しています', { exact: false })).toBeVisible();
  // 警告は保存済み値と一致した時点で消える
  await expect(page.getByRole('alert')).toHaveCount(0);
});

// 無効化にも警告が出て、保存では stop が送られる
test('無効化で警告が出て、保存で stop が送られる', async ({ page }) => {
  await page.goto('/#/settings/system/tailscale');
  const enable = page.getByRole('switch', { name: /^Tailscale有効化 / });
  await enable.click(); // on
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('未保存の変更があります')).toBeHidden();

  await enable.click(); // off に戻す = disable リスク
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('無効化');

  const applyReq = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().includes('cmd.cgi') && !req.url().includes('port=socket'),
  );
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const req = await applyReq;
  expect(req.postDataJSON()).toEqual({ exec: 'tailscale stop' });
});
