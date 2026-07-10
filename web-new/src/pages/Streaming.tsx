import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Airplay,
  Cat,
  Check,
  Copy,
  Film,
  Globe,
  House,
  Link2,
  Lock,
  QrCode,
  ShieldAlert,
  Smartphone,
  TimerReset,
  Radio,
  Video,
  Volume2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Section, SettingInput, SettingInputNumber, SettingSelect, SettingSwitch, SubSettings, UnsavedBar } from '@/components/settings';
import { Disclosure } from '@/components/ui/disclosure';
import { Button } from '@/components/ui/button';
import { useHackIniForm } from '@/hooks/useHackIniForm';
import { useHackIni } from '@/hooks/useHackIni';
import type { HackIni } from '@/api';
import { frigateSnippet, homeAssistantSnippet, rtspUrl, webrtcPageUrl } from '@/lib/integration-snippets';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

// ---- 小物 ----------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const { t: tUi } = useTranslation('ui');
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 shrink-0"
      aria-label={tUi('hub.copy')}
      title={tUi('hub.copy')}
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
            toast.success(tUi('hub.copied'));
          })
          .catch(() => toast.error(tUi('common.execFailed', { defaultValue: 'copy failed' })));
      }}
    >
      {done ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

// URL 1行: mono 表示+コピー+QR(スマホの VLC 等で即読み取り)
function UrlRow({ url, qrLabel }: { url: string; qrLabel: string }) {
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  async function toggleQr() {
    if (!qrOpen && !qrSvg) {
      // qrcode-generator はこのページでしか使わないため遅延ロード
      const mod = await import('qrcode-generator');
      const qr = mod.default(0, 'M');
      qr.addData(url);
      qr.make();
      setQrSvg(qr.createSvgTag(4, 2));
    }
    setQrOpen((v) => !v);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface-container-low px-2 py-1">
        <code className="min-w-0 flex-1 truncate font-mono text-xs" title={url}>{url}</code>
        <CopyButton text={url} />
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          aria-label={qrLabel}
          title={qrLabel}
          aria-expanded={qrOpen}
          onClick={() => void toggleQr()}
        >
          <QrCode className="size-3.5" />
        </Button>
      </div>
      {qrOpen && qrSvg && (
        <div
          data-testid="qr-popover"
          className="mx-auto w-40 rounded-lg bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      )}
    </div>
  );
}

function SnippetBlock({ text }: { text: string }) {
  return (
    <div className="relative">
      <pre className="max-h-72 overflow-auto rounded-md border border-border bg-surface-container-low p-3 pr-10 font-mono text-[11px] leading-relaxed">{text}</pre>
      <div className="absolute right-1.5 top-1.5">
        <CopyButton text={text} />
      </div>
    </div>
  );
}

function IntegrationCard({
  icon: Icon,
  title,
  desc,
  badge,
  children,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  badge?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary-container text-on-secondary-container">
          <Icon aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {title}
            {badge && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">{badge}</span>
            )}
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ---- ページ本体 -----------------------------------------------------------

export default function StreamingPage() {
  const { t } = useTranslation('translation');
  const { t: tUi } = useTranslation('ui');
  const { config } = useHackIni();
  const { draft, patch, submit, reset, dirty, isLoading } = useHackIniForm();
  const host = typeof window !== 'undefined' ? window.location.hostname : 'atomcam.local';
  const isAtom = config?.PRODUCT_MODEL?.startsWith('ATOM') && config?.PRODUCT_MODEL !== 'ATOM_CAKP1JZJP';

  const auth = { on: draft.RTSP_AUTH === 'on', user: draft.RTSP_USER ?? '', pass: draft.RTSP_PASSWD ?? '' };
  const camName = (config?.HOSTNAME || 'atomcam').toLowerCase().replace(/[^a-z0-9_]/g, '_');

  const mainOn = draft.RTSP_VIDEO0 === 'on';
  const subOn = draft.RTSP_VIDEO1 === 'on';
  const hevcOn = draft.RTSP_VIDEO2 === 'on';
  const webrtcOn = draft.WEBRTC_ENABLE === 'on';
  const rtmpOn = draft.RTMP_ENABLE === 'on';
  const homekitOn = draft.HOMEKIT_ENABLE === 'on';
  const frigateReady = mainOn && subOn;
  const activeStreams = [mainOn, subOn, hevcOn].filter(Boolean).length;
  // 実測(health-audit-20260710): RTSP+WebRTC で used 61/87MB。多重配信は警告する
  const memWarn = activeStreams === 3 || (activeStreams >= 2 && (webrtcOn || rtmpOn));

  // 保存時の自動補完: go2rtc 系(RTMP/WebRTC/HomeKit)を使うのに HOMEKIT_SOURCE が
  // 無いと rtspserver.sh が go2rtc を起動しない(旧 Vue UI が書いていたキー)。
  // HomeKit はペアリングに必要な ID/PIN を旧 UI と同じ規則で自動生成する。
  async function save() {
    const overrides: Partial<HackIni> = {};
    const anyGo2rtc = rtmpOn || webrtcOn || homekitOn;
    if (anyGo2rtc && !(draft.HOMEKIT_SOURCE ?? config?.HOMEKIT_SOURCE)) {
      overrides.HOMEKIT_SOURCE = 'rtsp://localhost:8554/video0_unicast';
    }
    if (rtmpOn) {
      // RTMP(YouTube 等)はメイン配信+AAC/off 音声が前提。ユーザーに依存関係を
      // 解かせず、こちらで整える(ユースケース駆動)
      if (!mainOn) overrides.RTSP_VIDEO0 = 'on';
      const a = draft.RTSP_AUDIO0 ?? 'OPUS';
      if (a !== 'AAC' && a !== 'off') overrides.RTSP_AUDIO0 = 'AAC';
    }
    if (homekitOn) {
      if (!(draft.HOMEKIT_SETUP_ID ?? config?.HOMEKIT_SETUP_ID)) {
        let sid = '';
        for (let i = 0; i < 4; i += 1) sid += String.fromCharCode(Math.floor(Math.random() * 26) + 0x41);
        overrides.HOMEKIT_SETUP_ID = sid;
      }
      if (!(draft.HOMEKIT_PIN ?? config?.HOMEKIT_PIN)) {
        overrides.HOMEKIT_PIN = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
      }
      if (!(draft.HOMEKIT_DEVICE_ID ?? config?.HOMEKIT_DEVICE_ID)) {
        overrides.HOMEKIT_DEVICE_ID = config?.HWADDR ?? '';
      }
    }
    await submit(overrides);
  }

  const pin = draft.HOMEKIT_PIN ?? config?.HOMEKIT_PIN ?? '';
  const pinDisplay = pin.length === 8 ? `${pin.slice(0, 3)}-${pin.slice(3, 5)}-${pin.slice(5)}` : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">{t('RTSP.tab')}</h1>

      {/* 同時有効化の警告(実測に基づく) */}
      {memWarn && (
        <div data-testid="mem-warn" className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="text-xs leading-relaxed">{tUi('hub.memWarn')}</p>
        </div>
      )}

      {/* 連携カード(各カードが枠を持つのでセクション自体はカード化しない) */}
      <Section card={false} title={tUi('hub.integrations')} description={tUi('hub.integrationsDesc')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <IntegrationCard
            icon={Cat}
            title="Frigate"
            desc={tUi('hub.frigate.desc')}
            badge={frigateReady ? tUi('hub.ready') : null}
          >
            {!frigateReady && (
              <Button variant="secondary" size="sm" onClick={() => patch({ RTSP_VIDEO0: 'on', RTSP_VIDEO1: 'on' })}>
                {tUi('hub.frigate.enable')}
              </Button>
            )}
            <Disclosure summary={tUi('hub.snippet')}>
              <p className="text-xs text-muted-foreground">{tUi('hub.frigate.hint')}</p>
              <SnippetBlock text={frigateSnippet(host, camName, auth)} />
            </Disclosure>
          </IntegrationCard>

          <IntegrationCard
            icon={House}
            title="Home Assistant"
            desc={tUi('hub.ha.desc')}
            badge={mainOn ? tUi('hub.ready') : null}
          >
            {!mainOn && (
              <Button variant="secondary" size="sm" onClick={() => patch({ RTSP_VIDEO0: 'on' })}>
                {tUi('hub.ha.enable')}
              </Button>
            )}
            <Disclosure summary={tUi('hub.snippet')}>
              <SnippetBlock text={homeAssistantSnippet(host, camName, auth)} />
            </Disclosure>
          </IntegrationCard>

          <IntegrationCard
            icon={Radio}
            title={tUi('hub.youtube.title')}
            desc={tUi('hub.youtube.desc')}
            badge={rtmpOn ? tUi('hub.enabled') : null}
          >
            <SettingSwitch i18nKey="RTMP" value={draft.RTMP_ENABLE ?? 'off'} onChange={(v) => patch({ RTMP_ENABLE: v })} />
            {rtmpOn && (
              <SubSettings>
                <SettingInput icon={Link2} i18nKey="RTMP.URL" value={draft.RTMP_URL ?? ''} onChange={(v) => patch({ RTMP_URL: v })} />
                <p className="text-xs leading-relaxed text-muted-foreground">{tUi('hub.youtube.autoNote')}</p>
                <SettingInputNumber icon={TimerReset} i18nKey="RTMP.IntervalRestart" value={Math.abs(Number(draft.RTMP_RESTART ?? 240))} min={20} max={2880} onChange={(v) => patch({ RTMP_RESTART: String(-v) })} />
              </SubSettings>
            )}
          </IntegrationCard>

          <IntegrationCard
            icon={Airplay}
            title={tUi('hub.homekit.title')}
            desc={tUi('hub.homekit.desc')}
            badge={homekitOn ? tUi('hub.enabled') : null}
          >
            <SettingSwitch i18nKey="HomeKit" value={draft.HOMEKIT_ENABLE ?? 'off'} onChange={(v) => patch({ HOMEKIT_ENABLE: v })} />
            {homekitOn && (
              <SubSettings>
                {pinDisplay ? (
                  <p className="text-sm">
                    {tUi('hub.homekit.pin')}: <code className="rounded bg-surface-container-low px-2 py-0.5 font-mono text-base tabular-nums">{pinDisplay}</code>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{tUi('hub.homekit.pinAfterSave')}</p>
                )}
                <p className="text-xs leading-relaxed text-muted-foreground">{tUi('hub.homekit.steps')}</p>
              </SubSettings>
            )}
          </IntegrationCard>
        </div>
      </Section>

      {/* 基盤ストリーム */}
      <Section title={tUi('hub.streams')} description={tUi('hub.streamsDesc')}>
        <SettingSwitch icon={Video} i18nKey="RTSP.main" value={draft.RTSP_VIDEO0 ?? 'off'} onChange={(v) => patch({ RTSP_VIDEO0: v })} />
        {mainOn && (
          <SubSettings>
            <SettingSelect icon={Volume2} i18nKey="RTSP.main.audio" value={draft.RTSP_AUDIO0 ?? 'OPUS'} options={['off', 'S16_BE', 'AAC', 'OPUS']} onChange={(v) => patch({ RTSP_AUDIO0: v })} />
            <UrlRow url={rtspUrl(host, 'video0', auth)} qrLabel={tUi('hub.qr')} />
          </SubSettings>
        )}
        <SettingSwitch icon={Smartphone} i18nKey="RTSP.sub" value={draft.RTSP_VIDEO1 ?? 'off'} onChange={(v) => patch({ RTSP_VIDEO1: v })} />
        {subOn && (
          <SubSettings>
            <p className="text-xs leading-relaxed text-muted-foreground">{tUi('hub.subHint')}</p>
            <UrlRow url={rtspUrl(host, 'video1', auth)} qrLabel={tUi('hub.qr')} />
          </SubSettings>
        )}
        <SettingSwitch icon={Lock} i18nKey="RTSP.auth" value={draft.RTSP_AUTH ?? 'off'} onChange={(v) => patch({ RTSP_AUTH: v })} />
        {auth.on && (
          <SubSettings>
            <SettingInput i18nKey="RTSP.account" value={draft.RTSP_USER ?? ''} onChange={(v) => patch({ RTSP_USER: v })} />
            <SettingInput i18nKey="RTSP.password" type="password" value={draft.RTSP_PASSWD ?? ''} onChange={(v) => patch({ RTSP_PASSWD: v })} />
          </SubSettings>
        )}
        <SettingSwitch i18nKey="WebRTC" value={draft.WEBRTC_ENABLE ?? 'off'} onChange={(v) => patch({ WEBRTC_ENABLE: v })} />
        {webrtcOn && mainOn && (
          <SubSettings>
            <UrlRow url={webrtcPageUrl(host, window.location.protocol)} qrLabel={tUi('hub.qr')} />
            <Link to="/" className="inline-block text-sm text-primary underline-offset-2 hover:underline">
              {tUi('live.watchOnLive')}
            </Link>
          </SubSettings>
        )}
      </Section>

      {/* 詳細設定(既定で畳む): HEVC / RTSP over HTTP */}
      <Disclosure summary={<span className={cn('font-medium', (hevcOn || draft.RTSP_OVER_HTTP === 'on') && 'text-primary')}>{tUi('hub.advanced')}</span>}>
        <p className="text-xs leading-relaxed text-muted-foreground">{tUi('hub.hevcNote')}</p>
        {isAtom && (
          <>
            <SettingSwitch icon={Film} i18nKey="RTSP.mainHEVC" value={draft.RTSP_VIDEO2 ?? 'off'} onChange={(v) => patch({ RTSP_VIDEO2: v })} />
            {hevcOn && (
              <SubSettings>
                <UrlRow url={rtspUrl(host, 'video2', auth)} qrLabel={tUi('hub.qr')} />
                <SettingInputNumber i18nKey="videoSpec.bitrateMainHEVC" value={Math.abs(Number(draft.BITRATE_MAIN_HEVC ?? 1024))} min={300} max={2000} onChange={(v) => patch({ BITRATE_MAIN_HEVC: String(v) })} />
              </SubSettings>
            )}
          </>
        )}
        <SettingSwitch icon={Globe} i18nKey="RTSP.http" value={draft.RTSP_OVER_HTTP ?? 'off'} onChange={(v) => patch({ RTSP_OVER_HTTP: v })} />
      </Disclosure>

      <UnsavedBar dirty={dirty} disabled={isLoading} onSave={save} onCancel={reset} />
    </div>
  );
}
