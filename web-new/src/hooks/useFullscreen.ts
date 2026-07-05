import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';

// Fullscreen API のラッパ。iOS Safari は要素の requestFullscreen が無いため
// CSS 疑似フルスクリーン(fixed inset-0)へフォールバックする。
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [native, setNative] = useState(false);
  const [pseudo, setPseudo] = useState(false);

  useEffect(() => {
    const onChange = () => setNative(document.fullscreenElement != null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = useCallback(() => {
    if (pseudo) {
      setPseudo(false);
      return;
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    const el = ref.current;
    if (el?.requestFullscreen) {
      el.requestFullscreen().catch(() => setPseudo(true));
    } else {
      setPseudo(true);
    }
  }, [ref, pseudo]);

  const exit = useCallback(() => {
    setPseudo(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  return { active: native || pseudo, pseudo, toggle, exit } as const;
}
