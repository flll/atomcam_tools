import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function SettingInputNumber({
  i18nKey,
  value,
  onChange,
  min,
  max,
  icon: Icon,
}: {
  i18nKey: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  icon?: LucideIcon;
}) {
  const { t } = useTranslation('translation');
  const desc = t(`${i18nKey}.tooltip`, { defaultValue: '' });
  return (
    <label className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-foreground/[0.02]">
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-title-s">
          {Icon && <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
          {t(`${i18nKey}.title`)}
        </span>
        {desc && <span className="mt-0.5 block text-body-xs text-muted-foreground">{desc}</span>}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 shrink-0 rounded-control border border-input bg-background px-2 py-1 text-sm"
      />
    </label>
  );
}
