import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

type OnOff = 'on' | 'off';

export function SettingSwitch({
  i18nKey,
  value,
  onChange,
  disabled,
}: {
  i18nKey: string;
  value: OnOff | string;
  onChange: (v: OnOff) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation('translation');
  const on = value === 'on';
  return (
    <label className={cn('flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2', disabled && 'opacity-50')}>
      <span className="text-sm">{t(`${i18nKey}.title`)}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        className={cn('relative h-6 w-11 rounded-full transition-colors', on ? 'bg-primary' : 'bg-muted')}
        onClick={() => onChange(on ? 'off' : 'on')}
      >
        <span className={cn('absolute top-0.5 size-5 rounded-full bg-background shadow transition-transform', on ? 'left-5' : 'left-0.5')} />
      </button>
    </label>
  );
}
