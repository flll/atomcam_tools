import { useTranslation } from 'react-i18next';

export function SettingInputNumber({
  i18nKey,
  value,
  onChange,
  min,
  max,
}: {
  i18nKey: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const { t } = useTranslation('translation');
  const desc = t(`${i18nKey}.tooltip`, { defaultValue: '' });
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2">
      <span className="min-w-0">
        <span className="block text-sm">{t(`${i18nKey}.title`)}</span>
        {desc && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{desc}</span>}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 shrink-0 rounded-md border border-input bg-background px-2 py-1 text-sm"
      />
    </label>
  );
}
