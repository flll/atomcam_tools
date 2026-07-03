import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { dismissToast, getToasts, subscribeToasts, type ToastItem } from '@/lib/toast';

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>(getToasts);

  useEffect(() => subscribeToasts(setList), []);

  if (list.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2 px-4">
      {list.map((item) => (
        <button
          key={item.id}
          type="button"
          role={item.variant === 'error' ? 'alert' : 'status'}
          onClick={() => dismissToast(item.id)}
          className={cn(
            'pointer-events-auto max-w-md rounded-lg border px-4 py-2.5 text-sm shadow-lg',
            item.variant === 'error'
              ? 'border-destructive/50 bg-destructive text-destructive-foreground'
              : 'border-border bg-card text-foreground',
          )}
        >
          {item.message}
        </button>
      ))}
    </div>
  );
}
