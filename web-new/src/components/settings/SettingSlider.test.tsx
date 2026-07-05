// @vitest-environment jsdom
import { render } from '@testing-library/react';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import { SettingSlider } from './SettingSlider';

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    lng: 'ja',
    resources: { ja: { translation: {}, ui: { settings: { defaultValue: '初期値: {{value}}' } } } },
  });
});

describe('SettingSlider 初期値マーカー', () => {
  it('defaultValue 指定でマーカーが初期値位置に出る(128/255 ≒ 50.2%)', () => {
    const { container } = render(
      <SettingSlider i18nKey="AdvancedSettings.contrast" value={128} min={0} max={255} defaultValue={128} onChange={() => {}} />,
    );
    const marker = container.querySelector<HTMLElement>('[data-testid="default-marker"]');
    expect(marker).not.toBeNull();
    expect(marker!.style.left).toContain('50.2%');
  });

  it('defaultValue 未指定ではマーカーを出さない', () => {
    const { container } = render(
      <SettingSlider i18nKey="AdvancedSettings.contrast" value={128} min={0} max={255} onChange={() => {}} />,
    );
    expect(container.querySelector('[data-testid="default-marker"]')).toBeNull();
  });

  it('現在値が初期値と異なるときだけ値ラベルを強調する', () => {
    const { container, rerender } = render(
      <SettingSlider i18nKey="AdvancedSettings.contrast" value={128} min={0} max={255} defaultValue={128} onChange={() => {}} />,
    );
    const label = () => container.querySelector<HTMLElement>('.font-mono')!;
    expect(label().className).not.toContain('text-primary');
    rerender(
      <SettingSlider i18nKey="AdvancedSettings.contrast" value={200} min={0} max={255} defaultValue={128} onChange={() => {}} />,
    );
    expect(label().className).toContain('text-primary');
    expect(label().textContent).toBe('200');
  });
});
