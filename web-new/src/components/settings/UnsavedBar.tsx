import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { runCmd } from '@/lib/runCmd';

// 未保存バー: dirty のときだけ画面下に浮かぶ。保存の成否はトーストで通知し、
// 失敗時はバーが残る(=変更が失われていないことが見た目で分かる)。
export function UnsavedBar({
  dirty,
  onSave,
  onCancel,
  disabled,
}: {
  dirty: boolean;
  onSave: () => Promise<void> | void;
  onCancel?: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation('ui');
  const [saving, setSaving] = useState(false);

  // 未保存のままリロード/タブ閉じを警告する
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  if (!dirty && !saving) return null;

  function handleSave() {
    setSaving(true);
    runCmd(
      Promise.resolve().then(() => onSave()),
      {
        success: t('common.saved'),
        error: t('common.saveFailed'),
        onFinally: () => setSaving(false),
      },
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 px-4 md:bottom-4 md:left-60">
      <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-lg">
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {t('common.unsavedChanges')}
        </span>
        {onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel} disabled={saving || disabled}>
            {t('common.discard')}
          </Button>
        )}
        <Button size="sm" onClick={handleSave} disabled={saving || disabled}>
          {saving ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </div>
  );
}
