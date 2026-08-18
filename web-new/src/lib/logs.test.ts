import { describe, expect, it } from 'vitest';
import { LOG_IDS, isLogId } from './logs';

describe('LOG_IDS', () => {
  it('accepts allowlisted ids only', () => {
    expect(isLogId('atomhack')).toBe(true);
    expect(LOG_IDS).toContain('healthcheck');
  });

  it('rejects path traversal and secrets files', () => {
    expect(isLogId('../hack.ini')).toBe(false);
    expect(isLogId('hack.ini')).toBe(false);
    expect(isLogId('atomhack.log')).toBe(false);
    expect(isLogId('')).toBe(false);
  });
});
