import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHackIni } from '@/hooks/useHackIni';
import { useIspSettings } from '@/hooks/useIspSettings';
import { useJpegStream } from '@/hooks/useJpegStream';
import { usePropertyCmd } from '@/hooks/usePropertyCmd';
import type { IspSettings } from '@/api';
import {
  Section,
  SettingSelect,
  SettingSlider,
  SettingSwitch,
} from '@/components/settings';
import { runCmd } from '@/lib/runCmd';

const MotionAreaOverlay = lazy(() => import('@/components/camera/MotionAreaOverlay'));

export default function CameraPage() {
  const { t } = useTranslation('translation');
  const { config } = useHackIni();
  const { property, setField } = usePropertyCmd();
  const { settings, apply } = useIspSettings();
  const { src } = useJpegStream(800);
  // 編集差分 ?? サーバ値の導出(effect での同期を持たない)
  const [ispEdit, setIspEdit] = useState<Partial<IspSettings> | null>(null);

  const isAtom = config?.PRODUCT_MODEL?.startsWith('ATOM') && config?.PRODUCT_MODEL !== 'ATOM_CAKP1JZJP';

  if (!isAtom) {
    return (
      <div className="mx-auto max-w-2xl py-10 text-center text-muted-foreground">
        {t('CameraSettings.tab')} — ATOM 専用
      </div>
    );
  }

  const isp: IspSettings | null = settings ? { ...settings, ...ispEdit } : null;

  function patchIsp(key: keyof IspSettings, value: number | string) {
    if (!isp) return;
    const next = { ...isp, [key]: value } as IspSettings;
    setIspEdit((prev) => ({ ...(prev ?? {}), [key]: value }));
    apply(key, next);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">{t('CameraSettings.tab')}</h1>

      <div className="relative overflow-hidden rounded-xl border border-border bg-black">
        {src && <img src={src} alt="" className="aspect-[4/3] w-full object-cover" />}
        <Suspense fallback={null}>
          {property?.motionArea === 'rect' && src && (
            <MotionAreaOverlay property={property} onRectChange={(cmd) => runCmd(setField('motionArea', cmd))} />
          )}
        </Suspense>
      </div>

      <Section title={t('FeatureSettings.title')}>
        <SettingSelect i18nKey="FeatureSettings.nightVision" value={property?.nightVision ?? 'auto'} options={['on', 'auto', 'off']} onChange={(v) => runCmd(setField('nightVision', v))} />
        {property?.nightVision === 'auto' && (
          <SettingSwitch i18nKey="FeatureSettings.nightCutThr" value={property?.nightCutThr ?? 'dusk'} onChange={(v) => runCmd(setField('nightCutThr', v))} />
        )}
        {(property?.nightVision === 'on' || property?.nightVision === 'auto') && (
          <SettingSwitch i18nKey="FeatureSettings.IrLED" value={property?.IrLED ?? 'on'} onChange={(v) => runCmd(setField('IrLED', v))} />
        )}
      </Section>

      <Section title={t('AlarmSettings.title')}>
        <SettingSwitch i18nKey="AlarmSettings.motionDet" value={property?.motionDet ?? 'on'} onChange={(v) => runCmd(setField('motionDet', v))} />
        {property?.motionDet === 'on' && (
          <>
            <SettingSelect i18nKey="AlarmSettings.Level" value={property?.motionLevel ?? 'mid'} options={['high', 'mid', 'low']} onChange={(v) => runCmd(setField('motionLevel', v))} />
            <SettingSwitch i18nKey="AlarmSettings.motionArea" value={property?.motionArea ?? 'all'} onChange={(v) => runCmd(setField('motionArea', v))} />
          </>
        )}
        <SettingSwitch i18nKey="AlarmSettings.soundDet" value={property?.soundDet ?? 'off'} onChange={(v) => runCmd(setField('soundDet', v))} />
        <SettingSwitch i18nKey="AlarmSettings.cautionDet" value={property?.cautionDet ?? 'off'} onChange={(v) => runCmd(setField('cautionDet', v))} />
        <SettingSelect i18nKey="AlarmSettings.recordType" value={property?.recordType ?? 'cont'} options={['cont', 'motion', 'off']} onChange={(v) => runCmd(setField('recordType', v))} />
      </Section>

      <Section title={t('OtherSettings.title')}>
        <SettingSwitch i18nKey="OtherSettings.rotate" value={property?.rotate ?? 'off'} onChange={(v) => runCmd(setField('rotate', v))} />
        <SettingSwitch i18nKey="OtherSettings.watermark" value={property?.watermark ?? 'off'} onChange={(v) => runCmd(setField('watermark', v))} />
      </Section>

      {isp && (
        <Section title={t('AdvancedSettings.title')}>
          {(['cont', 'bri', 'sat', 'sharp'] as const).map((key) => (
            <SettingSlider
              key={key}
              i18nKey={`AdvancedSettings.${key === 'cont' ? 'contrast' : key === 'bri' ? 'brightness' : key === 'sat' ? 'saturation' : 'sharpness'}`}
              value={isp[key]}
              min={0}
              max={255}
              onChange={(v) => patchIsp(key, v)}
            />
          ))}
          <SettingSelect
            i18nKey="AdvancedSettings.expmode"
            value={isp.expmode}
            options={['auto', 'manual']}
            onChange={(v) => patchIsp('expmode', v)}
          />
        </Section>
      )}
    </div>
  );
}
