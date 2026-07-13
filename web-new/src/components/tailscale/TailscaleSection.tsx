import { useEffect, useState } from 'react';
import { Cat, ExternalLink, KeyRound, Lock, Server, Shield, ShieldCheck, Tags } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Section, SettingInput, SettingSwitch } from '@/components/settings';
import { Disclosure } from '@/components/ui/disclosure';
import { Button } from '@/components/ui/button';
import { CopyButton, SnippetBlock } from '@/components/ui/snippet';
import { api } from '@/api';
import type { HackIni, TailscaleStatus } from '@/api';
import { frigateSnippet, maskAuthKey, tailscaleAclSnippet } from '@/lib/integration-snippets';
import { runCmd } from '@/lib/runCmd';
import { cn } from '@/lib/utils';

const ADMIN_MACHINES = 'https://login.tailscale.com/admin/machines';
const ADMIN_KEYS = 'https://login.tailscale.com/admin/settings/keys';
const ADMIN_ACLS = 'https://login.tailscale.com/admin/acls';

// Discord の bot token 式: 保存済みなら一部マスク表示+「変更」で再入力。
function AuthKeyField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation('translation');
  const { t: tUi } = useTranslation('ui');
  const hasSaved = value !== '';
  const [editing, setEditing] = useState(!hasSaved);

  if (hasSaved && !editing) {
    return (
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-title-s">
            <KeyRound aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            {t('tailscaleSettings.authKey.title')}
          </span>
          <code className="mt-1 block truncate font-mono text-body-xs text-muted-foreground">{maskAuthKey(value)}</code>
        </span>
        {/* 変更でクリア→再入力。既に認証済みなら state 退避で接続は維持される */}
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => { onChange(''); setEditing(true); }}>
          {tUi('ts.authKeyChange')}
        </Button>
      </div>
    );
  }
  return (
    <div className="px-4 py-3">
      <span className="flex items-center gap-2 text-title-s">
        <KeyRound aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        {t('tailscaleSettings.authKey.title')}
      </span>
      <span className="mt-0.5 block text-body-xs text-muted-foreground">{t('tailscaleSettings.authKey.tooltip')}</span>
      <input
        type="password"
        value={value}
        placeholder="tskey-auth-…"
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-control border border-input bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground/50"
      />
      <a href={ADMIN_KEYS} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-body-xs text-info hover:underline">
        {tUi('ts.authKeyGet')}
        <ExternalLink aria-hidden="true" className="size-3" />
      </a>
    </div>
  );
}

function StateBadge({ state }: { state?: string }) {
  const { t: tUi } = useTranslation('ui');
  const s = (state ?? 'stopped').toLowerCase();
  const label = tUi(`ts.state.${s}`, { defaultValue: state ?? '-' });
  const tone =
    s === 'running' ? 'bg-success/15 text-success'
    : s === 'needslogin' || s === 'needsmachineauth' ? 'bg-warning/15 text-warning'
    : s === 'starting' ? 'bg-info/15 text-info'
    : 'bg-muted text-muted-foreground';
  return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', tone)}>{label}</span>;
}

// tailnet URL などの1行(値+コピー)
function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-body-xs text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1">
        <code className="truncate font-mono text-xs">{value}</code>
        <CopyButton text={value} />
      </span>
    </div>
  );
}

function IntegrationCard({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: typeof Cat;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-card border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-control bg-secondary-container text-on-secondary-container">
          <Icon aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function TailscaleSection({
  draft,
  patch,
  config,
}: {
  draft: HackIni;
  patch: (v: Partial<HackIni>) => void;
  config?: HackIni;
}) {
  const { t } = useTranslation('translation');
  const { t: tUi } = useTranslation('ui');
  const enabled = draft.TAILSCALE_ENABLE === 'on';
  const [ts, setTs] = useState<TailscaleStatus>({});

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const fetchStatus = () => {
      runCmd(api.getTailscaleStatus().then((s) => { if (!cancelled) setTs(s); }), { quiet: true });
    };
    fetchStatus();
    const id = setInterval(() => { if (!document.hidden) fetchStatus(); }, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [enabled]);

  const tailnetHost = ts.dnsName || ts.ip || '';
  const connected = (ts.state ?? '').toLowerCase() === 'running' && tailnetHost !== '';
  const auth = { on: draft.RTSP_AUTH === 'on', user: draft.RTSP_USER ?? '', pass: draft.RTSP_PASSWD ?? '' };
  const camName = (config?.HOSTNAME || 'atomcam').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const tag = draft.TAILSCALE_TAGS || 'tag:cctv';

  return (
    <>
      <Section title={t('tailscaleSettings.title')} description={tUi('ts.desc')}>
        <SettingSwitch icon={Shield} i18nKey="tailscaleSettings.enable" value={draft.TAILSCALE_ENABLE ?? 'off'} onChange={(v) => patch({ TAILSCALE_ENABLE: v })} />
        {enabled && (
          <>
            <AuthKeyField value={draft.TAILSCALE_AUTH_KEY ?? ''} onChange={(v) => patch({ TAILSCALE_AUTH_KEY: v })} />
            <SettingInput icon={Server} i18nKey="tailscaleSettings.hostname" value={draft.TAILSCALE_HOSTNAME ?? ''} onChange={(v) => patch({ TAILSCALE_HOSTNAME: v })} />
            <SettingInput icon={Tags} i18nKey="tailscaleSettings.tags" value={draft.TAILSCALE_TAGS ?? 'tag:cctv'} onChange={(v) => patch({ TAILSCALE_TAGS: v })} />
            <SettingSwitch icon={Lock} i18nKey="tailscaleSettings.exitNodeOnly" value={draft.TAILSCALE_EXITNODE_ONLY ?? 'off'} onChange={(v) => patch({ TAILSCALE_EXITNODE_ONLY: v })} />
          </>
        )}
      </Section>

      {enabled && (
        <Section title={tUi('ts.statusTitle')} description={tUi('ts.statusDesc')}>
          <div className="space-y-2 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-body-xs text-muted-foreground">{tUi('ts.stateLabel')}</span>
              <StateBadge state={ts.state} />
            </div>
            {ts.ip && <ValueRow label={tUi('ts.ipLabel')} value={ts.ip} />}
            {ts.dnsName && <ValueRow label={tUi('ts.dnsLabel')} value={ts.dnsName} />}
            {!connected && <p className="text-body-xs text-muted-foreground">{tUi('ts.notConnected')}</p>}
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-title-s">
                <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                {tUi('ts.adminTitle')}
              </span>
              <span className="mt-0.5 block text-body-xs text-muted-foreground">{tUi('ts.adminDesc')}</span>
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              {connected && (
                <a href={`http://${tailnetHost}/`} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    {tUi('ts.openDevice')}
                    <ExternalLink className="size-3.5" />
                  </Button>
                </a>
              )}
              <a href={ADMIN_MACHINES} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm">
                  {tUi('ts.openAdmin')}
                  <ExternalLink className="size-3.5" />
                </Button>
              </a>
            </div>
          </div>
        </Section>
      )}

      {enabled && (
        <Section card={false} title={tUi('ts.integrations')} description={tUi('ts.integrationsDesc')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <IntegrationCard icon={Cat} title="Frigate (tailnet)" desc={tUi('ts.frigate.desc')}>
              {connected ? (
                <Disclosure summary={tUi('hub.snippet')}>
                  <p className="text-xs text-muted-foreground">{tUi('ts.frigate.hint')}</p>
                  <SnippetBlock text={frigateSnippet(tailnetHost, camName, auth)} />
                </Disclosure>
              ) : (
                <p className="text-xs text-muted-foreground">{tUi('ts.needConnected')}</p>
              )}
            </IntegrationCard>

            <IntegrationCard icon={Lock} title={tUi('ts.acl.title')} desc={tUi('ts.acl.desc')}>
              <Disclosure summary={tUi('hub.snippet')}>
                <p className="text-xs text-muted-foreground">{tUi('ts.acl.hint')}</p>
                <SnippetBlock text={tailscaleAclSnippet(tag)} />
                <a href={ADMIN_ACLS} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-body-xs text-info hover:underline">
                  {tUi('ts.acl.openEditor')}
                  <ExternalLink aria-hidden="true" className="size-3" />
                </a>
              </Disclosure>
            </IntegrationCard>
          </div>
        </Section>
      )}
    </>
  );
}
