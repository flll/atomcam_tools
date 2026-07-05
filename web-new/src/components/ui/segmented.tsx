import { useId } from 'react';
import type { ReactNode } from 'react';
import { m } from 'motion/react';
import { cn } from '@/lib/utils';
import { springGentle } from '@/lib/motion-tokens';

// 映像オーバーレイ(暗背景)用のセグメンテッドコントロール。
// radiogroup セマンティクス。アクティブピルはスプリングで滑る。
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'flex items-center rounded-full border border-white/10 bg-black/40 p-0.5 backdrop-blur',
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
              active ? 'text-white' : 'text-white/60 hover:text-white/90',
            )}
          >
            {active && (
              <m.span
                layoutId={`seg-${id}`}
                transition={springGentle}
                className="absolute inset-0 rounded-full bg-white/20"
              />
            )}
            <span className="relative flex items-center gap-1">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
