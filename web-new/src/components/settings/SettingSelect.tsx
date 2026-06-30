import { useTranslation } from 'react-i18next';

export function SettingSelect({
  i18nKey,
  value,
  options,
  onChange,
  disabled,
}: {
  i18nKey: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation('translation');
  const labels = (t(`${i18nKey}.text`, { returnObjects: true }) as string[] | string) ?? options;
  return (
    <label className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm">{t(`${i18nKey}.title`)}</span>
      <select
        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt, i) => (
          <option key={opt} value={opt}>
            {Array.isArray(labels) ? labels[i] ?? opt : opt}
          </option>
        ))}
      </select>
    </label>
  );
}
