import { useState } from 'react';
import { CalendarClock, DownloadCloud, FileArchive, HeartPulse, Link2, Power, Wifi } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { RebootScheduleEditor, Section, SettingAction, SettingInput, SettingSwitch, UnsavedBar } from '@/components/settings';
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
      <h1 className="text-title-xl">{t('maintenance.tab')}</h1>
      <Section title={t('monitoring.title')}>
        <SettingSwitch icon={Wifi} i18nKey="monitoring.network" value={draft.MONITORING_NETWORK ?? 'on'} onChange={(v) => patch({ MONITORING_NETWORK: v })} />
        <SettingSwitch icon={HeartPulse} i18nKey="monitoring.ping" value={draft.HEALTHCHECK ?? 'off'} onChange={(v) => patch({ HEALTHCHECK: v })} />
        {draft.HEALTHCHECK === 'on' && <SettingInput icon={Link2} i18nKey="monitoring.URL" value={draft.HEALTHCHECK_PING_URL ?? ''} onChange={(v) => patch({ HEALTHCHECK_PING_URL: v })} />}
      </Section>
      <Section title={t('update.title')}>
        <SettingAction i18nKey="update.toolsUpdate" icon={DownloadCloud}>
          <Button
            variant="destructive"
            size="sm"
            disabled={!!busy}
            onClick={() => {
              setBusy('update');
              runCmd(api.exec('update'), { onFinally: () => setBusy('') });
            }}
          >
            {t('update.toolsUpdate.button')}
          </Button>
        </SettingAction>
        <SettingSwitch icon={FileArchive} i18nKey="update.customZip" value={draft.CUSTOM_ZIP ?? 'off'} onChange={(v) => patch({ CUSTOM_ZIP: v })} />
        {draft.CUSTOM_ZIP === 'on' && <SettingInput icon={Link2} i18nKey="update.customZip.URL" value={draft.CUSTOM_ZIP_URL ?? ''} onChange={(v) => patch({ CUSTOM_ZIP_URL: v })} />}
      </Section>
      <Section title={t('reboot.title')}>
        <SettingSwitch icon={CalendarClock} i18nKey="reboot.periodicRestart" value={draft.REBOOT ?? 'off'} onChange={(v) => patch({ REBOOT: v })} />
        {draft.REBOOT === 'on' && <RebootScheduleEditor value={reboot} onChange={setRebootEdit} />}
        <SettingAction i18nKey="reboot.reboot" icon={Power}>
          <Button variant="destructive" size="sm" onClick={() => runCmd(api.exec('reboot'))}>{t('reboot.reboot.button')}</Button>
        </SettingAction>
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
