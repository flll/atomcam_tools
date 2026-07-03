import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Section,
  SettingComment,
  SettingInput,
  SettingInputNumber,
  SettingSwitch,
  UnsavedBar,
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
  // スケジュールは「編集差分 ?? draft からの導出」。effect での同期を持たず、
  // 編集した瞬間から dirty(未保存バー)に反映される。
  const [periodicEdit, setPeriodicEdit] = useState<ScheduleEntry[] | null>(null);
  const [alarmEdit, setAlarmEdit] = useState<ScheduleEntry[] | null>(null);
  const [timelapseEdit, setTimelapseEdit] = useState<TimelapseScheduleEntry[] | null>(null);

  const periodic = periodicEdit ?? parsePeriodicAlarmSchedule(draft.PERIODICREC_SCHEDULE_LIST);
  const alarm = alarmEdit ?? parsePeriodicAlarmSchedule(draft.ALARMREC_SCHEDULE_LIST);
  const timelapse = timelapseEdit ?? parseTimelapseSchedule(draft.TIMELAPSE_SCHEDULE);
  const scheduleDirty = periodicEdit !== null || alarmEdit !== null || timelapseEdit !== null;

  function clearEdits() {
    setPeriodicEdit(null);
    setAlarmEdit(null);
    setTimelapseEdit(null);
  }

  async function saveAll() {
    // 編集したスケジュールだけ直列化して submit に合成する
    // (patch → submit の stale-state 問題を避ける)
    const overrides: Parameters<typeof patch>[0] = {};
    if (periodicEdit) overrides.PERIODICREC_SCHEDULE_LIST = serializePeriodicAlarmSchedule(periodicEdit);
    if (alarmEdit) overrides.ALARMREC_SCHEDULE_LIST = serializePeriodicAlarmSchedule(alarmEdit);
    if (timelapseEdit) overrides.TIMELAPSE_SCHEDULE = serializeTimelapseSchedule(timelapseEdit);
    await submit(overrides);
    clearEdits();
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
              {draft.PERIODICREC_SCHEDULE === 'on' && <ScheduleEditor entries={periodic} onChange={setPeriodicEdit} />}
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
              {draft.ALARMREC_SCHEDULE === 'on' && <ScheduleEditor entries={alarm} onChange={setAlarmEdit} />}
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
              <ScheduleEditor entries={timelapse} onChange={(e) => setTimelapseEdit(e as TimelapseScheduleEntry[])} />
            </>
          )}
        </Section>
      )}

      <UnsavedBar
        dirty={dirty || scheduleDirty}
        disabled={isLoading}
        onSave={saveAll}
        onCancel={() => {
          reset();
          clearEdits();
        }}
      />
    </div>
  );
}
