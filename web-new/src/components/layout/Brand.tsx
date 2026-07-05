import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

// アプリロゴ: カメラレンズをモチーフにしたマーク。
// リング=レンズ、内円=絞り、右上のドット=録画インジケータ。
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7', className)} aria-hidden="true">
      <circle cx="16" cy="16" r="12.5" fill="none" stroke="hsl(var(--md-primary))" strokeWidth="3" />
      <circle cx="16" cy="16" r="5.5" fill="hsl(var(--md-primary))" />
      <circle cx="25.5" cy="6.5" r="3" fill="hsl(var(--md-error))" />
    </svg>
  );
}

export function Brand({ withName = false }: { withName?: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-2">
      <BrandMark />
      {withName ? (
        <span className="text-base font-semibold tracking-tight">{t('app.title')}</span>
      ) : (
        <span className="sr-only">{t('app.title')}</span>
      )}
    </span>
  );
}
