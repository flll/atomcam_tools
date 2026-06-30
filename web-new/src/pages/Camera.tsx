import { lazy, Suspense, useEffect, useState } from 'react';
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

const MotionAreaOverlay = lazy(() => import('@/components/camera/MotionAreaOverlay'));

export default function CameraPage() {
  const { t } = useTranslation('translation');
  const { config } = useHackIni();
  const { property, setField } = usePropertyCmd();
  const { settings, apply } = useIspSettings();
  const { src } = useJpegStream(800);
  const [localIsp, setLocalIsp] = useState<IspSettings | null>(null);

  const isAtom = config?.PRODUCT_MODEL?.startsWith('ATOM') && config?.PRODUCT_MODEL !== 'ATOM_CAKP1JZJP';

  useEffect(() => {
    if (settings) setLocalIsp(settings);
  }, [settings]);

  if (!isAtom) {
    return (
      <div className="mx-auto max-w-2xl py-10 text-center text-muted-foreground">
        {t('CameraSettings.tab')} — ATOM 専用
      </div>
    );
  }

  const isp = localIsp ?? settings;

  function patchIsp(key: keyof IspSettings, value: number | string) {
    if (!isp) return;
    const next = { ...isp, [key]: value } as IspSettings;
    setLocalIsp(next);
    apply(key, next);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">{t('CameraSettings.tab')}</h1>

      <div className="relative overflow-hidden rounded-xl border border-border bg-black">
        {src && <img src={src} alt="" className="aspect-[4/3] w-full object-cover" />}
        <Suspense fallback={null}>
          {property?.motionArea === 'rect' && src && (
            <MotionAreaOverlay property={property} onRectChange={(cmd) => void setField('motionArea', cmd)} />
          )}
        </Suspense>
      </div>

      <Section title={t('FeatureSettings.title')}>
        <SettingSelect i18nKey="FeatureSettings.nightVision" value={property?.nightVision ?? 'auto'} options={['on', 'auto', 'off']} onChange={(v) => void setField('nightVision', v)} />
        {property?.nightVision === 'auto' && (
          <SettingSwitch i18nKey="FeatureSettings.nightCutThr" value={property?.nightCutThr ?? 'dusk'} onChange={(v) => void setField('nightCutThr', v)} />
        )}
        {(property?.nightVision === 'on' || property?.nightVision === 'auto') && (
          <SettingSwitch i18nKey="FeatureSettings.IrLED" value={property?.IrLED ?? 'on'} onChange={(v) => void setField('IrLED', v)} />
        )}
      </Section>

      <Section title={t('AlarmSettings.title')}>
        <SettingSwitch i18nKey="AlarmSettings.motionDet" value={property?.motionDet ?? 'on'} onChange={(v) => void setField('motionDet', v)} />
        {property?.motionDet === 'on' && (
          <>
            <SettingSelect i18nKey="AlarmSettings.Level" value={property?.motionLevel ?? 'mid'} options={['high', 'mid', 'low']} onChange={(v) => void setField('motionLevel', v)} />
            <SettingSwitch i18nKey="AlarmSettings.motionArea" value={property?.motionArea ?? 'all'} onChange={(v) => void setField('motionArea', v)} />
          </>
        )}
        <SettingSwitch i18nKey="AlarmSettings.soundDet" value={property?.soundDet ?? 'off'} onChange={(v) => void setField('soundDet', v)} />
        <SettingSwitch i18nKey="AlarmSettings.cautionDet" value={property?.cautionDet ?? 'off'} onChange={(v) => void setField('cautionDet', v)} />
        <SettingSelect i18nKey="AlarmSettings.recordType" value={property?.recordType ?? 'cont'} options={['cont', 'motion', 'off']} onChange={(v) => void setField('recordType', v)} />
      </Section>

      <Section title={t('OtherSettings.title')}>
        <SettingSwitch i18nKey="OtherSettings.rotate" value={property?.rotate ?? 'off'} onChange={(v) => void setField('rotate', v)} />
        <SettingSwitch i18nKey="OtherSettings.watermark" value={property?.watermark ?? 'off'} onChange={(v) => void setField('watermark', v)} />
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
