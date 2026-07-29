import { expect, test } from '@playwright/test';

// WebUI ログイン未設定なら警告を出し、設定すると webui_auth コマンドが飛ぶ
test('WebUIログイン未設定の警告と設定操作', async ({ page }) => {
  await page.goto('/#/maintenance');

  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('WebUIログインが未設定です');
  await expect(alert).toContainText('auth key');

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
  // パスワード欄は送信後にクリアされる
  await expect(page.locator('input[type="password"]')).toHaveValue('');
});
