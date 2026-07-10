import { CloudOff, Gauge, KeyRound, Lock, Server, Shield, Signal, SignalLow, Tags, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Section, SettingInput, SettingInputNumber, SettingSwitch, UnsavedBar } from '@/components/settings';
import { useHackIniForm } from '@/hooks/useHackIniForm';
import { WatermarkEditor } from '@/components/watermark/WatermarkEditor';

export default function SystemPage({ section }: { section?: 'device' | 'tailscale' }) {
  const { t } = useTranslation('translation');
  const { draft, patch, submit, reset, dirty, isLoading } = useHackIniForm();

  const showDevice = !section || section === 'device';
  const showTailscale = !section || section === 'tailscale';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-title-xl">{t('systemSettings.tab', { defaultValue: 'System' })}</h1>

      {showDevice && (
        <>
          <Section title={t('videoSpec.title')}>
            <SettingInputNumber icon={Gauge} i18nKey="videoSpec.frameRate" value={Number(draft.FRAMERATE ?? 20)} min={1} max={30} onChange={(v) => patch({ FRAMERATE: String(v) })} />
            <SettingInputNumber icon={Signal} i18nKey="videoSpec.bitrateMain" value={Number(draft.BITRATE_MAIN_AVC ?? 960)} min={300} max={2000} onChange={(v) => patch({ BITRATE_MAIN_AVC: String(v) })} />
            <SettingInputNumber icon={SignalLow} i18nKey="videoSpec.bitrateSub" value={Math.abs(Number(draft.BITRATE_SUB_HEVC ?? 180))} min={100} max={500} onChange={(v) => patch({ BITRATE_SUB_HEVC: String(-v) })} />
          </Section>
          <Section title={t('motionDetect.title')}>
            <SettingSwitch icon={Timer} i18nKey="motionDetect.sensorPeriod" value={draft.MINIMIZE_ALARM_CYCLE ?? 'off'} onChange={(v) => patch({ MINIMIZE_ALARM_CYCLE: v })} />
            <SettingSwitch icon={CloudOff} i18nKey="motionDetect.uploadStop" value={draft.AWS_VIDEO_DISABLE ?? 'off'} onChange={(v) => patch({ AWS_VIDEO_DISABLE: v })} />
          </Section>
          <Section title={t('watermark.title')}>
            <WatermarkEditor />
          </Section>
        </>
      )}

      {showTailscale && (
        <Section title={t('tailscaleSettings.title')}>
          <SettingSwitch icon={Shield} i18nKey="tailscaleSettings.enable" value={draft.TAILSCALE_ENABLE ?? 'off'} onChange={(v) => patch({ TAILSCALE_ENABLE: v })} />
          {draft.TAILSCALE_ENABLE === 'on' && (
            <>
              <SettingInput icon={KeyRound} i18nKey="tailscaleSettings.authKey" type="password" value={draft.TAILSCALE_AUTH_KEY ?? ''} onChange={(v) => patch({ TAILSCALE_AUTH_KEY: v })} />
              <SettingInput icon={Server} i18nKey="tailscaleSettings.hostname" value={draft.TAILSCALE_HOSTNAME ?? ''} onChange={(v) => patch({ TAILSCALE_HOSTNAME: v })} />
              <SettingInput icon={Tags} i18nKey="tailscaleSettings.tags" value={draft.TAILSCALE_TAGS ?? 'tag:cctv'} onChange={(v) => patch({ TAILSCALE_TAGS: v })} />
              <SettingSwitch icon={Lock} i18nKey="tailscaleSettings.exitNodeOnly" value={draft.TAILSCALE_EXITNODE_ONLY ?? 'off'} onChange={(v) => patch({ TAILSCALE_EXITNODE_ONLY: v })} />
            </>
          )}
        </Section>
      )}

      <UnsavedBar dirty={dirty} disabled={isLoading} onSave={() => submit()} onCancel={reset} />
    </div>
  );
}
