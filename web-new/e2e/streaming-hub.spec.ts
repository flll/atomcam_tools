import { expect, test } from '@playwright/test';

// 配信・連携ハブ。HEVC(詳細設定)は ATOM 専用のため mockModel で上書きする。
const HUB_URL = '/?mockModel=ATOMCAM2#/settings/streaming';

test.describe('配信・連携ハブ', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('連携カード3枚が並び、Frigate 設定例に実パス(_unicast)が入りコピーできる', async ({ page }) => {
    await page.goto(HUB_URL);
    for (const name of ['Frigate', 'Home Assistant', 'Apple Home (HomeKit)']) {
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

test('ライブ配信: 配信先タイルを選ぶとURL雛形が入り手順が出る(重複カードなし)', async ({ page }) => {
  await page.goto('/#/settings/streaming');

  // 統合前は「ライブ配信 (YouTube Live 等)」と「ライブ配信ガイド」が二重にあった
  await expect(page.getByRole('heading', { name: 'ライブ配信', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /ライブ配信 \(YouTube/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'ライブ配信ガイド' })).toHaveCount(0);

  // 4サイトのタイル
  for (const name of ['YouTube Live', 'Twitch', 'ニコニコ生放送', 'Facebook Live']) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }

  // 選ぶと URL 雛形が入り、その配信先の手順が出る
  await page.getByRole('button', { name: /YouTube Live/ }).click();
  await expect(page.getByRole('textbox', { name: /^URL / })).toHaveValue(
    'rtmp://a.rtmp.youtube.com/live2/YOUR_STREAM_KEY',
  );
  await expect(page.getByText('YouTube Live へつなぐ手順')).toBeVisible();
  await expect(page.getByText('未保存の変更があります')).toBeVisible();

  // 別サイトに切り替えると手順もURLも入れ替わる
  await page.getByRole('button', { name: /Twitch/ }).click();
  await expect(page.getByRole('textbox', { name: /^URL / })).toHaveValue(
    'rtmp://live.twitch.tv/app/YOUR_STREAM_KEY',
  );
  await expect(page.getByText('Twitch へつなぐ手順')).toBeVisible();
});
