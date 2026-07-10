import { expect, test } from '@playwright/test';

// 配信・連携ハブ。HEVC(詳細設定)は ATOM 専用のため mockModel で上書きする。
const HUB_URL = '/?mockModel=ATOMCAM2#/settings/streaming';

test.describe('配信・連携ハブ', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('連携カード4枚が並び、Frigate 設定例に実パス(_unicast)が入りコピーできる', async ({ page }) => {
    await page.goto(HUB_URL);
    for (const name of ['Frigate', 'Home Assistant', 'ライブ配信 (YouTube Live 等)', 'Apple Home (HomeKit)']) {
      await expect(page.getByRole('heading', { name })).toBeVisible();
    }

    await page.getByText('設定例を表示').first().click();
    const pre = page.locator('pre').first();
    // 実機 ffprobe で確認した実パス videoN_unicast(/videoN は 404)
    await expect(pre).toContainText('video0_unicast');
    await expect(pre).toContainText('video1_unicast');
    await expect(pre).toContainText('- detect');
    await expect(pre).toContainText('- record');

    await pre.locator('..').getByRole('button', { name: 'コピー' }).click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain('go2rtc:');
  });

  test('メモリ警告は多重有効化のときだけ出る', async ({ page }) => {
    await page.goto(HUB_URL);
    // モック既定: メインのみ on + WebRTC on → 警告なし
    await expect(page.getByTestId('mem-warn')).toHaveCount(0);
    // サブも on → 2ストリーム+WebRTC → 警告
    await page.getByRole('switch', { name: /サブ配信/ }).click();
    await expect(page.getByTestId('mem-warn')).toBeVisible();
  });

  test('詳細設定は既定で畳まれ、開くと HEVC と RTSP over HTTP が現れる', async ({ page }) => {
    await page.goto(HUB_URL);
    const hevc = page.getByRole('switch', { name: /HEVC/ });
    const overHttp = page.getByRole('switch', { name: /RTSP over HTTP/ });
    await expect(hevc).not.toBeVisible();
    await expect(overHttp).not.toBeVisible();
    await page.getByText('詳細設定').click();
    await expect(hevc).toBeVisible();
    await expect(overHttp).toBeVisible();
  });

  test('メイン配信 URL の QR コードを表示できる', async ({ page }) => {
    await page.goto(HUB_URL);
    await page.getByRole('button', { name: 'QRコード' }).first().click();
    await expect(page.getByTestId('qr-popover').locator('svg')).toBeVisible();
  });
});
