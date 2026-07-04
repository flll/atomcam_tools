import { useTranslation } from 'react-i18next';

export function SettingSlider({
  i18nKey,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  i18nKey: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const { t } = useTranslation('translation');
  const desc = t(`${i18nKey}.tooltip`, { defaultValue: '' });
  return (
    <label className="block rounded-lg border border-border px-3 py-2">
      <div className="mb-1 flex justify-between gap-4 text-sm">
        <span>{t(`${i18nKey}.title`)}</span>
        <span className="font-mono text-muted-foreground">{value}</span>
      </div>
      {desc && <p className="mb-1.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[hsl(var(--primary))]"
      />
    </label>
  );
}
