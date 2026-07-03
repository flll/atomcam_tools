import type { RebootSchedule, ScheduleEntry, TimelapseScheduleEntry } from '@/api';

export const TIMELAPSE_DEFAULT_INTERVAL = 60;
export const TIMELAPSE_DEFAULT_COUNT = 960;

// エラーは ui.json の schedule.<キー> に対応する
export type ScheduleError = 'errNoDays' | 'errTimeRange' | 'errInterval' | 'errCount';

export function validateScheduleEntry(entry: ScheduleEntry): ScheduleError[] {
  const errors: ScheduleError[] = [];
  if (entry.dayOfWeekSelect.length === 0) errors.push('errNoDays');
  if (parseTimeToMinutes(entry.endTime) <= parseTimeToMinutes(entry.startTime)) {
    errors.push('errTimeRange');
  }
  return errors;
}

export function validateTimelapseEntry(entry: TimelapseScheduleEntry): ScheduleError[] {
  const errors: ScheduleError[] = [];
  if (entry.dayOfWeekSelect.length === 0) errors.push('errNoDays');
  if (!Number.isFinite(entry.interval) || entry.interval < 1) errors.push('errInterval');
  if (!Number.isFinite(entry.count) || entry.count < 1) errors.push('errCount');
  return errors;
}

function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function parsePeriodicAlarmSchedule(raw: string | undefined): ScheduleEntry[] {
  if (!raw) return [];
  const out: ScheduleEntry[] = [];
  let index = -1;
  let continueTime: number | null = null;
  for (const part of raw.split(';')) {
    if (!part) continue;
    if (/\[index_.*\]/.test(part)) {
      index += 1;
      continueTime = null;
      out[index] = { dayOfWeekSelect: [], startTime: '00:00', endTime: '23:59' };
      continue;
    }
    const entry = out[index];
    if (!entry) continue;
    const [k, v] = part.split('=');
    if (k === 'Rule') {
      const rule = Number(v);
      entry.dayOfWeekSelect = [];
      for (let i = 0; i < 7; i++) if (rule & (2 << i)) entry.dayOfWeekSelect.push(i);
    }
    if (k === 'StartTime') {
      const st = Number(v);
      entry.startTime = minutesToTime(st);
      if (continueTime != null) entry.endTime = minutesToTime(st + continueTime - 1);
    }
    if (k === 'ContinueTime') {
      continueTime = Number(v);
      const st = parseTimeToMinutes(entry.startTime);
      entry.endTime = minutesToTime(st + continueTime - 1);
    }
  }
  return out.filter(Boolean);
}

export function serializePeriodicAlarmSchedule(entries: ScheduleEntry[]): string {
  let str = '';
  entries.forEach((timeTable, i) => {
    str += `[index_${(i + 1).toString().padStart(2, '0')}];`;
    const val = timeTable.dayOfWeekSelect.reduce((v, d) => v | (2 << d), 0);
    str += `Rule=${val};`;
    const stime = parseTimeToMinutes(timeTable.startTime);
    const etime = parseTimeToMinutes(timeTable.endTime) + 1;
    str += `ContinueTime=${etime - stime};`;
    str += `StartTime=${stime};`;
    str += `Status=1;`;
    str += `DelFlags=1;`;
  });
  return str;
}

export function parseTimelapseSchedule(raw: string | undefined): TimelapseScheduleEntry[] {
  if (!raw) return [{ dayOfWeekSelect: [0, 1, 2, 3, 4, 5, 6], startTime: '04:00', endTime: '20:00', interval: 60, count: 960 }];
  return raw
    .split(';')
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^\s*(\d+)\s+(\d+)\s+\*\s+\*\s+([\d:]+)\s+\/scripts\/timelapse\.sh start (\d+) (\d+)/);
      if (!m) return null;
      const [, min, hour, days, interval, count] = m;
      const dayOfWeekSelect = days.split(':').map((d) => (Number(d) + 6) % 7);
      return {
        dayOfWeekSelect,
        startTime: `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`,
        endTime: '23:59',
        interval: Number(interval),
        count: Number(count),
      } satisfies TimelapseScheduleEntry;
    })
    .filter(Boolean) as TimelapseScheduleEntry[];
}

export function serializeTimelapseSchedule(entries: TimelapseScheduleEntry[]): string {
  return entries.reduce((str, schedule) => {
    const days = schedule.dayOfWeekSelect
      .slice()
      .sort((a, b) => a - b)
      .map((d) => ((d + 1) % 7).toString())
      .join(':');
    // interval/count 欠損時は既定値で防御(壊れた cron 行を hack.ini に書かない)
    const interval = Number.isFinite(schedule.interval) && schedule.interval >= 1 ? schedule.interval : TIMELAPSE_DEFAULT_INTERVAL;
    const count = Number.isFinite(schedule.count) && schedule.count >= 1 ? schedule.count : TIMELAPSE_DEFAULT_COUNT;
    str +=
      `${parseInt(schedule.startTime.slice(-2), 10)} ${parseInt(schedule.startTime.slice(0, 2), 10)} * * ${days} /scripts/timelapse.sh start ${interval} ${count};`;
    return str;
  }, '');
}

export function parseRebootSchedule(raw: string | undefined): RebootSchedule {
  if (!raw) return { dayOfWeekSelect: [6], startTime: '02:00' };
  const m = raw.match(/^\s*(\d+)\s+(\d+)\s+\*\s+\*\s+(.+)$/);
  if (!m) return { dayOfWeekSelect: [6], startTime: '02:00' };
  const [, min, hour, days] = m;
  return {
    dayOfWeekSelect: days.split(':').map((d) => (Number(d) + 6) % 7),
    startTime: `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`,
  };
}

export function serializeRebootSchedule(reboot: RebootSchedule): string {
  const days = reboot.dayOfWeekSelect
    .slice()
    .sort((a, b) => a - b)
    .map((d) => ((d + 1) % 7).toString())
    .join(':');
  return `${parseInt(reboot.startTime.slice(-2), 10)} ${parseInt(reboot.startTime.slice(0, 2), 10)} * * ${days}`;
}
