import { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import { RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function SettingSlider({
  i18nKey,
  value,
  min,
  max,
  step = 1,
  defaultValue,
  disabled,
  icon: Icon,
  onChange,
}: {
  i18nKey: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  disabled?: boolean;
  icon?: LucideIcon;
  onChange: (v: number) => void;
}) {
  const { t } = useTranslation('translation');
  const { t: tUi } = useTranslation('ui');
  // label で全体を包むとリセットボタンが「最初の labelable 要素」になり
  // input の名前が失われるため、htmlFor/id で明示的に関連付ける
  const id = useId();
  const desc = t(`${i18nKey}.tooltip`, { defaultValue: '' });
  const modified = defaultValue != null && value !== defaultValue;
  const pct = defaultValue != null && max > min ? (defaultValue - min) / (max - min) : null;
  return (
    <div className="block px-4 py-3">
      <div className="mb-1 flex items-center justify-between gap-4 text-sm">
        <label htmlFor={id} className="flex items-center gap-2">
          {Icon && <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
          {t(`${i18nKey}.title`)}
        </label>
        <span className="flex items-center gap-2">
          {modified && !disabled && (
            // 初期値からズレているときだけ出すワンタップリセット
            <button
              type="button"
              aria-label={tUi('settings.resetToDefault')}
              title={tUi('settings.resetToDefault')}
              onClick={() => onChange(defaultValue!)}
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
            </button>
          )}
          <span className={cn('font-mono tabular-nums', modified ? 'font-medium text-primary' : 'text-muted-foreground')}>
            {value}
          </span>
        </span>
      </div>
      {desc && (
        <p id={`${id}-desc`} className="mb-1.5 text-xs leading-relaxed text-muted-foreground">
          {desc}
        </p>
      )}
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
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-describedby={desc ? `${id}-desc` : undefined}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn('w-full accent-[hsl(var(--primary))]', disabled && 'opacity-60')}
        />
      </div>
    </div>
  );
}
