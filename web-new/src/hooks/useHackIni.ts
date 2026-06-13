import useSWR from 'swr';
import { api } from '@/api';
import type { HackIni } from '@/api';

// hack.ini を SWR で取得。保存後は mutate で再検証する。
export function useHackIni() {
  const { data, error, isLoading, mutate } = useSWR<HackIni>('hack_ini', () => api.getHackIni(), {
    revalidateOnFocus: false,
  });

  async function save(next: HackIni) {
    await api.saveHackIni(next);
    await mutate(next, { revalidate: false });
  }

  return { config: data, isLoading, error, save, mutate };
}
