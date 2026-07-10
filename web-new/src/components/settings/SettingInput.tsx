import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function SettingInput({
  i18nKey,
  value,
  onChange,
  type = 'text',
  readOnly,
  icon: Icon,
}: {
  i18nKey: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  readOnly?: boolean;
  icon?: LucideIcon;
}) {
  const { t } = useTranslation('translation');
  const desc = t(`${i18nKey}.tooltip`, { defaultValue: '' });
  const placeholder = t(`${i18nKey}.placeholder`, { defaultValue: '' });
  return (
    <label className="block px-4 py-3">
      <span className="flex items-center gap-2 text-title-s">
        {Icon && <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
        {t(`${i18nKey}.title`)}
      </span>
      {desc && <span className="mt-0.5 block text-body-xs text-muted-foreground">{desc}</span>}
      <input
        type={type}
        readOnly={readOnly}
        value={value}
        placeholder={placeholder || undefined}
        onChange={(e) => onChange?.(e.target.value)}
        className="mt-2 w-full rounded-control border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground/50"
      />
    </label>
  );
}
