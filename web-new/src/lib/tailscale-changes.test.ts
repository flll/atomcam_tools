import { describe, expect, it } from 'vitest';
import { isTailnetAccess, tailscaleChanged, tailscaleRisks } from './tailscale-changes';

const base = {
  TAILSCALE_ENABLE: 'on',
  TAILSCALE_AUTH_KEY: 'tskey-auth-abcdefghijklmnopqrstu',
  TAILSCALE_HOSTNAME: 'atomcam',
  TAILSCALE_TAGS: 'tag:cctv',
  TAILSCALE_EXITNODE_ONLY: 'off',
} as const;

describe('tailscaleChanged', () => {
  it('関係キーが同じなら false', () => {
    expect(tailscaleChanged({ ...base }, { ...base, FRAMERATE: '30' })).toBe(false);
  });
  it('タグ変更を検知する', () => {
    expect(tailscaleChanged({ ...base }, { ...base, TAILSCALE_TAGS: 'tag:server' })).toBe(true);
  });
  it('初回設定(prev undefined)も変更扱い', () => {
    expect(tailscaleChanged(undefined, { ...base })).toBe(true);
  });
});

describe('tailscaleRisks', () => {
  it('タグ変更 → tags', () => {
    expect(tailscaleRisks({ ...base }, { ...base, TAILSCALE_TAGS: 'tag:server' })).toEqual(['tags']);
  });
  it('off 化 → disable のみ(他の差分は適用されないので無視)', () => {
    expect(
      tailscaleRisks({ ...base }, { ...base, TAILSCALE_ENABLE: 'off', TAILSCALE_TAGS: 'tag:x' }),
    ).toEqual(['disable']);
  });
  it('ホスト名変更 → hostname', () => {
    expect(tailscaleRisks({ ...base }, { ...base, TAILSCALE_HOSTNAME: 'cam2' })).toEqual(['hostname']);
  });
  it('保存済みキーの変更 → authKey(初回入力は対象外)', () => {
    expect(tailscaleRisks({ ...base }, { ...base, TAILSCALE_AUTH_KEY: 'tskey-auth-xxxxxxxxxxxxxxxxxxxxx' })).toEqual(['authKey']);
    expect(
      tailscaleRisks({ ...base, TAILSCALE_AUTH_KEY: '' }, { ...base }),
    ).toEqual([]);
  });
  it('Tailscale専用通信 on 化 → exitNodeOnly', () => {
    expect(tailscaleRisks({ ...base }, { ...base, TAILSCALE_EXITNODE_ONLY: 'on' })).toEqual(['exitNodeOnly']);
  });
  it('変更なしなら空', () => {
    expect(tailscaleRisks({ ...base }, { ...base })).toEqual([]);
  });
});

describe('isTailnetAccess', () => {
  it('MagicDNS FQDN', () => {
    expect(isTailnetAccess('atomcam.tailnet-demo.ts.net')).toBe(true);
  });
  it('CGNAT 100.64/10', () => {
    expect(isTailnetAccess('100.85.237.96')).toBe(true);
    expect(isTailnetAccess('100.63.0.1')).toBe(false);
    expect(isTailnetAccess('100.128.0.1')).toBe(false);
  });
  it('短縮 MagicDNS 名は dnsName 先頭ラベル一致で tailnet 扱い', () => {
    expect(isTailnetAccess('atomcam', 'atomcam.tailnet-demo.ts.net')).toBe(true);
    expect(isTailnetAccess('10.0.0.228', 'atomcam.tailnet-demo.ts.net')).toBe(false);
  });
});
