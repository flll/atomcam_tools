import { expect, test } from '@playwright/test';

test('設定変更 → 未保存バー → 保存 → 成功トースト (B-5)', async ({ page }) => {
  await page.goto('/#/settings/streaming');
  const firstSwitch = page.getByRole('switch').first();
  await expect(firstSwitch).toBeVisible();

  // 変更前は未保存バーが出ていない
  await expect(page.getByText('未保存の変更があります')).toBeHidden();

  await firstSwitch.click();
  await expect(page.getByText('未保存の変更があります')).toBeVisible();

  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await expect(page.getByText('未保存の変更があります')).toBeHidden();
});

test('破棄で変更が元に戻る', async ({ page }) => {
  await page.goto('/#/settings/streaming');
  const firstSwitch = page.getByRole('switch').first();
  const before = await firstSwitch.getAttribute('aria-checked');

  await firstSwitch.click();
  await expect(firstSwitch).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');

  await page.getByRole('button', { name: '破棄' }).click();
  await expect(page.getByText('未保存の変更があります')).toBeHidden();
  await expect(firstSwitch).toHaveAttribute('aria-checked', before ?? 'false');
});

test('保存失敗時はエラートーストが出てバーが残る (A-6)', async ({ page }) => {
  // MSW より手前で fetch を横取りし hack_ini.cgi の POST を 500 にする
  await page.addInitScript(() => {
    const orig = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      if (init?.method === 'POST' && url.includes('hack_ini.cgi')) {
        return Promise.resolve(new Response('error', { status: 500 }));
      }
      return orig(input, init);
    };
  });

  await page.goto('/#/settings/streaming');
  await page.getByRole('switch').first().click();
  await page.getByRole('button', { name: '保存', exact: true }).click();

  await expect(page.getByRole('alert')).toHaveText('保存に失敗しました');
  // 変更は失われていない
  await expect(page.getByText('未保存の変更があります')).toBeVisible();
});
