import { useEffect, useState } from 'react';
import {
  Activity,
  BellRing,
  CircleCheck,
  CircleX,
  FileVideo,
  Image,
  Info,
  KeyRound,
  Link2,
  Radio,
  Send,
  Server,
  ShieldAlert,
  Timer,
  User,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Section, SettingInput, SettingSwitch, UnsavedBar } from '@/components/settings';
import { Disclosure } from '@/components/ui/disclosure';
import { Button } from '@/components/ui/button';
import { useHackIniForm } from '@/hooks/useHackIniForm';
import { useHackIni } from '@/hooks/useHackIni';
import { api } from '@/api';
import type { NotifyStatus } from '@/api';
import { runCmd } from '@/lib/runCmd';
import { cn } from '@/lib/utils';

// 通知先プリセット(貼り付けガイド)。ntfy は直接 POST 可、Discord/Slack は
// JSON 形式が異なるため中継を案内する(正直に)。
const PRESETS = [
  { key: 'ntfy', label: 'ntfy', url: 'https://ntfy.sh/atomcam-alerts' },
  { key: 'discord', label: 'Discord / Slack', url: '' },
] as const;

// 実装済み送信元があるイベントだけ露出する(webhook.sh / mv / rm / timelapse.sh で確認済み)
const EVENTS: { key: string; hackKey: string; icon: typeof BellRing; atomOnly?: boolean }[] = [
  { key: 'alarm', hackKey: 'WEBHOOK_ALARM_EVENT', icon: BellRing },
  { key: 'information', hackKey: 'WEBHOOK_ALARM_INFO', icon: Info, atomOnly: true },
  { key: 'recordingSave', hackKey: 'WEBHOOK_RECORD_EVENT', icon: FileVideo },
  { key: 'recordingEnd', hackKey: 'WEBHOOK_ALARM_VIDEO_FINISH', icon: FileVideo },
  { key: 'recordingTransfer', hackKey: 'WEBHOOK_ALERM_VIDEO', icon: FileVideo },
  { key: 'screenshotEnd', hackKey: 'WEBHOOK_ALARM_PICT_FINISH', icon: Image },
  { key: 'screenshotTransfer', hackKey: 'WEBHOOK_ALERM_PICT', icon: Image },
  { key: 'recordTimelapse', hackKey: 'WEBHOOK_TIMELAPSE_EVENT', icon: Timer },
  { key: 'endTimeLapse', hackKey: 'WEBHOOK_TIMELAPSE_FINISH', icon: Timer },
];

function StatusLine({ status }: { status: NotifyStatus }) {
  const { t: tUi } = useTranslation('ui');
  if (!status.at) return null;
  const ok = status.ok === true;
  const Icon = ok ? CircleCheck : CircleX;
  return (
    <div className={cn('flex items-center gap-2 text-xs', ok ? 'text-primary' : 'text-destructive')}>
      <Icon className="size-3.5 shrink-0" />
      <span>
        {ok ? tUi('events.sendOk') : tUi('events.sendFail')}
        {status.channel && status.channel !== 'none' ? ` · ${status.channel}` : ''} · {status.at}
      </span>
    </div>
  );
}

export default function EventsPage() {
  const { t } = useTranslation('translation');
  const { t: tUi } = useTranslation('ui');
  const { config } = useHackIni();
  const { draft, patch, submit, reset, dirty, isLoading } = useHackIniForm();
  const isAtom = config?.PRODUCT_MODEL?.startsWith('ATOM') && config?.PRODUCT_MODEL !== 'ATOM_CAKP1JZJP';

  const [status, setStatus] = useState<NotifyStatus>({});
  const [testing, setTesting] = useState(false);

  // 直近の送信結果を初回に読む
  useEffect(() => {
    let cancelled = false;
    api.getNotifyStatus().then((s) => { if (!cancelled) setStatus(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const webhookOn = (draft.WEBHOOK_URL ?? '') !== '';
  const mqttOn = draft.MQTT_ENABLE === 'on';

  function sendTest() {
    setTesting(true);
    runCmd(
      api.notifyTest().then(setStatus),
      { quiet: true, onFinally: () => setTesting(false) },
    );
  }

  return (
    // pb-28: フローティングの未保存バー(高さ約76px)が最後のテスト送信ボタンを覆わないよう余白を確保
    <div className="mx-auto max-w-3xl space-y-6 pb-28">
      <h1 className="text-xl font-semibold">{t('event.tab')}</h1>

      {/* WebHook */}
      <Section title="WebHook" description={tUi('events.webhookDesc')}>
        <SettingInput icon={Link2} i18nKey="event.webhook.URL" value={draft.WEBHOOK_URL ?? ''} onChange={(v) => patch({ WEBHOOK_URL: v })} />
        <SettingSwitch icon={ShieldAlert} i18nKey="event.webhook.insecure" value={draft.WEBHOOK_INSECURE ?? 'off'} onChange={(v) => patch({ WEBHOOK_INSECURE: v })} />
        <div className="px-4 py-3">
          <Disclosure summary={tUi('events.presets')}>
            <p className="text-xs leading-relaxed text-muted-foreground">{tUi('events.presetsNote')}</p>
            {PRESETS.map((p) => (
              <div key={p.key} className="flex items-center justify-between gap-3 py-1 text-sm">
                <span className="flex items-center gap-2"><Radio className="size-3.5 text-muted-foreground" />{p.label}</span>
                {p.url
                  ? <code className="truncate font-mono text-xs text-muted-foreground">{p.url}</code>
                  : <span className="text-xs text-muted-foreground">{tUi('events.viaRelay')}</span>}
              </div>
            ))}
          </Disclosure>
        </div>
      </Section>

      {/* MQTT(Home Assistant) */}
      <Section title="MQTT" description={tUi('events.mqttDesc')}>
        <SettingSwitch icon={Radio} i18nKey="event.mqtt.enable" value={draft.MQTT_ENABLE ?? 'off'} onChange={(v) => patch({ MQTT_ENABLE: v })} />
        {mqttOn && (
          <>
            <SettingInput icon={Server} i18nKey="event.mqtt.host" value={draft.MQTT_HOST ?? ''} onChange={(v) => patch({ MQTT_HOST: v })} />
            <SettingInput icon={Link2} i18nKey="event.mqtt.port" value={draft.MQTT_PORT ?? ''} onChange={(v) => patch({ MQTT_PORT: v })} />
            <SettingInput icon={User} i18nKey="event.mqtt.user" value={draft.MQTT_USER ?? ''} onChange={(v) => patch({ MQTT_USER: v })} />
            <SettingInput icon={KeyRound} i18nKey="event.mqtt.pass" type="password" value={draft.MQTT_PASS ?? ''} onChange={(v) => patch({ MQTT_PASS: v })} />
            <SettingInput icon={Radio} i18nKey="event.mqtt.topic" value={draft.MQTT_TOPIC ?? ''} onChange={(v) => patch({ MQTT_TOPIC: v })} />
            <div className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">{tUi('events.mqttDiscovery')}</div>
          </>
        )}
      </Section>

      {/* 通知するイベント */}
      <Section title={tUi('events.eventsTitle')} description={tUi('events.eventsDesc')}>
        {EVENTS.filter((e) => !e.atomOnly || isAtom).map((e) => (
          <SettingSwitch
            key={e.key}
            icon={e.icon}
            i18nKey={`event.webhook.${e.key}`}
            value={draft[e.hackKey] ?? 'off'}
            onChange={(v) => patch({ [e.hackKey]: v })}
          />
        ))}
      </Section>

      {/* テスト送信 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <Button variant="secondary" disabled={testing || (!webhookOn && !mqttOn)} onClick={sendTest}>
          <Send className="size-4" />
          {testing ? tUi('events.sending') : tUi('events.sendTest')}
        </Button>
        {!webhookOn && !mqttOn
          ? <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Activity className="size-3.5" />{tUi('events.needTarget')}</span>
          : <StatusLine status={status} />}
      </div>

      <UnsavedBar dirty={dirty} disabled={isLoading} onSave={() => submit()} onCancel={reset} />
    </div>
  );
}
