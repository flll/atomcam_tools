import { useCallback, useEffect, useState } from 'react';
import { useHackIni } from './useHackIni';
import type { HackIni } from '@/api';

export function useHackIniForm() {
  const { config, isLoading, error, save } = useHackIni();
  const [draft, setDraft] = useState<HackIni>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (config && !dirty) setDraft(config);
  }, [config, dirty]);

  const patch = useCallback((partial: Partial<HackIni>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
    setDirty(true);
  }, []);

  const reset = useCallback(() => {
    if (config) setDraft(config);
    setDirty(false);
  }, [config]);

  const submit = useCallback(async () => {
    await save(draft);
    setDirty(false);
  }, [draft, save]);

  return { draft, patch, reset, submit, dirty, isLoading, error, config };
}
