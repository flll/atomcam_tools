// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useJpegStream } from './useJpegStream';
import { api } from '@/api';

vi.mock('@/api', () => ({ api: { getJpegObjectUrl: vi.fn() } }));

const mockedGet = vi.mocked(api.getJpegObjectUrl);

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
}

describe('useJpegStream の可視性制御', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom に revokeObjectURL が無いためスタブ(フックは毎フレーム revoke する)
    URL.revokeObjectURL = vi.fn();
    mockedGet.mockResolvedValue('blob:frame');
  });

  afterEach(() => {
    vi.useRealTimers();
    setHidden(false);
    vi.clearAllMocks();
  });

  it('表示中はポーリングで取得する', async () => {
    setHidden(false);
    const { unmount } = renderHook(() => useJpegStream(500));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(mockedGet.mock.calls.length).toBeGreaterThanOrEqual(2);
    unmount();
  });

  it('タブ非表示中は取得しない(待機だけ続ける)', async () => {
    setHidden(true);
    const { unmount } = renderHook(() => useJpegStream(500));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(mockedGet).not.toHaveBeenCalled();
    unmount();
  });

  it('非表示から復帰すると次の tick で再開する', async () => {
    setHidden(true);
    const { unmount } = renderHook(() => useJpegStream(500));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(mockedGet).not.toHaveBeenCalled();
    setHidden(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(mockedGet).toHaveBeenCalled();
    unmount();
  });

  it('keepAliveWhenHidden(PiP 中)なら非表示でも取得する', async () => {
    setHidden(true);
    const { unmount } = renderHook(() => useJpegStream(500, true, true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(mockedGet).toHaveBeenCalled();
    unmount();
  });
});
