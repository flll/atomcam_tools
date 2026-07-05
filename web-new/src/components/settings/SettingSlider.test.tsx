// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SettingSlider } from './SettingSlider';

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    lng: 'ja',
    resources: {
      ja: {
        translation: {},
        ui: { settings: { defaultValue: '初期値: {{value}}', resetToDefault: '初期値に戻す' } },
      },
    },
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

  it('disabled のとき input が無効になり、リセットも出ない', () => {
    const { container } = render(
      <SettingSlider i18nKey="AdvancedSettings.contrast" value={200} min={0} max={255} defaultValue={128} disabled onChange={() => {}} />,
    );
    expect(container.querySelector('input')!.disabled).toBe(true);
    expect(container.querySelector('[aria-label="初期値に戻す"]')).toBeNull();
  });

  it('初期値からズレているときだけリセットボタンが出て、押すと初期値が渡る', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <SettingSlider i18nKey="AdvancedSettings.contrast" value={128} min={0} max={255} defaultValue={128} onChange={onChange} />,
    );
    const reset = () => container.querySelector<HTMLElement>('[aria-label="初期値に戻す"]');
    expect(reset()).toBeNull();
    rerender(
      <SettingSlider i18nKey="AdvancedSettings.contrast" value={200} min={0} max={255} defaultValue={128} onChange={onChange} />,
    );
    fireEvent.click(reset()!);
    expect(onChange).toHaveBeenCalledWith(128);
  });
});
