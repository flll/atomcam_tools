import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

// 破壊的操作(SD消去など)専用の確認ダイアログ。
// undo できない操作にだけ使う(可逆な操作はトースト+実行で済ませる)。
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: ReactNode;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('ui');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl"
      >
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{description}</div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" autoFocus onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
