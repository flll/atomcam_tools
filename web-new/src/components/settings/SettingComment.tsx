import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SettingComment({
  i18nKey,
  children,
  tone = 'muted',
}: {
  i18nKey: string;
  children?: ReactNode;
  tone?: 'muted' | 'danger';
}) {
  const { t } = useTranslation('translation');
  const comment = t(`${i18nKey}.comment`, { defaultValue: '' });
  return (
    <div className={cn('px-4 py-3 text-sm', tone === 'danger' ? 'bg-destructive/5 text-destructive' : 'text-muted-foreground')}>
      <div className="font-medium text-foreground">{t(`${i18nKey}.title`, { defaultValue: '' })}</div>
      {comment && <p className="mt-1 whitespace-pre-wrap">{comment}</p>}
      {children}
    </div>
  );
}
