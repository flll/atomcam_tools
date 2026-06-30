// todo:page-recording-alarm
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FormActions,
  Section,
  SettingComment,
  SettingInput,
  SettingInputNumber,
  SettingSwitch,
} from '@/components/settings';
import { useHackIniForm } from '@/hooks/useHackIniForm';
import { usePropertyCmd } from '@/hooks/usePropertyCmd';
import {
  parsePeriodicAlarmSchedule,
  parseTimelapseSchedule,
  serializePeriodicAlarmSchedule,
  serializeTimelapseSchedule,
} from '@/lib/schedule';
import type { ScheduleEntry, TimelapseScheduleEntry } from '@/api';

function ScheduleEditor({
  entries,
  onChange,
}: {
  entries: ScheduleEntry[];
  onChange: (e: ScheduleEntry[]) => void;
}) {
  const { t } = useTranslation('translation');
  return (
    <div className="space-y-2">
      {entries.map((e, i) => (
        <div key={i} className="rounded border border-border p-2 text-sm">
          <label className="block">{t('schedule.startTime')}</label>
          <input className="rounded border px-2 py-1" value={e.startTime} onChange={(ev) => {
            const next = [...entries];
            next[i] = { ...e, startTime: ev.target.value };
            onChange(next);
          }} />
          <label className="mt-1 block">{t('schedule.endTime')}</label>
          <input className="rounded border px-2 py-1" value={e.endTime} onChange={(ev) => {
            const next = [...entries];
            next[i] = { ...e, endTime: ev.target.value };
            onChange(next);
          }} />
        </div>
      ))}
      <button type="button" className="text-sm text-primary" onClick={() => onChange([...entries, { dayOfWeekSelect: [0,1,2,3,4,5,6], startTime: '00:00', endTime: '23:59' }])}>
        + schedule
      </button>
    </div>
  );
}

export default function RecordingPage({ section }: { section?: 'periodic' | 'alarm' | 'timelapse' }) {
  const { t } = useTranslation('translation');
  const { draft, patch, submit, reset, dirty, isLoading } = useHackIniForm();
  const { property } = usePropertyCmd();
  const [periodic, setPeriodic] = useState<ScheduleEntry[]>([]);
  const [alarm, setAlarm] = useState<ScheduleEntry[]>([]);
  const [timelapse, setTimelapse] = useState<TimelapseScheduleEntry[]>([]);

  useEffect(() => {
    setPeriodic(parsePeriodicAlarmSchedule(draft.PERIODICREC_SCHEDULE_LIST));
    setAlarm(parsePeriodicAlarmSchedule(draft.ALARMREC_SCHEDULE_LIST));
    setTimelapse(parseTimelapseSchedule(draft.TIMELAPSE_SCHEDULE));
  }, [draft.PERIODICREC_SCHEDULE_LIST, draft.ALARMREC_SCHEDULE_LIST, draft.TIMELAPSE_SCHEDULE]);

  async function saveAll() {
    patch({
      PERIODICREC_SCHEDULE_LIST: serializePeriodicAlarmSchedule(periodic),
      ALARMREC_SCHEDULE_LIST: serializePeriodicAlarmSchedule(alarm),
      TIMELAPSE_SCHEDULE: serializeTimelapseSchedule(timelapse),
    });
    await submit();
  }

  const showPeriodic = !section || section === 'periodic';
  const showAlarm = !section || section === 'alarm';
  const showTimelapse = !section || section === 'timelapse';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">{t('record.tab')}</h1>

      {showPeriodic && (
        <Section title={t('record.periodicRec.title')}>
          <SettingSwitch i18nKey="record.SDCard" value={draft.PERIODICREC_SDCARD ?? 'on'} onChange={(v) => patch({ PERIODICREC_SDCARD: v })} />
          {draft.PERIODICREC_SDCARD === 'on' && (
            <>
              <SettingSwitch i18nKey="record.SDCard.automaticDeletion" value={draft.PERIODICREC_SDCARD_REMOVE ?? 'off'} onChange={(v) => patch({ PERIODICREC_SDCARD_REMOVE: v })} />
              {draft.PERIODICREC_SDCARD_REMOVE === 'on' && (
                <SettingInputNumber i18nKey="record.SDCard.daysToKeep" value={Number(draft.PERIODICREC_SDCARD_REMOVE_DAYS ?? 30)} min={1} onChange={(v) => patch({ PERIODICREC_SDCARD_REMOVE_DAYS: String(v) })} />
              )}
              {property?.recordType === 'off' && <SettingComment i18nKey="record.recordTypeWarn" tone="danger" />}
              <SettingSwitch i18nKey="record.recordingSchedule" value={draft.PERIODICREC_SCHEDULE ?? 'off'} onChange={(v) => patch({ PERIODICREC_SCHEDULE: v })} />
              {draft.PERIODICREC_SCHEDULE === 'on' && <ScheduleEditor entries={periodic} onChange={setPeriodic} />}
            </>
          )}
        </Section>
      )}

      {showAlarm && (
        <Section title={t('record.alarmRec.title')}>
          <SettingSwitch i18nKey="record.SDCard" value={draft.ALARMREC_SDCARD ?? 'on'} onChange={(v) => patch({ ALARMREC_SDCARD: v })} />
          {draft.ALARMREC_SDCARD === 'on' && (
            <>
              <SettingInput i18nKey="record.SDCard.savePath" value={draft.ALARMREC_SDCARD_PATH ?? ''} onChange={(v) => patch({ ALARMREC_SDCARD_PATH: v })} />
              <SettingSwitch i18nKey="record.recordingSchedule" value={draft.ALARMREC_SCHEDULE ?? 'off'} onChange={(v) => patch({ ALARMREC_SCHEDULE: v })} />
              {draft.ALARMREC_SCHEDULE === 'on' && <ScheduleEditor entries={alarm} onChange={setAlarm} />}
            </>
          )}
        </Section>
      )}

      {showTimelapse && (
        <Section title={t('timelapse.title')}>
          <SettingSwitch i18nKey="record.SDCard" value={draft.TIMELAPSE_SDCARD ?? 'off'} onChange={(v) => patch({ TIMELAPSE_SDCARD: v })} />
          {draft.TIMELAPSE_SDCARD === 'on' && (
            <>
              <SettingInput i18nKey="record.SDCard.savePath" value={draft.TIMELAPSE_SDCARD_PATH ?? ''} onChange={(v) => patch({ TIMELAPSE_SDCARD_PATH: v })} />
              <SettingInputNumber i18nKey="timelapse.fps" value={Number(draft.TIMELAPSE_FPS ?? 20)} min={1} max={60} onChange={(v) => patch({ TIMELAPSE_FPS: String(v) })} />
              <ScheduleEditor entries={timelapse} onChange={(e) => setTimelapse(e as TimelapseScheduleEntry[])} />
            </>
          )}
        </Section>
      )}

      <FormActions dirty={dirty} saving={isLoading} onSave={() => void saveAll()} onCancel={reset} />
    </div>
  );
}
