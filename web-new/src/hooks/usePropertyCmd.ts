import useSWR from 'swr';
import { api } from '@/api';
import type { CameraProperty } from '@/api';

export function usePropertyCmd() {
  const { data, error, isLoading, mutate } = useSWR<CameraProperty>(
    'camera:property',
    () => api.getProperty(),
    { revalidateOnFocus: false },
  );

  async function setField(key: string, value: string) {
    await api.setProperty(key, value);
    await mutate({ ...(data ?? {}), [key]: value, valid: true }, { revalidate: false });
  }

  return { property: data, isLoading, error, setField, mutate };
}
