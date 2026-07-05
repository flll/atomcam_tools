import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHackIni } from '@/hooks/useHackIni';
import { useIspSettings } from '@/hooks/useIspSettings';
import { useJpegStream } from '@/hooks/useJpegStream';
import { usePropertyCmd } from '@/hooks/usePropertyCmd';
import type { IspSettings } from '@/api';
import { ISP_DEFAULTS } from '@/api';
import { PreviewOsd } from '@/components/camera/PreviewOsd';
import {
  Section,
  SettingSelect,
  SettingSlider,
  SettingSwitch,
} from '@/components/settings';
import { ISP_FILTER_KEYS, ispDeltaFilter } from '@/lib/isp-preview';
import { runCmd } from '@/lib/runCmd';

const MotionAreaOverlay = lazy(() => import('@/components/camera/MotionAreaOverlay'));

// ISP スライダーの i18n ラベル対応(OSD チップの表示名にも使う)
const SLIDER_LABEL = { cont: 'contrast', bri: 'brightness', sat: 'saturation', sharp: 'sharpness' } as const;
type SliderKey = keyof typeof SLIDER_LABEL;

export default function CameraPage() {
  const { t } = useTranslation('translation');
  const { t: tUi } = useTranslation('ui');
  const { config } = useHackIni();
  const { property, setField } = usePropertyCmd();
  const { settings, apply } = useIspSettings();
  const { src } = useJpegStream(800);
  // 編集差分 ?? サーバ値の導出(effect での同期を持たない)
  const [ispEdit, setIspEdit] = useState<Partial<IspSettings> | null>(null);
  // このページ表示中の最初の編集直前の値(比較長押しの基準)。
  // useIspSettings.apply は楽観 mutate するため settings は基準に使えない
  const [compareBase, setCompareBase] = useState<IspSettings | null>(null);
  const [comparing, setComparing] = useState(false);
  // スライダー操作の即時フィードバック。実映像は from の状態のまま 1〜2 秒遅れて
  // 追いつくので、その間 CSS フィルタで to の見え方を近似する
  const [fb, setFb] = useState<{ key: SliderKey; from: number; to: number } | null>(null);

  // 操作が止まって 1.2 秒でフィードバックを解き、実フレームへ引き継ぐ
  useEffect(() => {
    if (!fb) return;
    const id = setTimeout(() => setFb(null), 1200);
    return () => clearTimeout(id);
  }, [fb]);

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
    if (typeof value === 'number' && key in SLIDER_LABEL) {
      const k = key as SliderKey;
      setCompareBase((base) => base ?? isp);
      // fb は 1.2s 無操作で消えるので、生きている間=連続操作中とみなして
      // from(操作開始時の値)を維持する
      setFb((prev) =>
        prev && prev.key === k ? { ...prev, to: value } : { key: k, from: isp[k], to: value },
      );
    }
    const next = { ...isp, [key]: value } as IspSettings;
    setIspEdit((prev) => ({ ...(prev ?? {}), [key]: value }));
    apply(key, next);
  }

  const isDirty =
    compareBase != null && isp != null && ISP_FILTER_KEYS.some((k) => isp[k] !== compareBase[k]);

  // 比較長押し中: 実映像(現在値)の上に「変更前」の見え方を近似
  // スライダー操作中: 実映像(操作前の値)の上に「現在値」の見え方を近似
  const filter =
    comparing && compareBase && isp
      ? ispDeltaFilter(isp, compareBase)
      : fb && isp
        ? ispDeltaFilter({ ...isp, [fb.key]: fb.from }, isp)
        : '';

  const osdLabel = comparing
    ? tUi('camera.before')
    : fb
      ? `${t(`AdvancedSettings.${SLIDER_LABEL[fb.key]}.title`)} ${fb.to}`
      : null;

  const stopCompare = () => setComparing(false);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-4 text-xl font-semibold">{t('CameraSettings.tab')}</h1>

      {/* items は stretch のまま: 左カラムが右カラムと同じ高さになり sticky の可動域を確保する */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:gap-8">
        {/* <lg: 画面上部に sticky(下を通る設定が透けない全幅帯)/ lg+: 左カラムで sticky */}
        <div className="sticky top-12 z-10 -mx-4 bg-background px-4 pb-3 md:top-0 md:-mx-8 md:px-8 md:pt-2 lg:static lg:z-auto lg:m-0 lg:bg-transparent lg:p-0">
          <div className="lg:sticky lg:top-8">
            {/* Live と同じ 16:9 レターボックス。16:9 ソースがコンテナを完全に埋めるので
                MotionAreaOverlay のコンテナpx座標とフレーム座標が 1:1 に一致する */}
            <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-black" data-testid="camera-preview">
              {!src && <div className="absolute inset-0 animate-pulse bg-white/5" />}
              {src && (
                <img
                  src={src}
                  alt=""
                  className="h-full w-full object-contain"
                  style={{
                    filter: filter || undefined,
                    transition: comparing || fb ? 'filter 0.12s linear' : 'filter 0.8s ease-out',
                  }}
                />
              )}
              <PreviewOsd label={osdLabel} />
              {isDirty && (
                <button
                  type="button"
                  data-testid="compare-hold"
                  aria-pressed={comparing}
                  title={tUi('camera.holdToCompare')}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setComparing(true);
                  }}
                  onPointerUp={stopCompare}
                  onPointerCancel={stopCompare}
                  onKeyDown={(e) => {
                    if (e.key === ' ' && !e.repeat) {
                      e.preventDefault();
                      setComparing(true);
                    }
                  }}
                  onKeyUp={(e) => e.key === ' ' && stopCompare()}
                  onBlur={stopCompare}
                  onContextMenu={(e) => e.preventDefault()}
                  className="absolute bottom-3 right-3 z-10 select-none rounded-full bg-black/60 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition-transform active:scale-95 [touch-action:manipulation]"
                >
                  {tUi('camera.compare')}
                </button>
              )}
              <Suspense fallback={null}>
                {property?.motionArea === 'rect' && src && (
                  <MotionAreaOverlay property={property} onRectChange={(cmd) => runCmd(setField('motionArea', cmd))} />
                )}
              </Suspense>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-6 lg:mt-0">
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
                  i18nKey={`AdvancedSettings.${SLIDER_LABEL[key]}`}
                  value={isp[key]}
                  min={0}
                  max={255}
                  defaultValue={ISP_DEFAULTS[key]}
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
      </div>
    </div>
  );
}
