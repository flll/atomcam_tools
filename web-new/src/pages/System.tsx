import { useState } from 'react';
import { CloudOff, Gauge, Signal, SignalLow, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { api } from '@/api';
import { runCmd } from '@/lib/runCmd';
import { tailscaleChanged, tailscaleRisks } from '@/lib/tailscale-changes';
import { TRIAL_SECONDS, TrialDialog } from '@/components/tailscale/TrialDialog';
import { Section, SettingInputNumber, SettingSwitch, UnsavedBar } from '@/components/settings';
import { useHackIniForm } from '@/hooks/useHackIniForm';
import { useHackIni } from '@/hooks/useHackIni';
import { WatermarkEditor } from '@/components/watermark/WatermarkEditor';
import { TailscaleSection } from '@/components/tailscale/TailscaleSection';

export default function SystemPage({ section }: { section?: 'device' | 'tailscale' }) {
  const { t } = useTranslation('translation');
  const { t: tUi } = useTranslation('ui');
  const { config, mutate } = useHackIni();
  const { draft, patch, submit, reset, dirty, isLoading } = useHackIniForm();

  const [trialOpen, setTrialOpen] = useState(false);

  // hack.ini の保存はファイルを書くだけで tailscale には反映されない(旧UIの
  // webcmd 経路が新UIに未移植だった)。tailscale 関連キーが変わったら保存後に
  // restart / stop を FIFO 経由で送る。適用は最長60秒かかり得るため fire-and-forget。
  // 締め出しリスクのある変更は、保存前にデバイス側デッドマンスイッチ(trial-start)を
  // 起動してから適用し、「接続は維持されていますか?」ダイアログで確定を求める。
  // 確定が届かなければカメラが自律で適用前の hack.ini へ巻き戻す。
  const save = async () => {
    const prev = config;
    const risky = tailscaleRisks(prev, draft).length > 0;
    if (risky) {
      try {
        await api.exec(`tailscale trial-start ${TRIAL_SECONDS}`, 'fifo');
      } catch {
        toast.error(tUi('ts.applyFailed'));
        return;
      }
    }
    await submit();
    if (!tailscaleChanged(prev, draft)) return;
    const cmd = draft.TAILSCALE_ENABLE === 'on' ? 'tailscale restart' : 'tailscale stop';
    try {
      await api.exec(cmd, 'fifo');
      toast.success(tUi('ts.applying'));
    } catch {
      toast.error(tUi('ts.applyFailed'));
    }
    if (risky) setTrialOpen(true);
  };

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

      {showTailscale && <TailscaleSection draft={draft} patch={patch} config={config} />}

      <UnsavedBar dirty={dirty} disabled={isLoading} onSave={() => save()} onCancel={reset} />
      <TrialDialog
        open={trialOpen}
        onClose={(confirmed) => {
          setTrialOpen(false);
          // 巻き戻し時はデバイス側で hack.ini が変わっているので取得し直す
          if (!confirmed) runCmd(mutate(), { quiet: true });
        }}
      />
    </div>
  );
}
