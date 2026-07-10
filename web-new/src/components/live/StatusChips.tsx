import { useTranslation } from 'react-i18next';
import type { PlayerMode } from './PlayerSurface';

// ステータスチップ(左上)。E2E が fps テキストに依存するため常時 DOM に置き、
// 自動非表示(コントロールバー)の対象にしない。
export function StatusChips({ mode, fps }: { mode: PlayerMode; fps: number }) {
  const { t } = useTranslation();
  const streaming = mode === 'webrtc' || mode === 'jpeg';
  return (
    <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
      {streaming && (
        <span className="flex items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold tracking-wider text-white backdrop-blur">
          <span className="size-2 rounded-full bg-red-500 [animation:live-pulse_4s_ease-in-out_infinite]" />
          {t('live.live')}
        </span>
      )}
      <span className="rounded-full bg-black/55 px-3 py-1 font-mono text-[11px] text-white/90 backdrop-blur tabular-nums">
        {mode === 'webrtc' ? 'WebRTC' : t('live.fps', { fps })}
      </span>
      {mode === 'offline' && (
        <span className="rounded-full bg-red-600/90 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
          {t('common.offline')}
        </span>
      )}
    </div>
  );
}
