// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useControlsVisibility } from './useControlsVisibility';

describe('useControlsVisibility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('idleMs 経過で隠れ、poke(pointermove)で再表示される', () => {
    const { result } = renderHook(() => useControlsVisibility(3000));
    expect(result.current.visible).toBe(true);
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(result.current.visible).toBe(false);
    act(() => {
      result.current.handlers.onPointerMove();
    });
    expect(result.current.visible).toBe(true);
  });

  it('pinned 中はアイドルでも隠れない', () => {
    const { result } = renderHook(() => useControlsVisibility(1000, true));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.visible).toBe(true);
  });

  it('pinned 解除後はアイドルで隠れる', () => {
    const { result, rerender } = renderHook(({ pinned }) => useControlsVisibility(1000, pinned), {
      initialProps: { pinned: true },
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    rerender({ pinned: false });
    expect(result.current.visible).toBe(false);
  });
});
