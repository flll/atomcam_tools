import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Section({
  title,
  description,
  action,
  card = true,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** 見出し右側に置く操作(モード切替等) */
  action?: ReactNode;
  /** true: 1枚のカードにまとめ内部を区切り線で分割 / false: 従来の縦積み(グリッド等の自前レイアウト用) */
  card?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4 px-1">
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
          {description && <p className="text-xs leading-relaxed text-muted-foreground/80">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div
        className={cn(
          card
            ? 'divide-y divide-border overflow-hidden rounded-xl border border-border bg-card'
            : 'space-y-2',
        )}
      >
        {children}
      </div>
    </section>
  );
}
