import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function SettingSelect({
  i18nKey,
  value,
  options,
  onChange,
  disabled,
  icon: Icon,
}: {
  i18nKey: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
  icon?: LucideIcon;
}) {
  const { t } = useTranslation('translation');
  const labels = (t(`${i18nKey}.text`, { returnObjects: true }) as string[] | string) ?? options;
  const desc = t(`${i18nKey}.tooltip`, { defaultValue: '' });
  return (
    <label className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-foreground/[0.02] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm">
          {Icon && <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
          {t(`${i18nKey}.title`)}
        </span>
        {desc && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{desc}</span>}
      </span>
      <select
        className="shrink-0 rounded-md border border-input bg-background px-2 py-1 text-sm"
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
