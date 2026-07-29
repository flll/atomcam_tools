import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api';
import { runCmd } from '@/lib/runCmd';

// WebUI ログイン必須の番人。未設定なら専用ページ(/setup)へ強制リダイレクトする。
// (以前はオーバーレイ表示だったが、背面ページと二重スクロールになるため
//  専用ページ方式に変更。UI はページ側 pages/Setup.tsx が持つ)
export function AuthGate() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      api
        .getWebUiAuth()
        .then((s) => {
          if (!cancelled && s.enabled === false) runCmd(Promise.resolve(navigate('/setup', { replace: true })), { quiet: true });
        })
        .catch(() => {});
    };
    check();
    const id = setInterval(() => {
      if (!document.hidden) check();
    }, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [navigate]);

  return null;
}
