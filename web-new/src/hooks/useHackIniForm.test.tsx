// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HackIni } from '@/api';
import { useHackIniForm } from './useHackIniForm';

const mocks = vi.hoisted(() => ({
  config: { A: '1', B: '2' } as HackIni,
  save: vi.fn(() => Promise.resolve()),
}));

vi.mock('./useHackIni', () => ({
  useHackIni: () => ({
    config: mocks.config,
    isLoading: false,
    error: undefined,
    save: mocks.save,
  }),
}));

describe('useHackIniForm', () => {
  beforeEach(() => {
    mocks.config = { A: '1', B: '2' } as HackIni;
    mocks.save.mockClear();
    mocks.save.mockImplementation(() => Promise.resolve());
  });

  it('patch で dirty になり draft にサーバ値と差分が合成される', () => {
    const { result } = renderHook(() => useHackIniForm());
    expect(result.current.dirty).toBe(false);
    expect(result.current.draft).toEqual({ A: '1', B: '2' });

    act(() => result.current.patch({ B: 'x' }));
    expect(result.current.dirty).toBe(true);
    expect(result.current.draft).toEqual({ A: '1', B: 'x' });
  });

  it('submit(overrides) は呼び出し時点の派生値を合成して保存する(A-2 回帰)', async () => {
    const { result } = renderHook(() => useHackIniForm());
    act(() => result.current.patch({ B: 'x' }));

    await act(() => result.current.submit({ C: 'serialized' }));

    expect(mocks.save).toHaveBeenCalledWith({ A: '1', B: 'x', C: 'serialized' });
    expect(result.current.dirty).toBe(false);
  });

  it('保存失敗時は dirty のまま(変更が失われない)', async () => {
    mocks.save.mockImplementation(() => Promise.reject(new Error('500')));
    const { result } = renderHook(() => useHackIniForm());
    act(() => result.current.patch({ A: 'z' }));

    await expect(act(() => result.current.submit())).rejects.toThrow('500');
    expect(result.current.dirty).toBe(true);
    expect(result.current.draft.A).toBe('z');
  });

  it('reset で差分を破棄しサーバ値に戻る', () => {
    const { result } = renderHook(() => useHackIniForm());
    act(() => result.current.patch({ A: 'z' }));
    act(() => result.current.reset());
    expect(result.current.dirty).toBe(false);
    expect(result.current.draft).toEqual({ A: '1', B: '2' });
  });
});
