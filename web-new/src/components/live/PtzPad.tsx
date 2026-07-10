import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Crosshair } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api';
import { useCameraStatus } from '@/hooks/useCameraStatus';
import { runCmd } from '@/lib/runCmd';

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

const DIRS = [
  { key: 'up', dPan: 0, dTilt: 10, Icon: ChevronUp, cell: 'col-start-2 row-start-1' },
  { key: 'left', dPan: -10, dTilt: 0, Icon: ChevronLeft, cell: 'col-start-1 row-start-2' },
  { key: 'right', dPan: 10, dTilt: 0, Icon: ChevronRight, cell: 'col-start-3 row-start-2' },
  { key: 'down', dPan: 0, dTilt: -10, Icon: ChevronDown, cell: 'col-start-2 row-start-3' },
] as const;

// D-pad + 速度スライダー。長押しで約350ms間隔のリピート移動。
// 目標 pan/tilt は ref に蓄積する(motor は1秒ポーリングなので、都度読みだと
// 連打時に古い値へ巻き戻る)。
export function PtzPad() {
  const { t } = useTranslation();
  const { motor } = useCameraStatus();
  const [speed, setSpeed] = useState(5);
  const target = useRef<{ pan: number; tilt: number } | null>(null);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPress = useCallback(() => {
    if (repeat.current) {
      clearInterval(repeat.current);
      repeat.current = null;
    }
  }, []);

  useEffect(() => stopPress, [stopPress]);

  const startPress = useCallback(
    (dPan: number, dTilt: number) => {
      const step = () => {
        const base = target.current ?? { pan: motor?.pan ?? 177, tilt: motor?.tilt ?? 90 };
        const next = {
          pan: clamp(base.pan + dPan, 0, 355),
          tilt: clamp(base.tilt + dTilt, 0, 180),
        };
        target.current = next;
        runCmd(api.exec(`move ${next.pan} ${next.tilt} ${speed}`), { quiet: true });
      };
      stopPress();
      step();
      repeat.current = setInterval(step, 350);
    },
    [motor, speed, stopPress],
  );

  const center = useCallback(() => {
    target.current = { pan: 177, tilt: 90 };
    runCmd(api.exec(`move 177 90 ${speed}`));
  }, [speed]);

  const btn =
    'flex size-11 items-center justify-center rounded-card bg-surface-container-highest text-on-surface transition-all duration-short-2 ease-standard hover:bg-secondary-container active:scale-95 select-none touch-none';

  return (
    <div className="flex items-center gap-5">
      <div className="grid grid-cols-3 grid-rows-3 gap-2">
        {DIRS.map(({ key, dPan, dTilt, Icon, cell }) => (
          <button
            key={key}
            type="button"
            aria-label={`${key === 'up' || key === 'down' ? 'tilt' : 'pan'} ${dPan + dTilt > 0 ? '+' : '-'}`}
            className={`${btn} ${cell}`}
            onPointerDown={() => startPress(dPan, dTilt)}
            onPointerUp={stopPress}
            onPointerLeave={stopPress}
            onPointerCancel={stopPress}
          >
            <Icon className="size-5" />
          </button>
        ))}
        <button
          type="button"
          aria-label={t('live.center')}
          className={`${btn} col-start-2 row-start-2 rounded-full`}
          onClick={center}
        >
          <Crosshair className="size-5" />
        </button>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          {t('live.speed')}
          <span className="font-mono text-foreground tabular-nums">{speed}</span>
        </label>
        <input
          type="range"
          min={1}
          max={9}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="w-full accent-[hsl(var(--primary))]"
        />
        <div className="pt-1 font-mono text-xs text-muted-foreground tabular-nums">
          pan {motor?.pan ?? '–'} / tilt {motor?.tilt ?? '–'}
        </div>
      </div>
    </div>
  );
}
