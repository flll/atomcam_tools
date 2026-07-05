import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function SettingSlider({
  i18nKey,
  value,
  min,
  max,
  step = 1,
  defaultValue,
  onChange,
}: {
  i18nKey: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  onChange: (v: number) => void;
}) {
  const { t } = useTranslation('translation');
  const { t: tUi } = useTranslation('ui');
  const desc = t(`${i18nKey}.tooltip`, { defaultValue: '' });
  const modified = defaultValue != null && value !== defaultValue;
  const pct = defaultValue != null && max > min ? (defaultValue - min) / (max - min) : null;
  return (
    <label className="block rounded-lg border border-border px-3 py-2">
      <div className="mb-1 flex justify-between gap-4 text-sm">
        <span>{t(`${i18nKey}.title`)}</span>
        <span className={cn('font-mono', modified ? 'font-medium text-primary' : 'text-muted-foreground')}>
          {value}
        </span>
      </div>
      {desc && <p className="mb-1.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>}
      <div
        className="relative"
        title={defaultValue != null ? tUi('settings.defaultValue', { value: defaultValue }) : undefined}
      >
        {pct != null && (
          // 初期値の位置を示すグレーの印。ネイティブ thumb(約16px)の中心移動量を補正
          <span
            aria-hidden="true"
            data-testid="default-marker"
            className="pointer-events-none absolute top-1/2 h-2 w-0.5 -translate-y-1/2 rounded-full bg-muted-foreground/50"
            style={{ left: `calc(${(pct * 100).toFixed(2)}% + ${((0.5 - pct) * 16).toFixed(1)}px)` }}
          />
        )}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-[hsl(var(--primary))]"
        />
      </div>
    </label>
  );
}
