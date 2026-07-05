import { AnimatePresence, m } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/sheet';
import { springBouncy } from '@/lib/motion-tokens';
import { PtzPad } from './PtzPad';

// PTZ 操作パネル。
// - デスクトップ: ステージ右下の半透明フローティングカード
// - モバイル: ボトムシート
export function PtzPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="hidden md:block">
        <AnimatePresence>
          {open && (
            <m.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={springBouncy}
              className="absolute bottom-20 right-4 z-20 w-72 rounded-3xl bg-surface-container-high/95 p-4 shadow-elevation-3 backdrop-blur"
              aria-label={t('live.ptz')}
            >
              <PtzPad />
            </m.div>
          )}
        </AnimatePresence>
      </div>
      <div className="md:hidden">
        <Sheet open={open} onClose={onClose} label={t('live.ptz')}>
          <PtzPad />
        </Sheet>
      </div>
    </>
  );
}
