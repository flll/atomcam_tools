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
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2">
      <span className="text-sm">{t(`${i18nKey}.title`)}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
      />
    </label>
  );
}
