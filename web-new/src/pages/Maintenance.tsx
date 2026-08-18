import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, DownloadCloud, FileArchive, HeartPulse, Link2, Power, RefreshCw, Wifi } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { RebootScheduleEditor, Section, SettingAction, SettingInput, SettingSwitch, UnsavedBar } from '@/components/settings';
import { useHackIniForm } from '@/hooks/useHackIniForm';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { runCmd } from '@/lib/runCmd';
import { parseRebootSchedule, serializeRebootSchedule } from '@/lib/schedule';
import type { RebootSchedule } from '@/api';
import { WebUiAuthSection } from '@/components/auth/WebUiAuthSection';
import { LOG_IDS, type LogId } from '@/lib/logs';

function LogViewer() {
  const { t } = useTranslation();
  const [file, setFile] = useState<LogId>('atomhack');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setErr('');
    try {
      const body = await api.getLog(file, 200);
      const first = body.trim().split('\n', 1)[0] ?? '';
      if (first.startsWith('ERROR=')) {
        const code = first.slice('ERROR='.length);
        setText('');
        setErr(code === 'missing' ? t('logs.missing') : t('logs.unknown'));
        return;
      }
      setText(body);
    } catch {
      setErr(t('common.execFailed'));
      setText('');
    } finally {
      setBusy(false);
    }
  }, [file, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Section
      title={t('logs.title')}
      description={t('logs.hint')}
      action={
        <Button variant="ghost" size="sm" className="gap-2" disabled={busy} onClick={() => void load()}>
          <RefreshCw className="size-4" />
          {t('logs.refresh')}
        </Button>
      }
    >
      <label className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <span className="text-title-s">{t('logs.file')}</span>
        <select
          className="shrink-0 rounded-control border border-input bg-background px-3 py-1.5 text-sm"
          value={file}
          disabled={busy}
          onChange={(e) => setFile(e.target.value as LogId)}
        >
          {LOG_IDS.map((id) => (
            <option key={id} value={id}>
              {t(`logs.${id}`)}
            </option>
          ))}
        </select>
      </label>
      <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-all px-4 py-3 font-mono text-xs leading-5 text-muted-foreground">
        {err || text || t('logs.empty')}
      </pre>
    </Section>
  );
}

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
      <LogViewer />
      <WebUiAuthSection />
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
