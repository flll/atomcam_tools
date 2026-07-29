import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LockKeyhole, ShieldAlert, TriangleAlert } from 'lucide-react';
import { Section } from '@/components/settings';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { runCmd } from '@/lib/runCmd';

interface AuthStatus {
  enabled?: boolean;
  user?: string;
}

// WebUI のログイン(lighttpd digest 認証)。ユーザー名は admin 固定で、
// パスワード+確認用パスワードだけを入力する。
// 未設定だと hack_ini.cgi が auth key やパスワードを含む全設定を無認証で返すため、
// ここがカメラ設定全体の入口の鍵になる。
const AUTH_USER = 'admin';

export function WebUiAuthSection() {
  const { t: tUi } = useTranslation('ui');
  const [status, setStatus] = useState<AuthStatus>({});
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    api
      .getWebUiAuth()
      .then(setStatus)
      .catch(() => {});
  };
  useEffect(load, []);

  const mismatch = pass2 !== '' && pass !== pass2;
  const canSubmit = pass !== '' && pass === pass2 && !busy;

  const enable = () => {
    setBusy(true);
    runCmd(api.exec(`webui_auth set ${AUTH_USER} ${pass}`, 'fifo'), {
      success: tUi('auth.enabled'),
      onFinally: () => {
        setBusy(false);
        setPass('');
        setPass2('');
        // lighttpd 再起動を挟むので少し待ってから状態を取り直す
        setTimeout(load, 3000);
      },
    });
  };

  const disable = () => {
    setBusy(true);
    runCmd(api.exec('webui_auth clear', 'fifo'), {
      success: tUi('auth.disabled'),
      onFinally: () => {
        setBusy(false);
        setTimeout(load, 3000);
      },
    });
  };

  return (
    <>
      {status.enabled === false && (
        <div role="alert" className="space-y-1.5 rounded-card border border-warning/40 bg-warning/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-warning">
            <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
            {tUi('auth.warnTitle')}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">{tUi('auth.warnBody')}</p>
        </div>
      )}

      <Section title={tUi('auth.title')} description={tUi('auth.descAdmin')}>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="flex items-center gap-2 text-title-s">
            <ShieldAlert aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            {tUi('auth.stateLabel')}
          </span>
          <span className="text-sm text-muted-foreground">
            {status.enabled
              ? tUi('auth.stateOn', { user: status.user ?? AUTH_USER })
              : tUi('auth.stateOff')}
          </span>
        </div>

        <div className="space-y-3 px-4 py-3">
          <label className="block">
            <span className="flex items-center gap-2 text-title-s">
              <LockKeyhole aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              {tUi('auth.pass')}
            </span>
            <input
              type="password"
              value={pass}
              autoComplete="new-password"
              onChange={(e) => setPass(e.target.value)}
              className="mt-2 w-full rounded-control border border-input bg-background px-3 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="flex items-center gap-2 text-title-s">
              <LockKeyhole aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              {tUi('auth.passConfirm')}
            </span>
            <input
              type="password"
              value={pass2}
              autoComplete="new-password"
              onChange={(e) => setPass2(e.target.value)}
              className="mt-2 w-full rounded-control border border-input bg-background px-3 py-1.5 text-sm"
            />
          </label>
          {mismatch && <p className="text-body-xs text-destructive">{tUi('auth.passMismatch')}</p>}
          <p className="text-body-xs text-muted-foreground">{tUi('auth.hint')}</p>
          <div className="flex justify-end gap-2">
            {status.enabled && (
              <Button variant="outline" size="sm" disabled={busy} onClick={disable}>
                {tUi('auth.disable')}
              </Button>
            )}
            <Button size="sm" disabled={!canSubmit} onClick={enable}>
              {status.enabled ? tUi('auth.update') : tUi('auth.enable')}
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
