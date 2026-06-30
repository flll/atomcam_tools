import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormActions, Section, SettingInput, SettingSwitch } from '@/components/settings';
import { useHackIniForm } from '@/hooks/useHackIniForm';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { parseRebootSchedule, serializeRebootSchedule } from '@/lib/schedule';

export default function MaintenancePage() {
  const { t } = useTranslation('translation');
  const { draft, patch, submit, reset, dirty, isLoading } = useHackIniForm();
  const [busy, setBusy] = useState('');

  async function save() {
    patch({ REBOOT_SCHEDULE: serializeRebootSchedule(parseRebootSchedule(draft.REBOOT_SCHEDULE)) });
    await submit();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">{t('maintenance.tab')}</h1>
      <Section title={t('monitoring.title')}>
        <SettingSwitch i18nKey="monitoring.network" value={draft.MONITORING_NETWORK ?? 'on'} onChange={(v) => patch({ MONITORING_NETWORK: v })} />
        <SettingSwitch i18nKey="monitoring.ping" value={draft.HEALTHCHECK ?? 'off'} onChange={(v) => patch({ HEALTHCHECK: v })} />
        {draft.HEALTHCHECK === 'on' && <SettingInput i18nKey="monitoring.URL" value={draft.HEALTHCHECK_PING_URL ?? ''} onChange={(v) => patch({ HEALTHCHECK_PING_URL: v })} />}
      </Section>
      <Section title={t('update.title')}>
        <Button variant="destructive" disabled={!!busy} onClick={async () => { setBusy('update'); await api.exec('update'); }}>
          {t('update.toolsUpdate.title')}
        </Button>
        <SettingSwitch i18nKey="update.customZip" value={draft.CUSTOM_ZIP ?? 'off'} onChange={(v) => patch({ CUSTOM_ZIP: v })} />
        {draft.CUSTOM_ZIP === 'on' && <SettingInput i18nKey="update.customZip.URL" value={draft.CUSTOM_ZIP_URL ?? ''} onChange={(v) => patch({ CUSTOM_ZIP_URL: v })} />}
      </Section>
      <Section title={t('reboot.title')}>
        <SettingSwitch i18nKey="reboot.periodicRestart" value={draft.REBOOT ?? 'off'} onChange={(v) => patch({ REBOOT: v })} />
        <Button variant="destructive" onClick={() => void api.exec('reboot')}>{t('reboot.reboot.button')}</Button>
      </Section>
      <FormActions dirty={dirty} saving={isLoading || !!busy} onSave={() => void save()} onCancel={reset} />
    </div>
  );
}
