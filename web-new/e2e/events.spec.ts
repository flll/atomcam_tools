import { expect, test } from '@playwright/test';

// イベント通知(WebHook + MQTT + テスト送信)。モック既定は WEBHOOK_URL 空。
const URL = '/?mockModel=ATOMCAM2#/settings/events';

test('WebHook/MQTT/通知イベントのカードが並ぶ', async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByRole('heading', { name: 'WebHook' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'MQTT' })).toBeVisible();
  // 実装済みイベントが露出している(動体検知トグル。名前先頭で他項目と区別)
  await expect(page.getByRole('switch', { name: /^動体検知 / })).toBeVisible();
});

test('MQTT を有効化するとブローカー設定が現れる', async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByRole('textbox', { name: /ブローカーのアドレス/ })).toHaveCount(0);
  await page.getByRole('switch', { name: 'MQTT有効化' }).click();
  await expect(page.getByRole('textbox', { name: /ブローカーのアドレス/ })).toBeVisible();
});

test('テスト送信ボタンは宛先未設定なら無効、URL を入れると押せて結果が出る', async ({ page }) => {
  await page.goto(URL);
  const btn = page.getByRole('button', { name: 'テスト送信' });
  await expect(btn).toBeDisabled();

  await page.getByRole('textbox', { name: /通知URL/ }).fill('http://example.test/hook');
  await expect(btn).toBeEnabled();
  // フローティングの未保存バーがボタンに重なるため、キーボードで発火する
  await btn.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/送信成功|送信失敗/)).toBeVisible();
});
