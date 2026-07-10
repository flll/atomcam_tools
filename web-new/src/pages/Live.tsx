import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '@/api';
import { PlayerControls, type NightVision } from '@/components/live/PlayerControls';
import { PlayerSurface, type PlayerMode } from '@/components/live/PlayerSurface';
import { PtzPanel } from '@/components/live/PtzPanel';
import { StatusChips } from '@/components/live/StatusChips';
import { SystemInfoRow } from '@/components/live/SystemInfoRow';
import { useCameraStatus } from '@/hooks/useCameraStatus';
import { useControlsVisibility } from '@/hooks/useControlsVisibility';
import { useDocumentPip } from '@/hooks/useDocumentPip';
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
  const [ptzOpen, setPtzOpen] = useState(false);
  const [theater, setTheater] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  // WebRTC(go2rtc WHEP)優先、失敗・無効時は JPEG ポーリングにフォールバック
  const webrtcConfigured = config?.RTSP_VIDEO0 === 'on' && config?.WEBRTC_ENABLE === 'on';
  const { state: rtcState, videoRef } = useWebRtcStream(webrtcConfigured);
  const rtcActive = rtcState === 'connected';
  // PiP 表示中はメインタブが非表示でも JPEG 取得を続ける必要がある
  const pip = useDocumentPip();
  const { src, online, fps } = useJpegStream(500, !rtcActive, pip.pipWindow != null);

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
  const { visible, handlers } = useControlsVisibility(3000, focusPin || ptzOpen);

  // T キーでシアターモード、Escape で解除(サブモニタ運用の要)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 't' || e.key === 'T') setTheater((v) => !v);
      if (e.key === 'Escape') setTheater(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isSwing = config?.PRODUCT_MODEL === 'ATOM_CAKP1JZJP';
  const isAtom = (config?.PRODUCT_MODEL?.startsWith('ATOM') ?? false) && !isSwing;
  const nightVision = (property?.nightVision as NightVision | undefined) ?? 'auto';
  const immersed = fullscreen.pseudo || theater;

  return (
    <div className="flex min-h-full flex-col">
      <h1 className="sr-only">{t('live.title')}</h1>

      {/* ステージ: エッジ to エッジの黒。デスクトップはビューポート全高。
          シアター/疑似フルスクリーン時はレールごと覆う */}
      <div
        ref={stageRef}
        data-testid="live-stage"
        {...handlers}
        onFocusCapture={() => setFocusPin(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusPin(false);
        }}
        className={cn(
          'relative w-full overflow-hidden bg-black',
          immersed ? 'fixed inset-0 z-40' : 'aspect-video max-h-dvh md:aspect-auto md:h-dvh',
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
          ptzOpen={ptzOpen}
          onTogglePtz={() => setPtzOpen((v) => !v)}
          theaterActive={theater}
          onToggleTheater={() => setTheater((v) => !v)}
          pipSupported={pip.supported}
          onTogglePip={() => runCmd(pip.toggle())}
          fullscreenActive={fullscreen.active}
          onToggleFullscreen={fullscreen.toggle}
        />
        {isSwing && <PtzPanel open={ptzOpen} onClose={() => setPtzOpen(false)} />}
      </div>

      {/* PiP 窓には JPEG ストリームをポータルで流し込む(2fps の小窓監視) */}
      {pip.pipWindow &&
        src &&
        createPortal(
          <img
            src={src}
            alt={t('live.title')}
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
          />,
          pip.pipWindow.document.body,
        )}

      {!immersed && (
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
