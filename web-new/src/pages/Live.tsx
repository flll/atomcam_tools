import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '@/api';
import { PlayerControls, type NightVision } from '@/components/live/PlayerControls';
import { PlayerSurface, type PlayerMode } from '@/components/live/PlayerSurface';
import { StatusChips } from '@/components/live/StatusChips';
import { SystemInfoRow } from '@/components/live/SystemInfoRow';
import { useCameraStatus } from '@/hooks/useCameraStatus';
import { useControlsVisibility } from '@/hooks/useControlsVisibility';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useHackIni } from '@/hooks/useHackIni';
import { useJpegStream } from '@/hooks/useJpegStream';
import { usePropertyCmd } from '@/hooks/usePropertyCmd';
import { useWebRtcStream } from '@/hooks/useWebRtcStream';
import { cn } from '@/lib/utils';
import { runCmd } from '@/lib/runCmd';

export default function Live() {
  const { t } = useTranslation();
  const { media } = useCameraStatus();
  const { config } = useHackIni();
  const { property, setField } = usePropertyCmd();
  const [muted, setMuted] = useState(true);
  const [focusPin, setFocusPin] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  // WebRTC(go2rtc WHEP)優先、失敗・無効時は JPEG ポーリングにフォールバック
  const webrtcConfigured = config?.RTSP_VIDEO0 === 'on' && config?.WEBRTC_ENABLE === 'on';
  const { state: rtcState, videoRef } = useWebRtcStream(webrtcConfigured);
  const rtcActive = rtcState === 'connected';
  const { src, online, fps } = useJpegStream(500, !rtcActive);

  // 初回フレーム前に offline 判定しない(起動直後・遅い回線への猶予)
  const [graceOver, setGraceOver] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setGraceOver(true), 8000);
    return () => clearTimeout(timer);
  }, []);
  const mode: PlayerMode = rtcActive
    ? 'webrtc'
    : src
      ? online
        ? 'jpeg'
        : 'offline'
      : graceOver && !online
        ? 'offline'
        : 'connecting';

  const fullscreen = useFullscreen(stageRef);
  const { visible, handlers } = useControlsVisibility(3000, focusPin);

  const isSwing = config?.PRODUCT_MODEL === 'ATOM_CAKP1JZJP';
  const isAtom = (config?.PRODUCT_MODEL?.startsWith('ATOM') ?? false) && !isSwing;
  const nightVision = (property?.nightVision as NightVision | undefined) ?? 'auto';

  return (
    <div className="flex min-h-full flex-col">
      <h1 className="sr-only">{t('live.title')}</h1>

      {/* ステージ: エッジ to エッジの黒。デスクトップはビューポート全高 */}
      <div
        ref={stageRef}
        {...handlers}
        onFocusCapture={() => setFocusPin(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusPin(false);
        }}
        className={cn(
          'relative w-full overflow-hidden bg-black',
          fullscreen.pseudo ? 'fixed inset-0 z-50' : 'aspect-video max-h-dvh md:aspect-auto md:h-dvh',
        )}
      >
        <PlayerSurface videoRef={videoRef} mode={mode} src={src} />
        <StatusChips mode={mode} fps={fps} />
        <PlayerControls
          visible={visible}
          isWebrtc={rtcActive}
          muted={muted}
          onToggleMute={() => {
            const v = videoRef.current;
            if (!v) return;
            v.muted = !v.muted;
            setMuted(v.muted);
          }}
          nightVision={nightVision}
          onNightChange={(v) => runCmd(setField('nightVision', v))}
          isAtom={isAtom}
          isSwing={isSwing}
          onFlip={() => runCmd(api.exec('flip'))}
          onCenter={() => runCmd(api.exec('move 177 90 5'))}
          fullscreenActive={fullscreen.active}
          onToggleFullscreen={fullscreen.toggle}
        />
      </div>

      {!fullscreen.pseudo && (
        <>
          {!webrtcConfigured && (
            <p className="mx-auto w-full max-w-5xl px-4 pt-3 text-xs text-muted-foreground md:px-8">
              {t('live.webrtcHint')}{' '}
              <Link
                to="/settings/streaming/webrtc"
                className="text-primary underline-offset-2 hover:underline"
              >
                {t('nav.streaming')}
              </Link>
            </p>
          )}
          <SystemInfoRow config={config} media={media} />
        </>
      )}
    </div>
  );
}
