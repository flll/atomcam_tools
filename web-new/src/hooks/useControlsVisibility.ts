import { useCallback, useEffect, useRef, useState } from 'react';

// プレイヤーコントロールを「操作しているときだけ」表示するための可視性管理。
// - pointermove / pointerdown で表示し、idleMs 経過で隠す
// - pinned(パネル展開中・フォーカスが中にある等)の間は隠さない(a11y)
export function useControlsVisibility(idleMs = 3000, pinned = false) {
  const [idle, setIdle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poke = useCallback(() => {
    setIdle(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setIdle(true), idleMs);
  }, [idleMs]);

  useEffect(() => {
    poke();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poke]);

  return {
    visible: pinned || !idle,
    handlers: { onPointerMove: poke, onPointerDown: poke },
  } as const;
}
