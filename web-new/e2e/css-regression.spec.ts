import { expect, test } from '@playwright/test';

// 過去に実機で発生した「CSS 404 で真っ白」の再発防止。
// lighttpd-sim が実機と同じ gzip-only 配信をするため、ビルド成果物と
// 配信規則の不整合(参照ファイル欠落・rewrite 非互換)をここで検知する。
test('スタイルが適用され、アセットに 404 がない', async ({ page }) => {
  const failed: string[] = [];
  page.on('response', (res) => {
    // go2rtc(:1984) はモック外なので除外
    if (res.status() >= 400 && !res.url().includes(':1984')) {
      failed.push(`${res.status()} ${res.url()}`);
    }
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Tailwind が当たっている(既定の透明背景ではない)
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).not.toBe('rgba(0, 0, 0, 0)');

  const sheets = await page.evaluate(() => document.styleSheets.length);
  expect(sheets).toBeGreaterThanOrEqual(1);

  expect(failed).toEqual([]);
});
