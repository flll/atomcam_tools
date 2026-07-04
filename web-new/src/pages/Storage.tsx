import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Section, SettingInput, SettingSwitch, UnsavedBar } from '@/components/settings';
import { useHackIniForm } from '@/hooks/useHackIniForm';
import { useCameraStatus } from '@/hooks/useCameraStatus';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api } from '@/api';
import { runCmd } from '@/lib/runCmd';
import { formatBytes } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function StoragePage() {
  const { t } = useTranslation('translation');
  const { t: tUi } = useTranslation('ui');
  const { draft, patch, submit, reset, dirty, isLoading } = useHackIniForm();
  const { media } = useCameraStatus();
  const [confirmErase, setConfirmErase] = useState(false);

  const used = media ? media.total - media.available : 0;
  const pct = media && media.total > 0 ? Math.min(100, Math.round((used / media.total) * 100)) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">{t('SDCardSettings.title')}</h1>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-muted-foreground">{tUi('storage.usageTitle')}</h2>
          <span className="font-mono text-xs text-muted-foreground">
            {media ? `${formatBytes(used)} / ${formatBytes(media.total)}` : '–'}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-all', pct >= 90 ? 'bg-destructive' : 'bg-primary')}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{tUi('storage.usedPct', { pct })}</span>
          <span>{media ? tUi('storage.free', { free: formatBytes(media.available) }) : ''}</span>
        </div>
      </section>

      <Section title={t('SDCardSettings.title')} description={tUi('storage.sdSectionDesc')}>
        <SettingSwitch i18nKey="SDCardSettings.smbAccess" value={draft.STORAGE_SDCARD_PUBLISH ?? 'off'} onChange={(v) => patch({ STORAGE_SDCARD_PUBLISH: v })} />
        <SettingSwitch i18nKey="SDCardSettings.directWrite" value={draft.STORAGE_SDCARD_DIRECT_WRITE ?? 'off'} onChange={(v) => patch({ STORAGE_SDCARD_DIRECT_WRITE: v })} />
        <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/40 px-3 py-2">
          <span className="min-w-0">
            <span className="block text-sm">{t('SDCardSettings.eraseSDCard.title')}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              {t('SDCardSettings.eraseSDCard.tooltip')}
            </span>
          </span>
          <Button variant="destructive" className="shrink-0" onClick={() => setConfirmErase(true)}>
            {t('SDCardSettings.eraseSDCard.title')}
          </Button>
        </div>
      </Section>

      <Section title={t('NASSettings.title')} description={tUi('storage.nasSectionDesc')}>
        <SettingInput i18nKey="NASSettings.networkPath" value={draft.STORAGE_CIFSSERVER ?? ''} onChange={(v) => patch({ STORAGE_CIFSSERVER: v.replace(/\\/g, '/') })} />
        <SettingInput i18nKey="NASSettings.account" value={draft.STORAGE_CIFSUSER ?? ''} onChange={(v) => patch({ STORAGE_CIFSUSER: v })} />
        <SettingInput i18nKey="NASSettings.password" type="password" value={draft.STORAGE_CIFSPASSWD ?? ''} onChange={(v) => patch({ STORAGE_CIFSPASSWD: v })} />
      </Section>

      <UnsavedBar dirty={dirty} disabled={isLoading} onSave={() => submit()} onCancel={reset} />

      <ConfirmDialog
        open={confirmErase}
        destructive
        title={tUi('storage.eraseConfirmTitle')}
        description={tUi('storage.eraseConfirmBody')}
        confirmLabel={tUi('storage.eraseConfirmAction')}
        onCancel={() => setConfirmErase(false)}
        onConfirm={() => {
          setConfirmErase(false);
          runCmd(api.exec('sderase'), { success: tUi('storage.eraseStarted') });
        }}
      />
    </div>
  );
}
