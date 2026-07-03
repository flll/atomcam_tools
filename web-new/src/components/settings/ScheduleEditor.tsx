import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  TIMELAPSE_DEFAULT_COUNT,
  TIMELAPSE_DEFAULT_INTERVAL,
  validateScheduleEntry,
  validateTimelapseEntry,
} from '@/lib/schedule';
import type { RebootSchedule, ScheduleEntry, TimelapseScheduleEntry } from '@/api';

// UI 曜日は 0=月 〜 6=日(schedule.ts の cron/Rule 変換と同じ規約)

function DayChips({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const { t } = useTranslation('translation');
  const days = t('schedule.weekDays', { returnObjects: true }) as string[];
  return (
    <div className="flex flex-wrap gap-1" role="group">
      {days.map((label, d) => {
        const active = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={active}
            onClick={() =>
              onChange(active ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b))
            }
            className={cn(
              'h-8 w-8 rounded-full text-xs font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function TimeInput({
  value,
  onChange,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  'aria-label'?: string;
}) {
  return (
    <input
      type="time"
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => {
        if (e.target.value) onChange(e.target.value);
      }}
      className="rounded-md border border-border bg-background px-2 py-1 font-mono text-sm"
    />
  );
}

function EntryErrors({ errors }: { errors: string[] }) {
  const { t } = useTranslation('ui');
  if (errors.length === 0) return null;
  return (
    <ul className="space-y-0.5 text-xs text-destructive">
      {errors.map((e) => (
        <li key={e}>{t(`schedule.${e}`)}</li>
      ))}
    </ul>
  );
}

function EntryFrame({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
  const { t } = useTranslation('ui');
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">{children}</div>
        <Button variant="ghost" size="icon" aria-label={t('schedule.delete')} onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation('ui');
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <Plus className="size-4" /> {t('schedule.add')}
    </Button>
  );
}

// 定期録画・アラーム録画: 曜日 + 開始/終了時刻
export function ScheduleListEditor({
  entries,
  onChange,
}: {
  entries: ScheduleEntry[];
  onChange: (e: ScheduleEntry[]) => void;
}) {
  const { t } = useTranslation('translation');

  function update(i: number, partial: Partial<ScheduleEntry>) {
    onChange(entries.map((e, j) => (j === i ? { ...e, ...partial } : e)));
  }

  return (
    <div className="space-y-2">
      {entries.map((e, i) => (
        <EntryFrame key={i} onDelete={() => onChange(entries.filter((_, j) => j !== i))}>
          <DayChips value={e.dayOfWeekSelect} onChange={(v) => update(i, { dayOfWeekSelect: v })} />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <TimeInput value={e.startTime} aria-label={t('schedule.startTime')} onChange={(v) => update(i, { startTime: v })} />
            <span className="text-muted-foreground">–</span>
            <TimeInput value={e.endTime} aria-label={t('schedule.endTime')} onChange={(v) => update(i, { endTime: v })} />
          </div>
          <EntryErrors errors={validateScheduleEntry(e)} />
        </EntryFrame>
      ))}
      <AddButton
        onClick={() =>
          onChange([
            ...entries,
            { dayOfWeekSelect: [0, 1, 2, 3, 4, 5, 6], startTime: '00:00', endTime: '23:59' },
          ])
        }
      />
    </div>
  );
}

// タイムラプス: 曜日 + 開始時刻 + 周期(秒) + 回数
export function TimelapseScheduleEditor({
  entries,
  onChange,
}: {
  entries: TimelapseScheduleEntry[];
  onChange: (e: TimelapseScheduleEntry[]) => void;
}) {
  const { t } = useTranslation('translation');

  function update(i: number, partial: Partial<TimelapseScheduleEntry>) {
    onChange(entries.map((e, j) => (j === i ? { ...e, ...partial } : e)));
  }

  return (
    <div className="space-y-2">
      {entries.map((e, i) => (
        <EntryFrame key={i} onDelete={() => onChange(entries.filter((_, j) => j !== i))}>
          <DayChips value={e.dayOfWeekSelect} onChange={(v) => update(i, { dayOfWeekSelect: v })} />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <TimeInput value={e.startTime} aria-label={t('schedule.startTime')} onChange={(v) => update(i, { startTime: v })} />
            <label className="flex items-center gap-1 text-muted-foreground">
              {t('schedule.timelapse.interval.title')}
              <input
                type="number"
                min={1}
                value={e.interval}
                onChange={(ev) => update(i, { interval: Number(ev.target.value) })}
                className="w-20 rounded-md border border-border bg-background px-2 py-1 font-mono text-sm text-foreground"
              />
              {t('schedule.timelapse.interval.unit')}
            </label>
            <label className="flex items-center gap-1 text-muted-foreground">
              ×
              <input
                type="number"
                min={1}
                value={e.count}
                onChange={(ev) => update(i, { count: Number(ev.target.value) })}
                className="w-20 rounded-md border border-border bg-background px-2 py-1 font-mono text-sm text-foreground"
              />
              {t('schedule.timelapse.interval.count')}
            </label>
          </div>
          <EntryErrors errors={validateTimelapseEntry(e)} />
        </EntryFrame>
      ))}
      <AddButton
        onClick={() =>
          onChange([
            ...entries,
            {
              dayOfWeekSelect: [0, 1, 2, 3, 4, 5, 6],
              startTime: '04:00',
              endTime: '23:59',
              interval: TIMELAPSE_DEFAULT_INTERVAL,
              count: TIMELAPSE_DEFAULT_COUNT,
            },
          ])
        }
      />
    </div>
  );
}

// 定期再起動: 曜日 + 時刻(1件のみ)
export function RebootScheduleEditor({
  value,
  onChange,
}: {
  value: RebootSchedule;
  onChange: (v: RebootSchedule) => void;
}) {
  const { t } = useTranslation('translation');
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <DayChips value={value.dayOfWeekSelect} onChange={(v) => onChange({ ...value, dayOfWeekSelect: v })} />
      <TimeInput value={value.startTime} aria-label={t('schedule.startTime')} onChange={(v) => onChange({ ...value, startTime: v })} />
      <EntryErrors errors={value.dayOfWeekSelect.length === 0 ? ['noDays'] : []} />
    </div>
  );
}
