import useSWR from 'swr';
import { api } from '@/api';
import type { HackIni } from '@/api';

// GET には現れるがファイル置換の対象にならない(または CGI 側で除外される)キー
const SYSTEM_KEYS = ['appver', 'PRODUCT_MODEL', 'HOSTNAME', 'KERNELVER', 'ATOMHACKVER', 'HWADDR', 'CONFIG_VER'];

// hack_ini.cgi の POST は本文でファイルを丸ごと置換するため、途中切断や
// 破損が起きると設定がサイレントに消える(実機で切り捨てを観測済み)。
// 保存後に GET で書き戻りを検証し、欠落があれば例外にして UI に失敗を伝える。
async function verifyPersisted(next: HackIni): Promise<HackIni> {
  const persisted = await api.getHackIni();
  for (const [key, value] of Object.entries(next)) {
    if (SYSTEM_KEYS.includes(key) || value === undefined) continue;
    if ((persisted[key] ?? '') !== value.trim()) {
      throw new Error(`config verify failed: ${key}`);
    }
  }
  return persisted;
}

// hack.ini を SWR で取得。保存後は書き戻りを検証してから反映する。
export function useHackIni() {
  const { data, error, isLoading, mutate } = useSWR<HackIni>('hack_ini', () => api.getHackIni(), {
    revalidateOnFocus: false,
  });

  async function save(next: HackIni) {
    await api.saveHackIni(next);
    const persisted = await verifyPersisted(next);
    await mutate(persisted, { revalidate: false });
  }

  return { config: data, isLoading, error, save, mutate };
}
