import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

type OnOff = 'on' | 'off';

export function SettingSwitch({
  i18nKey,
  value,
  onChange,
  disabled,
  icon: Icon,
}: {
  i18nKey: string;
  value: OnOff | string;
  onChange: (v: OnOff) => void;
  disabled?: boolean;
  icon?: LucideIcon;
}) {
  const { t } = useTranslation('translation');
  const on = value === 'on';
  const desc = t(`${i18nKey}.tooltip`, { defaultValue: '' });
  return (
    <label className={cn('flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-foreground/[0.02]', disabled && 'opacity-50')}>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm">
          {Icon && <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
          {t(`${i18nKey}.title`)}
        </span>
        {desc && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{desc}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', on ? 'bg-primary' : 'bg-muted')}
        onClick={() => onChange(on ? 'off' : 'on')}
      >
        <span className={cn('absolute top-0.5 size-5 rounded-full bg-background shadow transition-transform', on ? 'left-5' : 'left-0.5')} />
      </button>
    </label>
  );
}
