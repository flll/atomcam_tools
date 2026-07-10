import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Contrast,
  Disc,
  Flame,
  FlipVertical,
  Focus,
  Gauge,
  Lightbulb,
  Moon,
  Palette,
  Scan,
  Stamp,
  Sun,
  SunDim,
  Volume2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useHackIni } from '@/hooks/useHackIni';
import { useIspSettings } from '@/hooks/useIspSettings';
import { useJpegStream } from '@/hooks/useJpegStream';
import { usePropertyCmd } from '@/hooks/usePropertyCmd';
import type { IspSettings } from '@/api';
import { api } from '@/api';
import { PreviewOsd } from '@/components/camera/PreviewOsd';
import {
  Section,
  SettingSelect,
  SettingSlider,
  SettingSwitch,
} from '@/components/settings';
import { SegmentedControl } from '@/components/ui/segmented';
import { runCmd } from '@/lib/runCmd';

const MotionAreaOverlay = lazy(() => import('@/components/camera/MotionAreaOverlay'));

// ISP スライダーの i18n ラベル対応(OSD チップの表示名にも使う)
const SLIDER_LABEL = { cont: 'contrast', bri: 'brightness', sat: 'saturation', sharp: 'sharpness' } as const;
type SliderKey = keyof typeof SLIDER_LABEL;
const SLIDER_KEYS = Object.keys(SLIDER_LABEL) as SliderKey[];
const SLIDER_ICON = { cont: Contrast, bri: Sun, sat: Palette, sharp: Focus } as const;

// 指定キーだけカメラへライブ適用する(video_isp ファイルへは保存しない)
async function sendLive(vals: IspSettings, keys: SliderKey[]) {
  for (const k of keys) await api.applyIspLive(k, vals);
}

export default function CameraPage() {
  const { t } = useTranslation('translation');
  const { t: tUi } = useTranslation('ui');
  const { config } = useHackIni();
  const { property, setField } = usePropertyCmd();
  const { settings, apply, mutate } = useIspSettings();
  const { src } = useJpegStream(800);
  // 編集差分 ?? サーバ値の導出(effect での同期を持たない)
  const [ispEdit, setIspEdit] = useState<Partial<IspSettings> | null>(null);
  // 比較トグルの基準 = このページで最初に編集する直前の値(apply 前)。
  // useIspSettings.apply は楽観 mutate するため settings は基準に使えない
  const [compareBase, setCompareBase] = useState<IspSettings | null>(null);
  const [comparing, setComparing] = useState(false);
  // OSD チップ(値表示のみ。映像への CSS フィルタ近似はカメラ内部値のため行わない)
  const [osd, setOsd] = useState<{ text: string } | null>(null);
  // 比較解除・ページ離脱時に現在値へ戻すための参照
  const restoreRef = useRef<{ vals: IspSettings; keys: SliderKey[] } | null>(null);

  const isp: IspSettings | null = settings ? { ...settings, ...ispEdit } : null;
  const isAuto = (isp?.expmode ?? 'auto') === 'auto';

  // OSD は 1.2s 無操作で消える(比較中の「変更前」は comparing 側で常時表示)
  useEffect(() => {
    if (!osd) return;
    const id = setTimeout(() => setOsd(null), 1200);
    return () => clearTimeout(id);
  }, [osd]);

  // AUTO 中はカメラの現在値を 1 秒間隔で取得してスライダーに反映する
  // (非表示タブでは取得しない: 実機の CGI 負荷を無駄にしないため)
  useEffect(() => {
    if (!isAuto || comparing) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      runCmd(mutate(), { quiet: true });
    }, 1000);
    return () => clearInterval(id);
  }, [isAuto, comparing, mutate]);

  // 比較の解除(トグルOFF・モード切替・ページ離脱)で現在値を復元する
  // (カメラへライブ適用のみ・保存なし)
  useEffect(() => {
    if (!comparing) return;
    return () => {
      const r = restoreRef.current;
      if (r) runCmd(sendLive(r.vals, r.keys), { quiet: true });
    };
  }, [comparing]);

  const isAtom = config?.PRODUCT_MODEL?.startsWith('ATOM') && config?.PRODUCT_MODEL !== 'ATOM_CAKP1JZJP';

  if (!isAtom) {
    return (
      <div className="mx-auto max-w-2xl py-10 text-center text-muted-foreground">
        {t('CameraSettings.tab')} — ATOM 専用
      </div>
    );
  }

  function patchIsp(key: SliderKey, value: number) {
    if (!isp || comparing) return;
    setCompareBase((base) => base ?? isp);
    setOsd({ text: `${t(`AdvancedSettings.${SLIDER_LABEL[key]}.title`)} ${value}` });
    const next = { ...isp, [key]: value } as IspSettings;
    setIspEdit((prev) => ({ ...(prev ?? {}), [key]: value }));
    apply(key, next);
  }

  // AUTO/マニュアル切替。AUTO に戻すときはスライダーの編集差分を破棄して
  // ポーリング値がそのまま見えるようにする
  function setMode(v: 'auto' | 'manual') {
    if (!isp || isp.expmode === v) return;
    setComparing(false); // 比較中なら effect cleanup が現在値を復元する
    const next = { ...isp, expmode: v } as IspSettings;
    setIspEdit({ expmode: v });
    apply('expmode', next);
  }

  const dirtyKeys =
    compareBase && isp ? SLIDER_KEYS.filter((k) => isp[k] !== compareBase[k]) : [];

  // 比較トグル: ON で apply 前の値をカメラへ一時適用、OFF は effect cleanup が
  // 現在値へ戻す。実映像の反映には 1〜2 秒かかる(JPEG ポーリング+適用遅延)
  function toggleCompare() {
    if (!isp || !compareBase || dirtyKeys.length === 0) return;
    const next = !comparing;
    restoreRef.current = { vals: isp, keys: dirtyKeys };
    setComparing(next);
    if (next) {
      runCmd(sendLive(compareBase, dirtyKeys), { quiet: true });
    } else {
      setOsd({ text: tUi('camera.after') });
    }
  }

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
              {src && <img src={src} alt="" className="h-full w-full object-contain" />}
              <PreviewOsd label={comparing ? tUi('camera.before') : osd?.text ?? null} />
              {dirtyKeys.length > 0 && (
                <button
                  type="button"
                  data-testid="compare-hold"
                  aria-pressed={comparing}
                  title={tUi('camera.holdToCompare')}
                  onClick={toggleCompare}
                  className="absolute bottom-3 right-3 z-10 select-none rounded-full bg-black/60 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition-transform active:scale-95"
                >
                  {comparing ? tUi('camera.after') : tUi('camera.compare')}
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
            <SettingSelect icon={Moon} i18nKey="FeatureSettings.nightVision" value={property?.nightVision ?? 'auto'} options={['on', 'auto', 'off']} onChange={(v) => runCmd(setField('nightVision', v))} />
            {property?.nightVision === 'auto' && (
              <SettingSwitch icon={SunDim} i18nKey="FeatureSettings.nightCutThr" value={property?.nightCutThr ?? 'dusk'} onChange={(v) => runCmd(setField('nightCutThr', v))} />
            )}
            {(property?.nightVision === 'on' || property?.nightVision === 'auto') && (
              <SettingSwitch icon={Lightbulb} i18nKey="FeatureSettings.IrLED" value={property?.IrLED ?? 'on'} onChange={(v) => runCmd(setField('IrLED', v))} />
            )}
          </Section>

          <Section title={t('AlarmSettings.title')}>
            <SettingSwitch icon={Activity} i18nKey="AlarmSettings.motionDet" value={property?.motionDet ?? 'on'} onChange={(v) => runCmd(setField('motionDet', v))} />
            {property?.motionDet === 'on' && (
              <>
                <SettingSelect icon={Gauge} i18nKey="AlarmSettings.Level" value={property?.motionLevel ?? 'mid'} options={['high', 'mid', 'low']} onChange={(v) => runCmd(setField('motionLevel', v))} />
                <SettingSwitch icon={Scan} i18nKey="AlarmSettings.motionArea" value={property?.motionArea ?? 'all'} onChange={(v) => runCmd(setField('motionArea', v))} />
              </>
            )}
            <SettingSwitch icon={Volume2} i18nKey="AlarmSettings.soundDet" value={property?.soundDet ?? 'off'} onChange={(v) => runCmd(setField('soundDet', v))} />
            <SettingSwitch icon={Flame} i18nKey="AlarmSettings.cautionDet" value={property?.cautionDet ?? 'off'} onChange={(v) => runCmd(setField('cautionDet', v))} />
            <SettingSelect icon={Disc} i18nKey="AlarmSettings.recordType" value={property?.recordType ?? 'cont'} options={['cont', 'motion', 'off']} onChange={(v) => runCmd(setField('recordType', v))} />
          </Section>

          <Section title={t('OtherSettings.title')}>
            <SettingSwitch icon={FlipVertical} i18nKey="OtherSettings.rotate" value={property?.rotate ?? 'off'} onChange={(v) => runCmd(setField('rotate', v))} />
            <SettingSwitch icon={Stamp} i18nKey="OtherSettings.watermark" value={property?.watermark ?? 'off'} onChange={(v) => runCmd(setField('watermark', v))} />
          </Section>

          {isp && (
            <Section
              title={t('AdvancedSettings.title')}
              description={t('AdvancedSettings.expmode.tooltip')}
              action={
                <SegmentedControl
                  variant="surface"
                  label={t('AdvancedSettings.expmode.title')}
                  value={isAuto ? 'auto' : 'manual'}
                  options={[
                    { value: 'auto', label: t('AdvancedSettings.expmode.text.0') },
                    { value: 'manual', label: t('AdvancedSettings.expmode.text.1') },
                  ]}
                  onChange={setMode}
                />
              }
            >
              {SLIDER_KEYS.map((key) => (
                <SettingSlider
                  key={key}
                  icon={SLIDER_ICON[key]}
                  i18nKey={`AdvancedSettings.${SLIDER_LABEL[key]}`}
                  value={isp[key]}
                  min={0}
                  max={255}
                  disabled={isAuto || comparing}
                  onChange={(v) => patchIsp(key, v)}
                />
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
