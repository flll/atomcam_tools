import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export type PlayerMode = 'connecting' | 'webrtc' | 'jpeg' | 'offline';

// 映像面。YouTube 方式: 中身は常に object-contain(切らない・黒帯で収める)。
// - connecting: シマースケルトン
// - offline: 最後のフレームを減光して再接続表示(何も無いよりも状況が分かる)
export function PlayerSurface({
  videoRef,
  mode,
  src,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  mode: PlayerMode;
  src: string | null;
}) {
  const { t } = useTranslation();
  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={cn('h-full w-full object-contain', mode !== 'webrtc' && 'hidden')}
      />
      {mode !== 'webrtc' && src && (
        <img
          src={src}
          alt={t('live.title')}
          className={cn(
            'h-full w-full object-contain transition-[opacity,filter] duration-long-2 ease-standard',
            mode === 'offline' && 'opacity-40 saturate-0',
          )}
        />
      )}
      {mode === 'connecting' && (
        <div className="absolute inset-0">
          <div className="absolute inset-0 animate-[shimmer_2.2s_linear_infinite] bg-[linear-gradient(100deg,transparent_30%,rgba(255,255,255,0.06)_50%,transparent_70%)] bg-[length:200%_100%]" />
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/50">
            {t('live.connecting')}
          </div>
        </div>
      )}
      {mode === 'offline' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
          <span className="size-8 animate-spin rounded-full border-2 border-white/25 border-t-white/80" />
          <span className="text-sm">{t('live.reconnecting')}</span>
        </div>
      )}
    </>
  );
}
