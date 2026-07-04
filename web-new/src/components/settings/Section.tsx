import type { ReactNode } from 'react';

export function Section({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
        {description && <p className="text-xs leading-relaxed text-muted-foreground/80">{description}</p>}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
