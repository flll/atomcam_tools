import { expect, test } from '@playwright/test';

// SDカード使用状況カード(cmd.cgi name=storage-info / storage-du のモック応答)。

test('マウント状態・swap・メモリが表示され、録画フォルダ内訳を計測できる', async ({ page }) => {
  await page.goto('/#/settings/storage');
  await expect(page.getByText('マウント中 (読み書き可)')).toBeVisible();
  await expect(page.getByText('スワップ: zram0')).toBeVisible();
  await expect(page.getByText('メモリ残量')).toBeVisible();

  await page.getByRole('button', { name: '内訳を計測' }).click();
  await expect(page.getByText('タイムラプス', { exact: true })).toBeVisible();
});
