import { expect, test } from '@playwright/test';

// WebUI ログイン必須: 未設定なら専用ページ /setup へ強制リダイレクトされ、
// 設定するとコマンドが飛び、認証済みになるとライブへ戻る
test('ログイン未設定なら /setup へ強制遷移し、設定で復帰する', async ({ page }) => {
  await page.goto('/?mockAuth=off#/settings/recording');

  await expect(page).toHaveURL(/#\/setup/);
  await expect(page.getByRole('heading', { name: '最初にWebUIログインを設定してください' })).toBeVisible();
  // 専用ページはナビゲーションを出さない
  await expect(page.getByRole('link', { name: 'ライブ' })).toHaveCount(0);

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
  // モックが enabled になり、ポーリングでライブへ戻る
  await expect(page).toHaveURL(/#\/$/, { timeout: 15000 });
});

// 認証済み(既定モック)なら /setup へ飛ばされない
test('ログイン設定済みならリダイレクトされない', async ({ page }) => {
  await page.goto('/#/maintenance');
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/#\/maintenance/);
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
