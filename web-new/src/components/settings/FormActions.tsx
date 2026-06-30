import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function FormActions({
  onSave,
  onCancel,
  saving,
  dirty,
}: {
  onSave: () => void;
  onCancel?: () => void;
  saving?: boolean;
  dirty?: boolean;
}) {
  const { t } = useTranslation('ui');
  return (
    <div className="sticky bottom-20 flex gap-2 border-t border-border bg-background/95 py-3 md:bottom-0">
      <Button onClick={onSave} disabled={!dirty || saving}>
        {t('common.save')}
      </Button>
      {onCancel && (
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          {t('common.cancel')}
        </Button>
      )}
    </div>
  );
}
