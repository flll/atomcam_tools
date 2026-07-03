import { describe, expect, it } from 'vitest';
import type { ScheduleEntry, TimelapseScheduleEntry } from '@/api';
import {
  parsePeriodicAlarmSchedule,
  parseRebootSchedule,
  parseTimelapseSchedule,
  serializePeriodicAlarmSchedule,
  serializeRebootSchedule,
  serializeTimelapseSchedule,
  validateScheduleEntry,
  validateTimelapseEntry,
} from './schedule';

describe('parsePeriodicAlarmSchedule', () => {
  it('空・未定義は空配列', () => {
    expect(parsePeriodicAlarmSchedule(undefined)).toEqual([]);
    expect(parsePeriodicAlarmSchedule('')).toEqual([]);
  });

  it('Rule のビット(2<<day)を曜日配列に展開する', () => {
    // 全曜日 = 2+4+...+256 の下位7ビット分 = 254
    const [entry] = parsePeriodicAlarmSchedule('[index_01];Rule=254;ContinueTime=60;StartTime=480;Status=1;DelFlags=1;');
    expect(entry.dayOfWeekSelect).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(entry.startTime).toBe('08:00');
    expect(entry.endTime).toBe('08:59');
  });

  it('StartTime が ContinueTime より先に来ても endTime が正しい', () => {
    const [entry] = parsePeriodicAlarmSchedule('[index_01];Rule=2;StartTime=1380;ContinueTime=60;');
    expect(entry.dayOfWeekSelect).toEqual([0]);
    expect(entry.startTime).toBe('23:00');
    expect(entry.endTime).toBe('23:59');
  });

  it('複数エントリを index 毎に分ける', () => {
    const entries = parsePeriodicAlarmSchedule(
      '[index_01];Rule=2;ContinueTime=30;StartTime=0;[index_02];Rule=4;ContinueTime=60;StartTime=720;',
    );
    expect(entries).toHaveLength(2);
    expect(entries[1].dayOfWeekSelect).toEqual([1]);
    expect(entries[1].startTime).toBe('12:00');
  });
});

describe('serializePeriodicAlarmSchedule', () => {
  it('既知エントリを hack.ini 形式に直列化する', () => {
    const entries: ScheduleEntry[] = [
      { dayOfWeekSelect: [0, 6], startTime: '08:00', endTime: '08:59' },
    ];
    expect(serializePeriodicAlarmSchedule(entries)).toBe(
      '[index_01];Rule=130;ContinueTime=60;StartTime=480;Status=1;DelFlags=1;',
    );
  });

  it('parse → serialize → parse の往復で不変', () => {
    const entries: ScheduleEntry[] = [
      { dayOfWeekSelect: [1, 3, 5], startTime: '06:30', endTime: '07:29' },
      { dayOfWeekSelect: [0], startTime: '22:00', endTime: '23:59' },
    ];
    expect(parsePeriodicAlarmSchedule(serializePeriodicAlarmSchedule(entries))).toEqual(entries);
  });
});

describe('parseTimelapseSchedule', () => {
  it('未設定はデフォルト1件(毎日 04:00 / 60s×960)', () => {
    const [entry] = parseTimelapseSchedule(undefined);
    expect(entry).toEqual({
      dayOfWeekSelect: [0, 1, 2, 3, 4, 5, 6],
      startTime: '04:00',
      endTime: '20:00',
      interval: 60,
      count: 960,
    });
  });

  it('cron 行をパースし cron 曜日(0=日)を UI 曜日(0=月)へ変換する', () => {
    const [entry] = parseTimelapseSchedule('0 4 * * 1:2:3 /scripts/timelapse.sh start 30 480;');
    expect(entry.startTime).toBe('04:00');
    expect(entry.dayOfWeekSelect).toEqual([0, 1, 2]); // cron 月火水 → UI 0,1,2
    expect(entry.interval).toBe(30);
    expect(entry.count).toBe(480);
  });

  it('不正な行は無視する', () => {
    expect(parseTimelapseSchedule('garbage;')).toEqual([]);
  });
});

describe('serializeTimelapseSchedule', () => {
  it('UI 曜日を cron 曜日へ逆変換して直列化する', () => {
    const entries: TimelapseScheduleEntry[] = [
      { dayOfWeekSelect: [0, 1, 2], startTime: '04:00', endTime: '23:59', interval: 30, count: 480 },
    ];
    expect(serializeTimelapseSchedule(entries)).toBe('0 4 * * 1:2:3 /scripts/timelapse.sh start 30 480;');
  });

  it('serialize → parse の往復で曜日・時刻・interval/count が不変', () => {
    const entries: TimelapseScheduleEntry[] = [
      { dayOfWeekSelect: [5, 6], startTime: '21:15', endTime: '23:59', interval: 120, count: 100 },
    ];
    const [roundTripped] = parseTimelapseSchedule(serializeTimelapseSchedule(entries));
    expect(roundTripped.dayOfWeekSelect).toEqual([5, 6]);
    expect(roundTripped.startTime).toBe('21:15');
    expect(roundTripped.interval).toBe(120);
    expect(roundTripped.count).toBe(100);
  });

  it('interval/count 欠損時は既定値(60/960)で直列化する(A-3 修正)', () => {
    const broken = [
      { dayOfWeekSelect: [0], startTime: '04:00', endTime: '23:59' } as TimelapseScheduleEntry,
    ];
    expect(serializeTimelapseSchedule(broken)).toBe('0 4 * * 1 /scripts/timelapse.sh start 60 960;');
  });
});

describe('reboot schedule', () => {
  it('未設定はデフォルト(土曜 02:00)', () => {
    expect(parseRebootSchedule(undefined)).toEqual({ dayOfWeekSelect: [6], startTime: '02:00' });
    expect(parseRebootSchedule('not-a-cron')).toEqual({ dayOfWeekSelect: [6], startTime: '02:00' });
  });

  it('cron 行の往復で不変', () => {
    const reboot = { dayOfWeekSelect: [2, 4], startTime: '03:05' };
    const raw = serializeRebootSchedule(reboot);
    expect(raw).toBe('5 3 * * 3:5');
    expect(parseRebootSchedule(raw)).toEqual(reboot);
  });

  it('cron 曜日 0(日曜) は UI 曜日 6 に対応する', () => {
    expect(parseRebootSchedule('0 2 * * 0')).toEqual({ dayOfWeekSelect: [6], startTime: '02:00' });
  });
});

describe('validateScheduleEntry', () => {
  it('正常なエントリはエラーなし', () => {
    expect(validateScheduleEntry({ dayOfWeekSelect: [0], startTime: '08:00', endTime: '09:00' })).toEqual([]);
  });

  it('曜日ゼロ選択・時刻逆転を検出する', () => {
    expect(validateScheduleEntry({ dayOfWeekSelect: [], startTime: '08:00', endTime: '09:00' })).toEqual(['errNoDays']);
    expect(validateScheduleEntry({ dayOfWeekSelect: [0], startTime: '10:00', endTime: '09:00' })).toEqual(['errTimeRange']);
    expect(validateScheduleEntry({ dayOfWeekSelect: [0], startTime: '10:00', endTime: '10:00' })).toEqual(['errTimeRange']);
  });
});

describe('validateTimelapseEntry', () => {
  it('interval/count の下限と曜日を検証する', () => {
    const base = { dayOfWeekSelect: [0], startTime: '04:00', endTime: '23:59' };
    expect(validateTimelapseEntry({ ...base, interval: 60, count: 960 })).toEqual([]);
    expect(validateTimelapseEntry({ ...base, interval: 0, count: 960 })).toEqual(['errInterval']);
    expect(validateTimelapseEntry({ ...base, interval: 60, count: NaN })).toEqual(['errCount']);
    expect(validateTimelapseEntry({ ...base, dayOfWeekSelect: [], interval: 60, count: 960 })).toEqual(['errNoDays']);
  });
});
