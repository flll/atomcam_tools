import type { ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { springBouncy } from '@/lib/motion-tokens';

// 汎用ボトムシート(モバイル)。スプリングで出入りする。
export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={label}>
          <m.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-scrim/60"
            aria-label={t('common.close')}
            onClick={onClose}
          />
          <m.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={springBouncy}
            className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface-container-high p-4 pb-8 shadow-elevation-3"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />
            {children}
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
