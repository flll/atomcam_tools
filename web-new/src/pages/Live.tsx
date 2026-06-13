import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Crosshair, Wifi, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { useCameraStatus } from '@/hooks/useCameraStatus';
import { useHackIni } from '@/hooks/useHackIni';
import { useJpegStream } from '@/hooks/useJpegStream';
import { cn } from '@/lib/utils';

function formatBytes(n: number): string {
  if (n >= 1 << 30) return `${(n / (1 << 30)).toFixed(1)} GB`;
  if (n >= 1 << 20) return `${(n / (1 << 20)).toFixed(0)} MB`;
  return `${(n / 1024).toFixed(0)} KB`;
}

export default function Live() {
  const { t } = useTranslation();
  const { src, online, fps } = useJpegStream(500);
  const { motor, media } = useCameraStatus();
  const { config } = useHackIni();
  const [speed, setSpeed] = useState(5);

  const isSwing = config?.PRODUCT_MODEL === 'ATOM_CAKP1JZJP';

  async function move(dPan: number, dTilt: number) {
    const pan = (motor?.pan ?? 177) + dPan;
    const tilt = (motor?.tilt ?? 90) + dTilt;
    await api.exec(`move ${pan} ${tilt} ${speed}`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{t('live.title')}</h1>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
            online ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive',
          )}
        >
          {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
          {online ? t('common.online') : t('common.offline')}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-black shadow-lg">
        <div className="relative aspect-[4/3] w-full">
          {src ? (
            <img src={src} alt={t('live.title')} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              {t('live.noSignal')}
            </div>
          )}
          <div className="absolute left-3 top-3 rounded bg-black/55 px-2 py-1 font-mono text-xs text-white">
            {t('live.fps', { fps })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* PTZ パッド（AtomSwing 時のみ操作可） */}
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t('live.ptz')}</h2>
          <div className="flex items-center gap-6">
            <div className="grid grid-cols-3 grid-rows-3 gap-1.5">
              <span />
              <Button variant="secondary" size="icon" disabled={!isSwing} onClick={() => move(0, 10)} aria-label={t('live.tilt')}>
                <ChevronUp />
              </Button>
              <span />
              <Button variant="secondary" size="icon" disabled={!isSwing} onClick={() => move(-10, 0)} aria-label={t('live.pan')}>
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="icon" disabled={!isSwing} onClick={() => api.exec('move 177 90 ' + speed)} aria-label={t('live.center')}>
                <Crosshair />
              </Button>
              <Button variant="secondary" size="icon" disabled={!isSwing} onClick={() => move(10, 0)} aria-label={t('live.pan')}>
                <ChevronRight />
              </Button>
              <span />
              <Button variant="secondary" size="icon" disabled={!isSwing} onClick={() => move(0, -10)} aria-label={t('live.tilt')}>
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
              </div>
            </div>
          </div>
        </section>

        {/* ステータス */}
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
