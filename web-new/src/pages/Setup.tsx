import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { WebUiAuthSection } from '@/components/auth/WebUiAuthSection';
import { Brand } from '@/components/layout/Brand';
import { api } from '@/api';
import { runCmd } from '@/lib/runCmd';

// WebUI ログインの初期設定専用ページ(/setup)。
// 未設定の間は AuthGate がここへ強制リダイレクトする。ナビは出さない。
// 設定が完了したら(=以後は lighttpd の digest 認証が入口)ライブへ戻す。
export default function SetupPage() {
  const { t: tUi } = useTranslation('ui');
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      api
        .getWebUiAuth()
        .then((s) => {
          if (cancelled) return;
          setChecked(true);
          if (s.enabled === true) runCmd(Promise.resolve(navigate('/', { replace: true })), { quiet: true });
        })
        .catch(() => {});
    };
    check();
    const id = setInterval(() => {
      if (!document.hidden) check();
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [navigate]);

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex max-w-xl flex-col gap-6 p-6 pt-12">
        <div className="flex items-start gap-3">
          <Brand />
          <div>
            <h1 className="flex items-center gap-2 text-title-xl">
              <ShieldAlert aria-hidden="true" className="size-6 shrink-0 text-warning" />
              {tUi('auth.gateTitle')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{tUi('auth.gateBody')}</p>
          </div>
        </div>
        {checked && <WebUiAuthSection />}
      </div>
    </div>
  );
}
