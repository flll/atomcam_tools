import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { toast } from '@/lib/toast';
import { runCmd } from '@/lib/runCmd';

export const TRIAL_SECONDS = 120;

// 締め出しリスクのある tailscale 設定を適用した直後に出す
// 「接続は維持されていますか?」ダイアログ(PS の解像度変更と同じフェイルセーフ)。
// 巻き戻しの実体はデバイス側 watchdog(tailscale.sh trial-*)であり、
// ここのカウントダウンは表示用。確定(trial-confirm)が届かない限り
// 120秒後にカメラが自律で hack.ini スナップショットへ復元・再接続する。
export function TrialDialog({ open, onClose }: { open: boolean; onClose: (confirmed: boolean) => void }) {
  // open のたびに Inner を作り直して state を初期化する(effect 内 setState を避ける)
  if (!open) return null;
  return <TrialDialogInner onClose={onClose} />;
}

function TrialDialogInner({ onClose }: { onClose: (confirmed: boolean) => void }) {
  const { t: tUi } = useTranslation('ui');
  const [remaining, setRemaining] = useState(TRIAL_SECONDS);
  const [reverted, setReverted] = useState(false);
  const closedRef = useRef(false);

  useEffect(() => {
    // 表示用カウントダウン(1秒刻み)+デバイス側の実状態ポーリング(5秒刻み)。
    // デバイスの deadline が正なので、poll の remaining で常に補正する
    const tick = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    const poll = setInterval(() => {
      if (document.hidden) return;
      api
        .getTailscaleTrial()
        .then((s) => {
          if (closedRef.current) return;
          if (s.reverted) setReverted(true);
          else if (s.active && typeof s.remaining === 'number') setRemaining(s.remaining);
        })
        .catch(() => {});
    }, 5000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, []);

  const confirm = () => {
    closedRef.current = true;
    runCmd(api.exec('tailscale trial-confirm', 'fifo'), { success: tUi('ts.trial.confirmed') });
    onClose(true);
  };
  const revertNow = () => {
    closedRef.current = true;
    runCmd(api.exec('tailscale trial-revert', 'fifo'), { success: tUi('ts.trial.reverting') });
    onClose(false);
  };
  const closeAfterRevert = () => {
    closedRef.current = true;
    toast.error(tUi('ts.trial.revertedNotice'));
    onClose(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" />
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-sheet border border-border bg-card p-5 shadow-xl"
      >
        {reverted || remaining <= 0 ? (
          <>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Undo2 aria-hidden="true" className="size-5 shrink-0 text-warning" />
              {tUi('ts.trial.revertedTitle')}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{tUi('ts.trial.revertedBody')}</p>
            <div className="mt-5 flex justify-end">
              <Button onClick={closeAfterRevert}>{tUi('common.ok', { defaultValue: 'OK' })}</Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-success" />
              {tUi('ts.trial.title')}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{tUi('ts.trial.body')}</p>
            <p className="mt-3 text-sm font-medium tabular-nums">
              {tUi('ts.trial.countdown', { s: remaining })}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={revertNow}>
                {tUi('ts.trial.revertNow')}
              </Button>
              <Button autoFocus onClick={confirm}>
                {tUi('ts.trial.keep')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
