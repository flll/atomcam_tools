import { useTranslation } from 'react-i18next';
import { FormActions, Section, SettingInput, SettingSwitch } from '@/components/settings';
import { useHackIniForm } from '@/hooks/useHackIniForm';
import { useHackIni } from '@/hooks/useHackIni';

export default function EventsPage() {
  const { t } = useTranslation('translation');
  const { config } = useHackIni();
  const { draft, patch, submit, reset, dirty, isLoading } = useHackIniForm();
  const isAtom = config?.PRODUCT_MODEL?.startsWith('ATOM') && config?.PRODUCT_MODEL !== 'ATOM_CAKP1JZJP';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">{t('event.tab')}</h1>
      <Section title={t('event.webhook.title')}>
        <SettingInput i18nKey="event.webhook.URL" value={draft.WEBHOOK_URL ?? ''} onChange={(v) => patch({ WEBHOOK_URL: v })} />
        <SettingSwitch i18nKey="event.webhook.insecure" value={draft.WEBHOOK_INSECURE ?? 'off'} onChange={(v) => patch({ WEBHOOK_INSECURE: v })} />
        <SettingSwitch i18nKey="event.webhook.alarm" value={draft.WEBHOOK_ALARM_EVENT ?? 'off'} onChange={(v) => patch({ WEBHOOK_ALARM_EVENT: v })} />
        {isAtom && <SettingSwitch i18nKey="event.webhook.information" value={draft.WEBHOOK_ALARM_INFO ?? 'off'} onChange={(v) => patch({ WEBHOOK_ALARM_INFO: v })} />}
        <SettingSwitch i18nKey="event.webhook.recordingEnd" value={draft.WEBHOOK_ALARM_VIDEO_FINISH ?? 'off'} onChange={(v) => patch({ WEBHOOK_ALARM_VIDEO_FINISH: v })} />
        <SettingSwitch i18nKey="event.webhook.screenshotTransfer" value={draft.WEBHOOK_ALERM_PICT ?? 'off'} onChange={(v) => patch({ WEBHOOK_ALERM_PICT: v })} />
        <SettingSwitch i18nKey="event.webhook.startTimelapse" value={draft.WEBHOOK_TIMELAPSE_START ?? 'off'} onChange={(v) => patch({ WEBHOOK_TIMELAPSE_START: v })} />
      </Section>
      <FormActions dirty={dirty} saving={isLoading} onSave={() => void submit()} onCancel={reset} />
    </div>
  );
}
