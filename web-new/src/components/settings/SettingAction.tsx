import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

// 設定カード内の「操作(ボタン)」を、SettingSwitch と同じ体裁の行にする。
// ラベル+説明を左、操作要素(children)を右に置く。危険操作は danger で淡い赤地に。
export function SettingAction({
  i18nKey,
  icon: Icon,
  children,
  danger,
}: {
  i18nKey: string;
  icon?: LucideIcon;
  /** 右側に置く操作要素(通常は <Button size="sm">) */
  children: ReactNode;
  danger?: boolean;
}) {
  const { t } = useTranslation('translation');
  const desc = t(`${i18nKey}.tooltip`, { defaultValue: '' });
  return (
    <div className={cn('flex items-center justify-between gap-4 px-4 py-3', danger && 'bg-destructive/5')}>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-title-s">
          {Icon && <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
          {t(`${i18nKey}.title`)}
        </span>
        {desc && <span className="mt-0.5 block text-body-xs text-muted-foreground">{desc}</span>}
      </span>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
