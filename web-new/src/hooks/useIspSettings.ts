import { useCallback, useRef } from 'react';
import useSWR from 'swr';
import { api } from '@/api';
import type { IspSettings } from '@/api';
import { runCmd } from '@/lib/runCmd';

export function useIspSettings() {
  const { data, error, isLoading, mutate } = useSWR('video_isp', () => api.getIspSettings(), {
    revalidateOnFocus: false,
  });
  const fileTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const apply = useCallback(
    (key: keyof IspSettings, next: IspSettings) => {
      clearTimeout(liveTimer.current);
      // ライブプレビューは高頻度なので失敗を通知しない
      liveTimer.current = setTimeout(() => runCmd(api.applyIspLive(key, next), { quiet: true }), 300);
      clearTimeout(fileTimer.current);
      fileTimer.current = setTimeout(() => runCmd(api.saveIspSettings(next)), 1500);
      runCmd(mutate(next, { revalidate: false }), { quiet: true });
    },
    [mutate],
  );

  return { settings: data, isLoading, error, apply, mutate };
}
