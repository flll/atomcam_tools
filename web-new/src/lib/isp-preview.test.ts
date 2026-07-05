import { describe, expect, it } from 'vitest';
import { ispDeltaFilter, ispToFactor } from './isp-preview';

describe('ispToFactor', () => {
  it('128 で 1.0 になる', () => {
    expect(ispToFactor(128)).toBeCloseTo(1.0, 5);
  });

  it('単調増加する', () => {
    expect(ispToFactor(0)).toBeLessThan(ispToFactor(64));
    expect(ispToFactor(64)).toBeLessThan(ispToFactor(128));
    expect(ispToFactor(128)).toBeLessThan(ispToFactor(255));
  });

  it('範囲外は 0-255 に clamp される', () => {
    expect(ispToFactor(-50)).toBe(ispToFactor(0));
    expect(ispToFactor(300)).toBe(ispToFactor(255));
  });
});

describe('ispDeltaFilter', () => {
  it('同値なら空文字(恒等)', () => {
    expect(ispDeltaFilter({ cont: 128, bri: 128, sat: 128 }, { cont: 128, bri: 128, sat: 128 })).toBe('');
  });

  it('to が大きいと 1 より大きい係数になる', () => {
    const f = ispDeltaFilter({ bri: 128 }, { bri: 200 });
    expect(f).toMatch(/^brightness\(([\d.]+)\)$/);
    expect(Number(f.match(/\(([\d.]+)\)/)![1])).toBeGreaterThan(1);
  });

  it('to が小さいと 1 未満の係数になる', () => {
    const f = ispDeltaFilter({ cont: 128 }, { cont: 60 });
    expect(Number(f.match(/\(([\d.]+)\)/)![1])).toBeLessThan(1);
  });

  it('差のあるキーだけ含める', () => {
    const f = ispDeltaFilter({ cont: 128, bri: 100, sat: 128 }, { cont: 128, bri: 180, sat: 128 });
    expect(f).toContain('brightness');
    expect(f).not.toContain('contrast');
    expect(f).not.toContain('saturate');
  });

  it('数値でないキーは無視する', () => {
    expect(ispDeltaFilter({}, { cont: 200 })).toBe('');
  });
});
