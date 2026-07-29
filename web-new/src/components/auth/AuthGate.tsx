import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { WebUiAuthSection } from '@/components/auth/WebUiAuthSection';
import { Brand } from '@/components/layout/Brand';
import { api } from '@/api';

// WebUI ログインを必須にする全画面ゲート。
// 認証未設定の間はアプリ全体を覆い、ユーザー名/パスワードの設定を求める。
// 設定すると lighttpd が digest 認証で再起動し、以後はブラウザ標準の
// ログインプロンプトが入口になる(このゲートはポーリングで自動的に閉じる)。
export function AuthGate() {
  const { t: tUi } = useTranslation('ui');
  // null = 確認中(その間は何もブロックしない)
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      api
        .getWebUiAuth()
        .then((s) => {
          if (!cancelled && typeof s.enabled === 'boolean') setEnabled(s.enabled);
        })
        .catch(() => {});
    };
    check();
    const id = setInterval(() => {
      if (!document.hidden) check();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (enabled !== false) return null;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-6 p-6">
        <div className="flex items-center gap-3">
          <Brand />
          <div>
            <h1 className="flex items-center gap-2 text-title-xl">
              <ShieldAlert aria-hidden="true" className="size-6 text-warning" />
              {tUi('auth.gateTitle')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{tUi('auth.gateBody')}</p>
          </div>
        </div>
        <WebUiAuthSection />
      </div>
    </div>
  );
}
