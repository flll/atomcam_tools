import { useId } from 'react';
import type { ReactNode } from 'react';
import { m } from 'motion/react';
import { cn } from '@/lib/utils';
import { springGentle } from '@/lib/motion-tokens';

// セグメンテッドコントロール(radiogroup)。アクティブピルはスプリングで滑る。
// variant: overlay=映像上(暗背景) / surface=設定ページ等の通常面
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  variant = 'overlay',
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
  variant?: 'overlay' | 'surface';
}) {
  const id = useId();
  const overlay = variant === 'overlay';
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'flex items-center rounded-full p-0.5',
        overlay ? 'border border-white/10 bg-black/40 backdrop-blur' : 'border border-border bg-muted',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-short-2 ease-standard',
              overlay
                ? active
                  ? 'text-white'
                  : 'text-white/60 hover:text-white/90'
                : active
                  ? 'text-on-secondary-container'
                  : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active && (
              <m.span
                layoutId={`seg-${id}`}
                transition={springGentle}
                className={cn('absolute inset-0 rounded-full', overlay ? 'bg-white/20' : 'bg-secondary-container')}
              />
            )}
            <span className="relative flex items-center gap-1">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
