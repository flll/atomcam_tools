import { expect, test } from '@playwright/test';

// モック環境では go2rtc(:1984) が居ないため、probe 失敗 → JPEG フォールバックが
// 常に踏まれる。実機のみの WebRTC 再生は HIL チェックリストで検証する。
test('go2rtc 不在時は JPEG ポーリングにフォールバックし映像が出る (B-1)', async ({ page }) => {
  await page.goto('/');

  // モックフレームが表示される(「映像なし」ではない)
  await expect(page.locator('img[alt="ライブビュー"]')).toBeVisible({ timeout: 15_000 });

  // fps バッジ = JPEG モード(WebRTC バッジではない)
  await expect(page.getByText(/fps/)).toBeVisible();

  // 旧文言「映像なし（モック）」が実機ビルドに残っていない (A-7)
  await expect(page.getByText('モック')).toBeHidden();
});
