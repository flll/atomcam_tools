import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormActions, Section, SettingInput, SettingInputNumber, SettingSwitch } from '@/components/settings';
import { useHackIniForm } from '@/hooks/useHackIniForm';
import { WatermarkEditor } from '@/components/watermark/WatermarkEditor';
import { parseRebootSchedule, serializeRebootSchedule } from '@/lib/schedule';
import type { RebootSchedule } from '@/api';

export default function SystemPage({ section }: { section?: 'device' | 'tailscale' }) {
  const { t } = useTranslation('translation');
  const { draft, patch, submit, reset, dirty, isLoading } = useHackIniForm();
  const [reboot, setReboot] = useState<RebootSchedule>({ dayOfWeekSelect: [6], startTime: '02:00' });

  useEffect(() => {
    setReboot(parseRebootSchedule(draft.REBOOT_SCHEDULE));
  }, [draft.REBOOT_SCHEDULE]);

  async function save() {
    patch({ REBOOT_SCHEDULE: serializeRebootSchedule(reboot) });
    await submit();
  }

  const showDevice = !section || section === 'device';
  const showTailscale = !section || section === 'tailscale';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">{t('system.tab', { defaultValue: 'System' })}</h1>

      {showDevice && (
        <>
          <Section title={t('videoSpec.title')}>
            <SettingInputNumber i18nKey="videoSpec.frameRate" value={Number(draft.FRAMERATE ?? 20)} min={1} max={30} onChange={(v) => patch({ FRAMERATE: String(v) })} />
            <SettingInputNumber i18nKey="videoSpec.bitrateMain" value={Number(draft.BITRATE_MAIN_AVC ?? 960)} min={300} max={2000} onChange={(v) => patch({ BITRATE_MAIN_AVC: String(v) })} />
            <SettingInputNumber i18nKey="videoSpec.bitrateSub" value={Math.abs(Number(draft.BITRATE_SUB_HEVC ?? 180))} min={100} max={500} onChange={(v) => patch({ BITRATE_SUB_HEVC: String(-v) })} />
          </Section>
          <Section title={t('motionDetect.title')}>
            <SettingSwitch i18nKey="motionDetect.sensorPeriod" value={draft.MINIMIZE_ALARM_CYCLE ?? 'off'} onChange={(v) => patch({ MINIMIZE_ALARM_CYCLE: v })} />
            <SettingSwitch i18nKey="motionDetect.uploadStop" value={draft.AWS_VIDEO_DISABLE ?? 'off'} onChange={(v) => patch({ AWS_VIDEO_DISABLE: v })} />
          </Section>
          <Section title={t('watermark.title')}>
            <WatermarkEditor />
          </Section>
        </>
      )}

      {showTailscale && (
        <Section title={t('tailscaleSettings.title')}>
          <SettingSwitch i18nKey="tailscaleSettings.enable" value={draft.TAILSCALE_ENABLE ?? 'off'} onChange={(v) => patch({ TAILSCALE_ENABLE: v })} />
          {draft.TAILSCALE_ENABLE === 'on' && (
            <>
              <SettingInput i18nKey="tailscaleSettings.authKey" type="password" value={draft.TAILSCALE_AUTH_KEY ?? ''} onChange={(v) => patch({ TAILSCALE_AUTH_KEY: v })} />
              <SettingInput i18nKey="tailscaleSettings.hostname" value={draft.TAILSCALE_HOSTNAME ?? ''} onChange={(v) => patch({ TAILSCALE_HOSTNAME: v })} />
              <SettingInput i18nKey="tailscaleSettings.tags" value={draft.TAILSCALE_TAGS ?? 'tag:cctv'} onChange={(v) => patch({ TAILSCALE_TAGS: v })} />
              <SettingSwitch i18nKey="tailscaleSettings.exitNodeOnly" value={draft.TAILSCALE_EXITNODE_ONLY ?? 'off'} onChange={(v) => patch({ TAILSCALE_EXITNODE_ONLY: v })} />
            </>
          )}
        </Section>
      )}

      <FormActions dirty={dirty} saving={isLoading} onSave={() => void save()} onCancel={reset} />
    </div>
  );
}
