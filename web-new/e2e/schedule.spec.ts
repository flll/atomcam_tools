import { expect, test } from '@playwright/test';

test('録画スケジュールの追加・保存・SPA 内往復で復元 (A-1/A-2/A-5)', async ({ page }) => {
  await page.goto('/#/settings/recording');

  // 録画スケジュールを有効化 → エディタ表示
  await page.getByRole('switch', { name: '録画スケジュール' }).click();
  await page.getByRole('button', { name: '追加' }).click();

  const start = page.locator('input[type="time"]').first();
  await start.fill('06:30');

  // スケジュール変更だけで保存バーが有効になる(A-1 回帰)
  const save = page.getByRole('button', { name: '保存', exact: true });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByRole('status')).toHaveText('保存しました');

  // SPA 内で別ページへ行って戻る → MSW store から復元される(A-2 回帰)
  await page.locator('aside').getByRole('link', { name: 'ライブ' }).click();
  await page.locator('aside').getByRole('link', { name: '録画' }).click();
  await expect(page.locator('input[type="time"]').first()).toHaveValue('06:30');
});

test('不正なスケジュールでは保存できずエラー表示 (A-5)', async ({ page }) => {
  await page.goto('/#/settings/recording');
  await page.getByRole('switch', { name: '録画スケジュール' }).click();
  await page.getByRole('button', { name: '追加' }).click();

  // 終了 < 開始
  await page.locator('input[type="time"]').nth(0).fill('10:00');
  await page.locator('input[type="time"]').nth(1).fill('09:00');
  await expect(page.getByText('終了時間は開始時間より後にしてください')).toBeVisible();
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled();

  // 曜日を全て外す
  await page.locator('input[type="time"]').nth(1).fill('11:00');
  const chips = page.getByRole('group').first().getByRole('button');
  const count = await chips.count();
  for (let i = 0; i < count; i++) await chips.nth(i).click();
  await expect(page.getByText('曜日を1つ以上選択してください')).toBeVisible();
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled();
});

// NAS録画トグルが各録画セクションに存在し、開くと保存PATH・未設定警告が現れる
test('録画ページに NAS録画 が追加されている', async ({ page }) => {
  for (const path of ['/#/settings/recording', '/#/settings/recording/alarm', '/#/settings/recording/timelapse']) {
    await page.goto(path);
    const nas = page.getByRole('switch', { name: /^NAS録画 / });
    await expect(nas).toHaveCount(1);
  }
  await page.goto('/#/settings/recording');
  await page.getByRole('switch', { name: /^NAS録画 / }).click();
  await expect(page.getByRole('textbox', { name: /^保存するPATH / })).toBeVisible();
  await expect(page.getByText('NASサーバが未設定です', { exact: false })).toBeVisible();
});
