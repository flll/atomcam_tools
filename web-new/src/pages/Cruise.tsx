import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormActions, Section, SettingSwitch } from '@/components/settings';
import { useHackIniForm } from '@/hooks/useHackIniForm';
import { useHackIni } from '@/hooks/useHackIni';
import { Button } from '@/components/ui/button';
import { api } from '@/api';

interface CruisePoint { pan: number; tilt: number; speed: number; wait: number; detect: boolean }

function parseCruiseList(raw?: string): CruisePoint[] {
  if (!raw) return [];
  const pts: CruisePoint[] = [];
  const parts = raw.split(';').filter(Boolean);
  for (let i = 0; i < parts.length; i += 2) {
    const move = parts[i]?.match(/^move\s+(\d+)\s+(\d+)\s+(\d+)/);
    const wait = parts[i + 1]?.match(/^(sleep|detect|follow)\s+(\d+)/);
    if (move) pts.push({ pan: +move[1], tilt: +move[2], speed: +move[3], wait: wait ? +wait[2] : 5, detect: wait?.[1] !== 'sleep' });
  }
  return pts;
}

function serializeCruiseList(list: CruisePoint[]): string {
  return list.reduce((s, c) => {
    s += `move ${c.pan} ${c.tilt} ${c.speed};sleep ${c.wait};`;
    return s;
  }, '');
}

export default function CruisePage() {
  const { t } = useTranslation('translation');
  const { config } = useHackIni();
  const { draft, patch, submit, reset, dirty, isLoading } = useHackIniForm();
  const [points, setPoints] = useState<CruisePoint[]>(() => parseCruiseList(config?.CRUISE_LIST));
  const isSwing = config?.PRODUCT_MODEL === 'ATOM_CAKP1JZJP';

  if (!isSwing) {
    return <div className="py-10 text-center text-muted-foreground">{t('cruise.tab')} — Swing 専用</div>;
  }

  async function save() {
    patch({ CRUISE_LIST: serializeCruiseList(points), CRUISE: points.length ? 'on' : 'off' });
    await submit();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">{t('cruise.title')}</h1>
      <Section title={t('cruise.title')}>
        <Button variant="outline" onClick={() => void api.exec('moveinit')}>{t('cruise.initialPosition.title')}</Button>
        <SettingSwitch i18nKey="cruise.cameraMotion" value={draft.CRUISE ?? 'off'} onChange={(v) => patch({ CRUISE: v })} />
        <ul className="space-y-1 text-sm font-mono">
          {points.map((p, i) => (
            <li key={i}>#{i + 1} pan {p.pan} tilt {p.tilt} wait {p.wait}s</li>
          ))}
        </ul>
        <Button variant="secondary" onClick={() => setPoints([...points, { pan: 177, tilt: 90, speed: 5, wait: 10, detect: false }])}>
          + point
        </Button>
      </Section>
      <FormActions dirty={dirty || points.length > 0} saving={isLoading} onSave={() => void save()} onCancel={reset} />
    </div>
  );
}
