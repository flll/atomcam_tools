import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RebootScheduleEditor, Section, SettingInput, SettingSwitch, UnsavedBar } from '@/components/settings';
import { useHackIniForm } from '@/hooks/useHackIniForm';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { runCmd } from '@/lib/runCmd';
import { parseRebootSchedule, serializeRebootSchedule } from '@/lib/schedule';
import type { RebootSchedule } from '@/api';

export default function MaintenancePage() {
  const { t } = useTranslation('translation');
  const { draft, patch, submit, reset, dirty, isLoading } = useHackIniForm();
  const [busy, setBusy] = useState('');
  // 定期再起動スケジュール: 編集差分 ?? draft からの導出
  const [rebootEdit, setRebootEdit] = useState<RebootSchedule | null>(null);
  const reboot = rebootEdit ?? parseRebootSchedule(draft.REBOOT_SCHEDULE);
  const rebootValid = reboot.dayOfWeekSelect.length > 0;

  async function save() {
    await submit(rebootEdit ? { REBOOT_SCHEDULE: serializeRebootSchedule(rebootEdit) } : undefined);
    setRebootEdit(null);
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
        <Button
          variant="destructive"
          disabled={!!busy}
          onClick={() => {
            setBusy('update');
            runCmd(api.exec('update'), { onFinally: () => setBusy('') });
          }}
        >
          {t('update.toolsUpdate.title')}
        </Button>
        <SettingSwitch i18nKey="update.customZip" value={draft.CUSTOM_ZIP ?? 'off'} onChange={(v) => patch({ CUSTOM_ZIP: v })} />
        {draft.CUSTOM_ZIP === 'on' && <SettingInput i18nKey="update.customZip.URL" value={draft.CUSTOM_ZIP_URL ?? ''} onChange={(v) => patch({ CUSTOM_ZIP_URL: v })} />}
      </Section>
      <Section title={t('reboot.title')}>
        <SettingSwitch i18nKey="reboot.periodicRestart" value={draft.REBOOT ?? 'off'} onChange={(v) => patch({ REBOOT: v })} />
        {draft.REBOOT === 'on' && <RebootScheduleEditor value={reboot} onChange={setRebootEdit} />}
        <Button variant="destructive" onClick={() => runCmd(api.exec('reboot'))}>{t('reboot.reboot.button')}</Button>
      </Section>
      <UnsavedBar
        dirty={dirty || rebootEdit !== null}
        disabled={isLoading || !!busy || !rebootValid}
        onSave={save}
        onCancel={() => {
          reset();
          setRebootEdit(null);
        }}
      />
    </div>
  );
}
