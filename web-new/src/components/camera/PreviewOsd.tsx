import { AnimatePresence, m } from 'motion/react';
import { springGentle } from '@/lib/motion-tokens';

// プレビュー左上の OSD チップ(「コントラスト 142」「変更前」等)。
// label が null で消える。pointer-events は持たない。
export function PreviewOsd({ label }: { label: string | null }) {
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10">
      <AnimatePresence>
        {label != null && (
          // key は付けない: ラベル変化はテキスト差し替えにして、退場中の旧チップと
          // 2重表示にならないようにする(E2E の strict mode 対策でもある)
          <m.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={springGentle}
            data-testid="preview-osd"
            className="rounded-full bg-black/60 px-3 py-1 text-sm font-medium tabular-nums text-white backdrop-blur-sm"
          >
            {label}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
