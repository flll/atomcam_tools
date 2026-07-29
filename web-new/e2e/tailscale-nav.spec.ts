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

  // 保存すると trial-start(デッドマンスイッチ)→hack.ini 書込→restart の順で送られる
  const reqs: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('cmd.cgi') && !r.url().includes('port=socket')) {
      const body = r.postDataJSON() as { exec?: string };
      if (body.exec) reqs.push(body.exec);
    }
  });
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('Tailscale 設定を適用しています', { exact: false })).toBeVisible();
  expect(reqs).toContain('tailscale trial-start 120');
  expect(reqs).toContain('tailscale restart');
  // トライアルを確定すると警告も消える(保存済み値と一致)
  await page.getByRole('alertdialog').getByRole('button', { name: '維持されています(確定)' }).click();
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

  const reqs: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('cmd.cgi') && !r.url().includes('port=socket')) {
      const body = r.postDataJSON() as { exec?: string };
      if (body.exec) reqs.push(body.exec);
    }
  });
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  expect(reqs).toContain('tailscale trial-start 120');
  expect(reqs).toContain('tailscale stop');
  await page.getByRole('alertdialog').getByRole('button', { name: '維持されています(確定)' }).click();
});

// 締め出しリスク変更の保存で「接続は維持されていますか?」ダイアログが出る(デッドマンスイッチ)
test('リスク変更の保存でトライアルダイアログが出て、確定で閉じる', async ({ page }) => {
  await page.goto('/#/settings/system/tailscale');
  await page.getByRole('switch', { name: /^Tailscale有効化 / }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('未保存の変更があります')).toBeHidden();

  await page.getByRole('textbox', { name: /^タグ / }).fill('tag:server');
  await page.getByRole('button', { name: '保存', exact: true }).click();

  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('接続は維持されていますか?');
  await expect(dialog).toContainText(/秒後に自動的に元の設定へ戻ります/);

  await dialog.getByRole('button', { name: '維持されています(確定)' }).click();
  await expect(dialog).toBeHidden();
});

// 「今すぐ元に戻す」で巻き戻しが送られ、ダイアログが閉じる
test('トライアルの今すぐ元に戻すで復元コマンドが飛ぶ', async ({ page }) => {
  await page.goto('/#/settings/system/tailscale');
  await page.getByRole('switch', { name: /^Tailscale有効化 / }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('未保存の変更があります')).toBeHidden();

  await page.getByRole('textbox', { name: /^タグ / }).fill('tag:oops');
  const reqs: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('cmd.cgi') && !r.url().includes('port=socket')) {
      const body = r.postDataJSON() as { exec?: string };
      if (body.exec) reqs.push(body.exec);
    }
  });
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '今すぐ元に戻す' }).click();
  await expect(dialog).toBeHidden();
  expect(reqs).toContain('tailscale trial-start 120');
  expect(reqs).toContain('tailscale restart');
  expect(reqs).toContain('tailscale trial-revert');
});

// 秘密値の再表示脆弱性の回帰テスト: 「変更」→「破棄」しても保存済みの生キーが
// input の value に復活しない(マスク表示へ戻る)
test('auth key は 変更→破棄 で生値が input に復活しない', async ({ page }) => {
  await page.goto('/#/settings/system/tailscale');
  await page.getByRole('switch', { name: /^Tailscale有効化 / }).click();
  const input = page.locator('input[type="password"]');
  await input.fill('tskey-auth-k1secretsecretsecret123');
  // 初回の auth key 入力は締め出しリスクではないのでトライアルは出ない
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('未保存の変更があります')).toBeHidden();

  // 保存後はマスク表示
  await expect(page.getByText(/••••/).first()).toBeVisible();
  // 変更 → 破棄
  await page.getByRole('button', { name: '変更', exact: true }).click();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await page.getByRole('button', { name: '破棄' }).click();
  // マスク表示に戻り、DOM のどの input にも生キーが存在しない
  await expect(page.getByText(/••••/).first()).toBeVisible();
  const leaked = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input')).some((i) => i.value.includes('secretsecret')),
  );
  expect(leaked).toBe(false);
});
