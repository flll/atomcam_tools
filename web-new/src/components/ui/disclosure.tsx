import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ネイティブ details/summary の M3 風ラッパー(JS 状態を持たない)。
// 詳細設定・スニペット表示など「既定で畳む」ブロックに使う。
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details open={defaultOpen} className={cn('group rounded-lg border border-border', className)}>
      <summary className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        {summary}
      </summary>
      <div className="space-y-2 border-t border-border/60 p-3">{children}</div>
    </details>
  );
}
