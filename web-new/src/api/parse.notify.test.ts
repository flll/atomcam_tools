import { describe, expect, it } from 'vitest';
import { parseNotifyStatus } from './parse';

describe('parseNotifyStatus', () => {
  it('正常な JSON を読む', () => {
    expect(parseNotifyStatus('{"channel":"mqtt","event":"testEvent","ok":true,"at":"2026/07/11 02:00:00"}')).toEqual({
      channel: 'mqtt',
      event: 'testEvent',
      ok: true,
      at: '2026/07/11 02:00:00',
    });
  });

  it('空 JSON は空オブジェクト', () => {
    expect(parseNotifyStatus('{}')).toEqual({});
  });

  it('壊れた入力は空オブジェクトに握りつぶす', () => {
    expect(parseNotifyStatus('not json')).toEqual({});
    expect(parseNotifyStatus('')).toEqual({});
  });
});
