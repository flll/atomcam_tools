import { expect, test } from '@playwright/test';

// 言語メニュー(8言語)。既定はブラウザ locale=ja-JP なので日本語で始まる。

test('言語メニューから簡体字中国語へ切替でき、リロード後も維持される', async ({ page }) => {
  await page.goto('/');
  const rail = page.locator('aside');
  await rail.getByRole('button', { name: '言語' }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitemradio', { name: '日本語' })).toHaveAttribute('aria-checked', 'true');

  await menu.getByRole('menuitemradio', { name: '简体中文' }).click();
  // ナビゲーションが中国語になる
  await expect(rail.getByRole('link', { name: '直播' })).toBeVisible();

  // localStorage 永続化 → リロード後も中国語
  await page.reload();
  await expect(rail.getByRole('link', { name: '直播' })).toBeVisible();
  await rail.getByRole('button', { name: '语言' }).click();
  await expect(page.getByRole('menuitemradio', { name: '简体中文' })).toHaveAttribute('aria-checked', 'true');
});

test('全8言語がメニューに並び、外側クリックで閉じる', async ({ page }) => {
  await page.goto('/');
  await page.locator('aside').getByRole('button', { name: '言語' }).click();
  const items = page.getByRole('menuitemradio');
  await expect(items).toHaveCount(8);
  for (const label of ['日本語', 'English', '简体中文', '한국어', 'Español', 'Français', 'Deutsch', 'Português']) {
    await expect(page.getByRole('menuitemradio', { name: label })).toBeVisible();
  }
  await page.mouse.click(600, 400);
  await expect(page.getByRole('menu')).toBeHidden();
});
