import { useEffect, useRef, useState } from 'react';
import { api } from '@/api';

interface JpegStream {
  src: string | null;
  online: boolean;
  fps: number;
}

// get_jpeg.cgi を一定間隔でポーリングし、Blob URL を順次差し替える。
// 直前の URL は必ず revoke してメモリリークを防ぐ（現行 Vue 実装のバグ修正）。
// タブ非表示中は取得を止めてカメラ負荷を下げる(87MB RAM の実機で JPEG
// エンコード+配信が毎秒走り続けるのを防ぐ)。Document PiP で別窓表示中は
// メインタブが hidden でも継続が必要なため keepAliveWhenHidden で opt-out。
export function useJpegStream(intervalMs = 500, enabled = true, keepAliveWhenHidden = false): JpegStream {
  const [src, setSrc] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [fps, setFps] = useState(0);
  const prevUrl = useRef<string | null>(null);
  const frames = useRef<number[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      // 非表示タブでは取得せず待機だけ続ける(表示復帰後は次の tick で自然再開)
      if (document.hidden && !keepAliveWhenHidden) {
        timer = setTimeout(tick, intervalMs);
        return;
      }
      try {
        const url = await api.getJpegObjectUrl();
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
        prevUrl.current = url;
        setSrc(url);
        setOnline(true);

        const now = Date.now();
        frames.current.push(now);
        frames.current = frames.current.filter((t) => now - t < 1000);
        setFps(frames.current.length);
      } catch {
        if (!cancelled) setOnline(false);
      } finally {
        if (!cancelled) timer = setTimeout(tick, intervalMs);
      }
    }

    // tick は内部で例外処理済みのため reject しない
    tick().catch(() => {});
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (prevUrl.current) {
        URL.revokeObjectURL(prevUrl.current);
        prevUrl.current = null;
      }
    };
  }, [intervalMs, enabled, keepAliveWhenHidden]);

  return { src, online, fps };
}
