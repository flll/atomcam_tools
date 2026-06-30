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
  return (
    <label className="block rounded-lg border border-border px-3 py-2">
      <span className="mb-1 block text-sm">{t(`${i18nKey}.title`)}</span>
      <input
        type={type}
        readOnly={readOnly}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
      />
    </label>
  );
}
