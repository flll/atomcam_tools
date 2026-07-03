import { useCallback, useMemo, useState } from 'react';
import { useHackIni } from './useHackIni';
import type { HackIni } from '@/api';

// draft = サーバ値(config) + 編集差分(overlay)。同期用 effect を持たないため
// サーバ値の更新は未編集フィールドに自動反映される。
export function useHackIniForm() {
  const { config, isLoading, error, save } = useHackIni();
  const [overlay, setOverlay] = useState<Partial<HackIni> | null>(null);
  const dirty = overlay !== null;

  const draft = useMemo<HackIni>(
    () => ({ ...(config ?? {}), ...(overlay ?? {}) }),
    [config, overlay],
  );

  const patch = useCallback((partial: Partial<HackIni>) => {
    setOverlay((prev) => ({ ...(prev ?? {}), ...partial }));
  }, []);

  const reset = useCallback(() => setOverlay(null), []);

  // overrides: ページ側で直列化した派生値(スケジュール等)を保存時に合成する。
  // patch() 直後の submit() が古い draft を送る stale-state 問題を構造的に避ける。
  const submit = useCallback(
    async (overrides?: Partial<HackIni>) => {
      const payload: HackIni = { ...(config ?? {}), ...(overlay ?? {}), ...(overrides ?? {}) };
      await save(payload);
      setOverlay(null);
    },
    [config, overlay, save],
  );

  return { draft, patch, reset, submit, dirty, isLoading, error, config };
}
