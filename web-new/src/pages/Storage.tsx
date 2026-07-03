import { useTranslation } from 'react-i18next';
import { Section, SettingInput, SettingSwitch, UnsavedBar } from '@/components/settings';
import { useHackIniForm } from '@/hooks/useHackIniForm';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { runCmd } from '@/lib/runCmd';

export default function StoragePage() {
  const { t } = useTranslation('translation');
  const { draft, patch, submit, reset, dirty, isLoading } = useHackIniForm();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">{t('SDCardSettings.title')}</h1>
      <Section title={t('SDCardSettings.title')}>
        <SettingSwitch i18nKey="SDCardSettings.smbAccess" value={draft.STORAGE_SDCARD_PUBLISH ?? 'off'} onChange={(v) => patch({ STORAGE_SDCARD_PUBLISH: v })} />
        <SettingSwitch i18nKey="SDCardSettings.directWrite" value={draft.STORAGE_SDCARD_DIRECT_WRITE ?? 'off'} onChange={(v) => patch({ STORAGE_SDCARD_DIRECT_WRITE: v })} />
        <Button variant="destructive" onClick={() => runCmd(api.exec('sderase'))}>
          {t('SDCardSettings.eraseSDCard.title')}
        </Button>
      </Section>
      <Section title={t('NASSettings.title')}>
        <SettingInput i18nKey="NASSettings.networkPath" value={draft.STORAGE_CIFSSERVER ?? ''} onChange={(v) => patch({ STORAGE_CIFSSERVER: v.replace(/\\/g, '/') })} />
        <SettingInput i18nKey="NASSettings.account" value={draft.STORAGE_CIFSUSER ?? ''} onChange={(v) => patch({ STORAGE_CIFSUSER: v })} />
        <SettingInput i18nKey="NASSettings.password" type="password" value={draft.STORAGE_CIFSPASSWD ?? ''} onChange={(v) => patch({ STORAGE_CIFSPASSWD: v })} />
      </Section>
      <UnsavedBar dirty={dirty} disabled={isLoading} onSave={() => submit()} onCancel={reset} />
    </div>
  );
}
