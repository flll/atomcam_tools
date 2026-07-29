import { expect, test } from '@playwright/test';

// WebUI ログイン必須ゲート: 未設定なら全画面で設定を求め、設定するとコマンドが飛ぶ
test('ログイン未設定なら全画面ゲートが出て、設定操作でコマンドが飛ぶ', async ({ page }) => {
  await page.goto('/?mockAuth=off#/settings/recording');

  await expect(page.getByRole('heading', { name: '最初にWebUIログインを設定してください' })).toBeVisible();

  const reqs: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('cmd.cgi') && !r.url().includes('port=socket')) {
      const body = r.postDataJSON() as { exec?: string };
      if (body.exec) reqs.push(body.exec);
    }
  });

  await page.getByRole('textbox', { name: 'ユーザー名' }).fill('admin');
  await page.locator('input[type="password"]').fill('s3cret');
  await page.getByRole('button', { name: 'ログインを設定' }).click();

  expect(reqs).toContain('webui_auth set admin s3cret');
  // モックが enabled になり、ポーリングでゲートが閉じる(コンポーネントは3秒後に再取得)
  await expect(page.getByRole('heading', { name: '最初にWebUIログインを設定してください' })).toBeHidden({ timeout: 15000 });
});

// 認証済み(既定モック)ならゲートは出ず、メンテナンスに警告も出ない
test('ログイン設定済みならゲート・警告なし', async ({ page }) => {
  await page.goto('/#/maintenance');
  await expect(page.getByRole('heading', { name: 'メンテナンス' })).toBeVisible();
  await expect(page.getByText('WebUIログインが未設定です')).toHaveCount(0);
});

// ページ遷移でスクロール位置がリセットされる
test('ページ遷移で先頭にスクロールする', async ({ page }) => {
  await page.goto('/#/settings/streaming');
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.getByRole('link', { name: 'Tailscale' }).click();
  await expect(page).toHaveURL(/tailscale/);
  await expect
    .poll(async () => page.evaluate(() => window.scrollY), { timeout: 3000 })
    .toBeLessThan(50);
});
