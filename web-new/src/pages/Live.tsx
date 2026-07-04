import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crosshair,
  Moon,
  RefreshCw,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { useCameraStatus } from '@/hooks/useCameraStatus';
import { useHackIni } from '@/hooks/useHackIni';
import { useJpegStream } from '@/hooks/useJpegStream';
import { useWebRtcStream } from '@/hooks/useWebRtcStream';
import { cn } from '@/lib/utils';
import { runCmd } from '@/lib/runCmd';
import { formatBytes } from '@/lib/format';

export default function Live() {
  const { t } = useTranslation();
  const { motor, media, status } = useCameraStatus();
  const { config } = useHackIni();
  const [speed, setSpeed] = useState(5);
  const [muted, setMuted] = useState(true);

  // WebRTC(go2rtc WHEP)優先、失敗・無効時は JPEG ポーリングにフォールバック
  const webrtcConfigured = config?.RTSP_VIDEO0 === 'on' && config?.WEBRTC_ENABLE === 'on';
  const { state: rtcState, videoRef } = useWebRtcStream(webrtcConfigured);
  const rtcActive = rtcState === 'connected';
  const { src, online, fps } = useJpegStream(500, !rtcActive);

  const isSwing = config?.PRODUCT_MODEL === 'ATOM_CAKP1JZJP';
  const isAtom = config?.PRODUCT_MODEL?.startsWith('ATOM') && !isSwing;

  function move(dPan: number, dTilt: number) {
    const pan = (motor?.pan ?? 177) + dPan;
    const tilt = (motor?.tilt ?? 90) + dTilt;
    runCmd(api.exec(`move ${pan} ${tilt} ${speed}`));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{t('live.title')}</h1>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
            online || rtcActive ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive',
          )}
        >
          {online || rtcActive ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
          {online || rtcActive ? t('common.online') : t('common.offline')}
        </span>
      </div>

      {/* YouTube 方式: プレイヤー枠は 16:9 固定、中身は object-contain で
          どのアスペクト比でも黒帯レターボックスに収める(切り取らない) */}
      <div className="overflow-hidden rounded-xl border border-border bg-black shadow-lg">
        <div className="relative aspect-video w-full">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={cn('h-full w-full object-contain', !rtcActive && 'hidden')}
          />
          {!rtcActive &&
            (src ? (
              <img src={src} alt={t('live.title')} className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                {rtcState === 'connecting' ? t('live.connecting') : t('live.noSignal')}
              </div>
            ))}
          <div className="absolute left-3 top-3 rounded bg-black/55 px-2 py-1 font-mono text-xs text-white">
            {rtcActive ? 'WebRTC' : t('live.fps', { fps })}
          </div>
          <div className="absolute bottom-3 right-3 flex flex-wrap gap-1">
            {rtcActive && (
              <Button
                size="sm"
                variant="secondary"
                aria-label={muted ? t('live.audioOn') : t('live.audioOff')}
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  v.muted = !v.muted;
                  setMuted(v.muted);
                }}
              >
                {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => runCmd(api.exec('night on'))}>
              <Moon className="size-3.5" /> on
            </Button>
            <Button size="sm" variant="secondary" onClick={() => runCmd(api.exec('night auto'))}>
              auto
            </Button>
            <Button size="sm" variant="secondary" onClick={() => runCmd(api.exec('night off'))}>
              off
            </Button>
            {isSwing && (
              <Button size="sm" variant="outline" onClick={() => runCmd(api.exec(`move 177 90 ${speed}`))}>
                <Crosshair className="size-3.5" /> {t('live.center')}
              </Button>
            )}
            {isAtom && (
              <Button size="sm" variant="outline" onClick={() => runCmd(api.exec('flip'))}>
                <RefreshCw className="size-3.5" /> flip
              </Button>
            )}
          </div>
        </div>
      </div>

      {!webrtcConfigured && (
        <p className="text-xs text-muted-foreground">
          {t('live.webrtcHint')}{' '}
          <Link to="/settings/streaming/webrtc" className="text-primary underline-offset-2 hover:underline">
            {t('nav.streaming')}
          </Link>
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t('live.ptz')}</h2>
          <div className="flex items-center gap-6">
            <div className="grid grid-cols-3 grid-rows-3 gap-1.5">
              <span />
              <Button variant="secondary" size="icon" disabled={!isSwing} onClick={() => move(0, 10)}>
                <ChevronUp />
              </Button>
              <span />
              <Button variant="secondary" size="icon" disabled={!isSwing} onClick={() => move(-10, 0)}>
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="icon" disabled={!isSwing} onClick={() => runCmd(api.exec(`move 177 90 ${speed}`))}>
                <Crosshair />
              </Button>
              <Button variant="secondary" size="icon" disabled={!isSwing} onClick={() => move(10, 0)}>
                <ChevronRight />
              </Button>
              <span />
              <Button variant="secondary" size="icon" disabled={!isSwing} onClick={() => move(0, -10)}>
                <ChevronDown />
              </Button>
              <span />
            </div>
            <div className="flex-1 space-y-2">
              <label className="flex items-center justify-between text-xs text-muted-foreground">
                {t('live.speed')}
                <span className="font-mono text-foreground">{speed}</span>
              </label>
              <input
                type="range"
                min={1}
                max={9}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full accent-[hsl(var(--primary))]"
              />
              <div className="pt-1 text-xs text-muted-foreground">
                pan {motor?.pan ?? '–'} / tilt {motor?.tilt ?? '–'}
                {status?.FLIP != null && ` / flip ${status.FLIP}`}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t('nav.system')}</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('live.model')}</dt>
              <dd className="font-mono">{config?.PRODUCT_MODEL ?? '–'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('live.firmware')}</dt>
              <dd className="font-mono">{config?.ATOMHACKVER ?? '–'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('live.freeSpace')}</dt>
              <dd className="font-mono">
                {media ? `${formatBytes(media.available)} / ${formatBytes(media.total)}` : '–'}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
