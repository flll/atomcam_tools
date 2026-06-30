import { useTranslation } from 'react-i18next';
import { useCameraStatus } from '@/hooks/useCameraStatus';

function formatBytes(n: number): string {
  if (n >= 1 << 30) return `${(n / (1 << 30)).toFixed(1)} GB`;
  if (n >= 1 << 20) return `${(n / (1 << 20)).toFixed(1)} MB`;
  return `${(n / 1024).toFixed(0)} KB`;
}

export default function FilesPage() {
  const { t } = useTranslation('translation');
  const { media } = useCameraStatus();

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-xl font-semibold">{t('SDCard.tab')}</h1>
      {media && (
        <p className="text-sm text-muted-foreground">
          {t('SDCard.remainingCapacity')}: {formatBytes(media.available)} / {formatBytes(media.total)}
        </p>
      )}
      <iframe title="sdcard" src="/sdcard" className="h-[70vh] w-full rounded-xl border border-border bg-card" />
    </div>
  );
}
