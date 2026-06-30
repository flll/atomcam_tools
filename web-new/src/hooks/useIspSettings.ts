import { useCallback, useRef } from 'react';
import useSWR from 'swr';
import { api } from '@/api';
import type { IspSettings } from '@/api';

export function useIspSettings() {
  const { data, error, isLoading, mutate } = useSWR('video_isp', () => api.getIspSettings(), {
    revalidateOnFocus: false,
  });
  const fileTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const apply = useCallback(
    (key: keyof IspSettings, next: IspSettings) => {
      clearTimeout(liveTimer.current);
      liveTimer.current = setTimeout(() => void api.applyIspLive(key, next), 300);
      clearTimeout(fileTimer.current);
      fileTimer.current = setTimeout(async () => {
        await api.saveIspSettings(next);
      }, 1500);
      void mutate(next, { revalidate: false });
    },
    [mutate],
  );

  return { settings: data, isLoading, error, apply, mutate };
}
