import { useState } from 'react';
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  FolderSearch,
  HardDriveDownload,
  KeyRound,
  MemoryStick,
  Network,
  Share2,
  User,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { Section, SettingInput, SettingSwitch, UnsavedBar } from '@/components/settings';
import { useHackIniForm } from '@/hooks/useHackIniForm';
import { useCameraStatus } from '@/hooks/useCameraStatus';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api } from '@/api';
import type { StorageDu } from '@/api';
import { runCmd } from '@/lib/runCmd';
import { formatBytes } from '@/lib/format';
import { cn } from '@/lib/utils';

const kb = (v: number) => formatBytes(v * 1024);

function MiniBar({ pct, danger }: { pct: number; danger?: boolean }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full transition-all', danger ? 'bg-destructive' : 'bg-primary')}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

const DU_LABEL_KEY: Record<keyof StorageDu, string> = {
  record: 'record.periodicRec.title',
  alarm_record: 'record.alarmRec.title',
  time_lapse: 'timelapse.title',
};

export default function StoragePage() {
  const { t } = useTranslation('translation');
  const { t: tUi } = useTranslation('ui');
  const { draft, patch, submit, reset, dirty, isLoading } = useHackIniForm();
  const { media } = useCameraStatus();
  const [confirmErase, setConfirmErase] = useState(false);
  // マウント/swap/メモリの実態(cmd.cgi name=storage-info)
  const { data: info } = useSWR('storage-info', () => api.getStorageInfo(), {
    revalidateOnFocus: false,
    refreshInterval: 30_000,
  });
  // du は数秒かかるためボタン押下時のみ取得
  const [du, setDu] = useState<StorageDu | null>(null);
  const [duBusy, setDuBusy] = useState(false);

  // 容量は storage-info の df を優先し、なければ従来の MEDIASIZE
  const totalKb = info?.df?.totalKb ?? (media ? media.total / 1024 : 0);
  const usedKb = info?.df ? info.df.usedKb : media ? (media.total - media.available) / 1024 : 0;
  const availKb = info?.df?.availKb ?? (media ? media.available / 1024 : 0);
  const pct = totalKb > 0 ? Math.min(100, Math.round((usedKb / totalKb) * 100)) : 0;

  const mountState = !info
    ? null
    : !info.mounted
      ? { icon: CircleX, cls: 'text-destructive', label: tUi('storage.notMounted') }
      : info.rw
        ? { icon: CircleCheck, cls: 'text-primary', label: tUi('storage.mountRw') }
        : { icon: CircleAlert, cls: 'text-destructive', label: tUi('storage.mountRo') };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">{t('SDCardSettings.title')}</h1>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-muted-foreground">{tUi('storage.usageTitle')}</h2>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {totalKb > 0 ? `${kb(usedKb)} / ${kb(totalKb)}` : '–'}
          </span>
        </div>

        {/* マウント状態(未マウント/ro落ちが一目で分かるように) */}
        {mountState && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <mountState.icon aria-hidden="true" className={cn('size-4 shrink-0', mountState.cls)} />
            <span className={mountState.cls}>{mountState.label}</span>
            {info?.mounted && (
              <span className="font-mono text-xs text-muted-foreground">
                {info.fs} · {info.dev}
              </span>
            )}
          </div>
        )}

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-all', pct >= 90 ? 'bg-destructive' : 'bg-primary')}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{tUi('storage.usedPct', { pct })}</span>
          <span>{totalKb > 0 ? tUi('storage.free', { free: kb(availKb) }) : ''}</span>
        </div>

        {/* swap 内訳(zram / SD スワップ)とメモリ残量 */}
        {info && (info.swaps.length > 0 || info.memTotalKb) && (
          <div className="mt-4 grid gap-x-6 gap-y-3 border-t border-border/60 pt-3 sm:grid-cols-2">
            {info.swaps.map((s) => (
              <div key={s.name} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                    <HardDriveDownload aria-hidden="true" className="size-3.5 shrink-0" />
                    <span className="truncate font-mono" title={s.name}>
                      {tUi('storage.swap')}: {s.name.split('/').pop()}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                    {kb(s.usedKb)} / {kb(s.sizeKb)}
                  </span>
                </div>
                <MiniBar pct={s.sizeKb > 0 ? (s.usedKb / s.sizeKb) * 100 : 0} danger={s.sizeKb > 0 && s.usedKb / s.sizeKb >= 0.9} />
              </div>
            ))}
            {info.memTotalKb != null && info.memAvailKb != null && (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <MemoryStick aria-hidden="true" className="size-3.5 shrink-0" />
                    {tUi('storage.memory')}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                    {kb(info.memAvailKb)} / {kb(info.memTotalKb)}
                  </span>
                </div>
                <MiniBar
                  pct={((info.memTotalKb - info.memAvailKb) / info.memTotalKb) * 100}
                  danger={info.memAvailKb / info.memTotalKb < 0.1}
                />
              </div>
            )}
          </div>
        )}

        {/* 録画フォルダ内訳(du は重いのでオンデマンド) */}
        <div className="mt-4 border-t border-border/60 pt-3">
          <div className="flex items-center justify-between gap-4">
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FolderSearch aria-hidden="true" className="size-3.5" />
              {tUi('storage.duTitle')}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              disabled={duBusy}
              onClick={() => {
                setDuBusy(true);
                runCmd(
                  api.getStorageDu().then(setDu),
                  { quiet: true, onFinally: () => setDuBusy(false) },
                );
              }}
            >
              {duBusy ? tUi('storage.duLoading') : tUi('storage.duLoad')}
            </Button>
          </div>
          {du && (
            <div className="mt-2 space-y-2">
              {(Object.keys(DU_LABEL_KEY) as (keyof StorageDu)[]).map((key) => {
                const v = du[key];
                if (v == null) return null;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">{t(DU_LABEL_KEY[key])}</span>
                      <span className="font-mono tabular-nums text-muted-foreground">{kb(v)}</span>
                    </div>
                    <MiniBar pct={usedKb > 0 ? (v / usedKb) * 100 : 0} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Section title={t('SDCardSettings.title')} description={tUi('storage.sdSectionDesc')}>
        <SettingSwitch icon={Share2} i18nKey="SDCardSettings.smbAccess" value={draft.STORAGE_SDCARD_PUBLISH ?? 'off'} onChange={(v) => patch({ STORAGE_SDCARD_PUBLISH: v })} />
        <SettingSwitch icon={HardDriveDownload} i18nKey="SDCardSettings.directWrite" value={draft.STORAGE_SDCARD_DIRECT_WRITE ?? 'off'} onChange={(v) => patch({ STORAGE_SDCARD_DIRECT_WRITE: v })} />
        <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/40 px-3 py-2">
          <span className="min-w-0">
            <span className="block text-sm">{t('SDCardSettings.eraseSDCard.title')}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              {t('SDCardSettings.eraseSDCard.tooltip')}
            </span>
          </span>
          <Button variant="destructive" className="shrink-0" onClick={() => setConfirmErase(true)}>
            {t('SDCardSettings.eraseSDCard.title')}
          </Button>
        </div>
      </Section>

      <Section title={t('NASSettings.title')} description={tUi('storage.nasSectionDesc')}>
        <SettingInput icon={Network} i18nKey="NASSettings.networkPath" value={draft.STORAGE_CIFSSERVER ?? ''} onChange={(v) => patch({ STORAGE_CIFSSERVER: v.replace(/\\/g, '/') })} />
        <SettingInput icon={User} i18nKey="NASSettings.account" value={draft.STORAGE_CIFSUSER ?? ''} onChange={(v) => patch({ STORAGE_CIFSUSER: v })} />
        <SettingInput icon={KeyRound} i18nKey="NASSettings.password" type="password" value={draft.STORAGE_CIFSPASSWD ?? ''} onChange={(v) => patch({ STORAGE_CIFSPASSWD: v })} />
      </Section>

      <UnsavedBar dirty={dirty} disabled={isLoading} onSave={() => submit()} onCancel={reset} />

      <ConfirmDialog
        open={confirmErase}
        destructive
        title={tUi('storage.eraseConfirmTitle')}
        description={tUi('storage.eraseConfirmBody')}
        confirmLabel={tUi('storage.eraseConfirmAction')}
        onCancel={() => setConfirmErase(false)}
        onConfirm={() => {
          setConfirmErase(false);
          runCmd(api.exec('sderase'), { success: tUi('storage.eraseStarted') });
        }}
      />
    </div>
  );
}
