import { useTranslation } from 'react-i18next';
import type { HackIni } from '@/api';
import { formatBytes } from '@/lib/format';

// ステージ下の控えめな情報行(PC 常時表示でも視界の邪魔をしない)。
export function SystemInfoRow({
  config,
  media,
}: {
  config?: HackIni;
  media: { available: number; total: number } | null;
}) {
  const { t } = useTranslation();
  const items: { label: string; value: string }[] = [
    { label: t('live.model'), value: config?.PRODUCT_MODEL ?? '–' },
    { label: t('live.firmware'), value: config?.ATOMHACKVER ?? '–' },
    {
      label: t('live.freeSpace'),
      value: media ? `${formatBytes(media.available)} / ${formatBytes(media.total)}` : '–',
    },
  ];
  return (
    <dl className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-4 md:px-8">
      {items.map(({ label, value }) => (
        <div key={label} className="flex items-baseline gap-2">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="font-mono text-sm tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
