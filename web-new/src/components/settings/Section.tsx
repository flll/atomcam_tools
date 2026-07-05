import type { ReactNode } from 'react';

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** 見出し右側に置く操作(モード切替等) */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
          {description && <p className="text-xs leading-relaxed text-muted-foreground/80">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
