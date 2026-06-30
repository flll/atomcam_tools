import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FormActions, Section, SettingInput, SettingInputNumber, SettingSelect, SettingSwitch, SettingComment } from '@/components/settings';
import { useHackIniForm } from '@/hooks/useHackIniForm';
import { useHackIni } from '@/hooks/useHackIni';
import { Button } from '@/components/ui/button';
import { api } from '@/api';

function rtspUrl(host: string, stream: string, auth: boolean, user: string, pass: string) {
  const cred = auth && user ? `${user}:${pass}@` : '';
  return `rtsp://${cred}${host}:8554/${stream}`;
}

export default function StreamingPage({ section }: { section?: 'rtsp' | 'rtmp' | 'webrtc' }) {
  const { t } = useTranslation('translation');
  const { config } = useHackIni();
  const { draft, patch, submit, reset, dirty, isLoading } = useHackIniForm();
  const host = typeof window !== 'undefined' ? window.location.hostname : 'atomcam.local';
  const isAtom = config?.PRODUCT_MODEL?.startsWith('ATOM') && config?.PRODUCT_MODEL !== 'ATOM_CAKP1JZJP';

  const urls = useMemo(() => ({
    main: rtspUrl(host, 'video0', draft.RTSP_AUTH === 'on', draft.RTSP_USER ?? '', draft.RTSP_PASSWD ?? ''),
    sub: rtspUrl(host, 'video1', draft.RTSP_AUTH === 'on', draft.RTSP_USER ?? '', draft.RTSP_PASSWD ?? ''),
    hevc: rtspUrl(host, 'video2', draft.RTSP_AUTH === 'on', draft.RTSP_USER ?? '', draft.RTSP_PASSWD ?? ''),
    webrtc: `${window.location.protocol}//${host}:1984/webrtc.html?src=video0`,
  }), [draft, host]);

  const showRtsp = !section || section === 'rtsp';
  const showRtmp = !section || section === 'rtmp';
  const showWebrtc = !section || section === 'webrtc';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">{t('RTSP.tab')}</h1>

      {showRtsp && (
        <Section title={t('RTSP.title')}>
          <SettingSwitch i18nKey="RTSP.main" value={draft.RTSP_VIDEO0 ?? 'off'} onChange={(v) => patch({ RTSP_VIDEO0: v })} />
          {draft.RTSP_VIDEO0 === 'on' && (
            <>
              <SettingSelect i18nKey="RTSP.main.audio" value={draft.RTSP_AUDIO0 ?? 'OPUS'} options={['off', 'S16_BE', 'AAC', 'OPUS']} onChange={(v) => patch({ RTSP_AUDIO0: v })} />
              <SettingInput i18nKey="RTSP.main.URL" value={urls.main} readOnly />
            </>
          )}
          {isAtom && (
            <>
              <SettingSwitch i18nKey="RTSP.mainHEVC" value={draft.RTSP_VIDEO2 ?? 'off'} onChange={(v) => patch({ RTSP_VIDEO2: v })} />
              {draft.RTSP_VIDEO2 === 'on' && <SettingInput i18nKey="RTSP.mainHEVC.URL" value={urls.hevc} readOnly />}
            </>
          )}
          <SettingSwitch i18nKey="RTSP.sub" value={draft.RTSP_VIDEO1 ?? 'off'} onChange={(v) => patch({ RTSP_VIDEO1: v })} />
          {draft.RTSP_VIDEO1 === 'on' && <SettingInput i18nKey="RTSP.sub.URL" value={urls.sub} readOnly />}
          <SettingSwitch i18nKey="RTSP.http" value={draft.RTSP_OVER_HTTP ?? 'off'} onChange={(v) => patch({ RTSP_OVER_HTTP: v })} />
          <SettingSwitch i18nKey="RTSP.auth" value={draft.RTSP_AUTH ?? 'off'} onChange={(v) => patch({ RTSP_AUTH: v })} />
        </Section>
      )}

      {showRtmp && (
        <Section title={t('RTMP.title')}>
          <SettingSwitch
            i18nKey="RTMP"
            value={draft.RTSP_VIDEO0 === 'on' && (draft.RTSP_AUDIO0 === 'AAC' || draft.RTSP_AUDIO0 === 'off') ? (draft.RTMP_ENABLE ?? 'off') : 'off'}
            onChange={(v) => patch({ RTMP_ENABLE: v })}
          />
          {draft.RTMP_ENABLE === 'on' && (
            <>
              <SettingInput i18nKey="RTMP.URL" value={draft.RTMP_URL ?? ''} onChange={(v) => patch({ RTMP_URL: v })} />
              <Button variant="secondary" onClick={() => void api.exec('rtmp_restart')}>{t('RTMP.Restart')}</Button>
              <SettingInputNumber i18nKey="RTMP.IntervalRestart" value={Math.abs(Number(draft.RTMP_RESTART ?? 240))} min={20} max={2880} onChange={(v) => patch({ RTMP_RESTART: String(-v) })} />
            </>
          )}
        </Section>
      )}

      {showWebrtc && (
        <Section title={t('WebRTC.title')}>
          <SettingSwitch i18nKey="WebRTC" value={draft.RTSP_VIDEO0 === 'on' ? (draft.WEBRTC_ENABLE ?? 'on') : 'off'} onChange={(v) => patch({ WEBRTC_ENABLE: v })} />
          {draft.WEBRTC_ENABLE === 'on' && draft.RTSP_VIDEO0 === 'on' && (
            <>
              {draft.RTSP_AUDIO0 !== 'OPUS' && draft.RTSP_AUDIO0 !== 'off' && <SettingComment i18nKey="WebRTC.note" tone="danger" />}
              <SettingInput i18nKey="WebRTC.URL" value={urls.webrtc} readOnly />
            </>
          )}
        </Section>
      )}

      <FormActions dirty={dirty} saving={isLoading} onSave={() => void submit()} onCancel={reset} />
    </div>
  );
}
