import { useTranslation } from 'react-i18next';

export function SettingInput({
  i18nKey,
  value,
  onChange,
  type = 'text',
  readOnly,
}: {
  i18nKey: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  readOnly?: boolean;
}) {
  const { t } = useTranslation('translation');
  const desc = t(`${i18nKey}.tooltip`, { defaultValue: '' });
  const placeholder = t(`${i18nKey}.placeholder`, { defaultValue: '' });
  return (
    <label className="block rounded-lg border border-border px-3 py-2">
      <span className="block text-sm">{t(`${i18nKey}.title`)}</span>
      {desc && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{desc}</span>}
      <input
        type={type}
        readOnly={readOnly}
        value={value}
        placeholder={placeholder || undefined}
        onChange={(e) => onChange?.(e.target.value)}
        className="mt-1.5 w-full rounded-md border border-input bg-background px-2 py-1 text-sm placeholder:text-muted-foreground/50"
      />
    </label>
  );
}
