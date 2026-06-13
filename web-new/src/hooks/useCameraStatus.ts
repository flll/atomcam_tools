import useSWR from 'swr';
import { api } from '@/api';
import { parseMediaSize, parseMotorPos } from '@/api';
import type { CameraStatus } from '@/api';

// cmd.cgi?name=status を 1 秒間隔でポーリングし、派生値を整形して返す。
export function useCameraStatus() {
  const { data, error, isLoading } = useSWR<CameraStatus>(
    'cmd:status',
    () => api.getStatus('status'),
    {
      refreshInterval: 1000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  );

  return {
    status: data,
    motor: parseMotorPos(data?.MOTORPOS),
    media: parseMediaSize(data?.MEDIASIZE),
    timestamp: data?.TIMESTAMP,
    isLoading,
    error,
  };
}
