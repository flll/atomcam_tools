import type { HackIni } from '@/api';

// hack.ini のうち tailscale.sh が読むキー。保存後の適用(restart/stop)判定に使う
export const TAILSCALE_KEYS = [
  'TAILSCALE_ENABLE',
  'TAILSCALE_AUTH_KEY',
  'TAILSCALE_HOSTNAME',
  'TAILSCALE_TAGS',
  'TAILSCALE_EXITNODE_ONLY',
  'TAILSCALE_EXTRA_ARGS',
] as const;

export function tailscaleChanged(prev: HackIni | undefined, next: HackIni): boolean {
  return TAILSCALE_KEYS.some((k) => (prev?.[k] ?? '') !== (next[k] ?? ''));
}

// 適用すると tailscale 経由のアクセスを失い得る変更(締め出しリスク)
export type TailscaleRisk = 'tags' | 'hostname' | 'authKey' | 'disable' | 'exitNodeOnly';

export function tailscaleRisks(prev: HackIni | undefined, next: HackIni): TailscaleRisk[] {
  const risks: TailscaleRisk[] = [];
  const was = (k: keyof HackIni) => prev?.[k] ?? '';
  const now = (k: keyof HackIni) => next[k] ?? '';
  if (was('TAILSCALE_ENABLE') === 'on' && now('TAILSCALE_ENABLE') !== 'on') risks.push('disable');
  // 無効のまま他項目を触っても適用されないので、以降は有効時のみ
  if (now('TAILSCALE_ENABLE') !== 'on') return risks;
  if (was('TAILSCALE_TAGS') !== now('TAILSCALE_TAGS')) risks.push('tags');
  if (was('TAILSCALE_HOSTNAME') !== now('TAILSCALE_HOSTNAME')) risks.push('hostname');
  if (was('TAILSCALE_AUTH_KEY') !== now('TAILSCALE_AUTH_KEY') && was('TAILSCALE_AUTH_KEY') !== '')
    risks.push('authKey');
  if (was('TAILSCALE_EXITNODE_ONLY') !== 'on' && now('TAILSCALE_EXITNODE_ONLY') === 'on')
    risks.push('exitNodeOnly');
  return risks;
}

// 現在のページを tailscale 経由(MagicDNS / 100.x CGNAT)で開いているか。
// LAN 名(mDNS 等)と短縮 MagicDNS 名は区別できないため、dnsName の先頭ラベル一致も
// tailnet 扱いにする(安全側: 警告が1回多く出るだけ)。
export function isTailnetAccess(host: string, dnsName?: string): boolean {
  const h = host.toLowerCase();
  if (h.endsWith('.ts.net')) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)) return true;
  const label = (dnsName ?? '').toLowerCase().split('.')[0];
  return label !== '' && h === label;
}
