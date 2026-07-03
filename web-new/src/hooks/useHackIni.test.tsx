// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HackIni } from '@/api';
import { useHackIni } from './useHackIni';

const mocks = vi.hoisted(() => ({
  getHackIni: vi.fn<() => Promise<HackIni>>(),
  saveHackIni: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/api', () => ({
  api: { getHackIni: mocks.getHackIni, saveHackIni: mocks.saveHackIni },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  // テスト毎に SWR キャッシュを分離する
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

describe('useHackIni.save (書き戻り検証)', () => {
  beforeEach(() => {
    mocks.getHackIni.mockReset();
    mocks.saveHackIni.mockClear();
  });

  it('保存後の GET が一致すれば成功し config を更新する', async () => {
    mocks.getHackIni
      .mockResolvedValueOnce({ A: '1' } as HackIni) // 初期ロード
      .mockResolvedValueOnce({ A: '2', HOSTNAME: 'cam' } as HackIni); // 保存後の検証 GET
    const { result } = renderHook(() => useHackIni(), { wrapper });
    await waitFor(() => expect(result.current.config).toEqual({ A: '1' }));

    await act(() => result.current.save({ A: '2' } as HackIni));

    expect(mocks.saveHackIni).toHaveBeenCalledWith({ A: '2' });
    expect(result.current.config).toEqual({ A: '2', HOSTNAME: 'cam' });
  });

  it('書き戻りでキーが欠落していたら例外(サイレント破損の検知 A-9)', async () => {
    mocks.getHackIni
      .mockResolvedValueOnce({ A: '1', B: 'x' } as HackIni)
      // 保存後の GET で B が消えている(実機で観測した切り捨て)
      .mockResolvedValueOnce({ A: '2' } as HackIni);
    const { result } = renderHook(() => useHackIni(), { wrapper });
    await waitFor(() => expect(result.current.config).toBeDefined());

    await expect(act(() => result.current.save({ A: '2', B: 'x' } as HackIni))).rejects.toThrow(
      'config verify failed: B',
    );
  });

  it('システム由来キー(HOSTNAME 等)は検証対象外', async () => {
    mocks.getHackIni
      .mockResolvedValueOnce({ A: '1', HOSTNAME: 'cam' } as HackIni)
      .mockResolvedValueOnce({ A: '2' } as HackIni); // HOSTNAME は CGI が除外して消える
    const { result } = renderHook(() => useHackIni(), { wrapper });
    await waitFor(() => expect(result.current.config).toBeDefined());

    await act(() => result.current.save({ A: '2', HOSTNAME: 'cam' } as HackIni));
    expect(result.current.config).toEqual({ A: '2' });
  });
});
