import { expect, test } from '@playwright/test';

// モック機種は ATOM_CAKP1JZJP(Swing) — カメラ設定は非表示、クルーズは表示
const PAGES: { label: string; hash: string }[] = [
  { label: '録画', hash: '#/settings/recording' },
  { label: 'ストレージ', hash: '#/settings/storage' },
  { label: '配信', hash: '#/settings/streaming' },
  { label: 'イベント通知', hash: '#/settings/events' },
  { label: 'クルーズ', hash: '#/settings/cruise' },
  { label: 'システム', hash: '#/settings/system' },
  { label: 'SDカード', hash: '#/files' },
  { label: 'メンテナンス', hash: '#/maintenance' },
];

test('デスクトップ: サイドバーから全ページに到達できる', async ({ page }) => {
  await page.goto('/');
  const sidebar = page.locator('aside');
  await expect(sidebar.getByRole('link', { name: 'ライブ' })).toBeVisible();
  // グループ見出し
  await expect(sidebar.getByText('設定', { exact: true })).toBeVisible();
  await expect(sidebar.getByText('ツール', { exact: true })).toBeVisible();

  for (const { label, hash } of PAGES) {
    await sidebar.getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(new RegExp(hash.replace('/', '\\/')));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});

test.describe('モバイル(375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('ボトムナビ+「その他」シートから全ページに到達できる (A-4)', async ({ page }) => {
    await page.goto('/');
    const bottomNav = page.locator('nav.fixed');

    // primary 3 + その他
    for (const label of ['ライブ', '録画', '配信']) {
      await expect(bottomNav.getByRole('link', { name: label })).toBeVisible();
    }
    const moreButton = bottomNav.getByRole('button', { name: 'その他' });
    await expect(moreButton).toBeVisible();

    // 「その他」シート経由で残りページへ(2タップ以内)
    for (const { label, hash } of PAGES) {
      await moreButton.click();
      const sheet = page.getByRole('dialog');
      await sheet.getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(new RegExp(hash.replace('/', '\\/')));
      await expect(page.getByRole('dialog')).toBeHidden();
    }
  });
});
