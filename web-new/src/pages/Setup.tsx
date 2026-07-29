import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Camera, HardDrive, Network, ShieldAlert } from 'lucide-react';
import { WebUiAuthSection } from '@/components/auth/WebUiAuthSection';
import { LangSwitch } from '@/components/layout/LangSwitch';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { api } from '@/api';
import type { HackIni, StorageInfo } from '@/api';
import { runCmd } from '@/lib/runCmd';

function formatGb(kb?: number): string {
  if (!kb) return '-';
  return `${(kb / 1024 / 1024).toFixed(1)} GB`;
}

// WebUI ログインの初期設定専用ページ(/setup)。
// 未設定の間は AuthGate がここへ強制リダイレクトする。ナビは出さない。
// 複数台運用でどのカメラか分かるよう、モデル・MAC・SD容量を表示する。
// 設定が完了したら(=以後は lighttpd の digest 認証が入口)ライブへ戻す。
export default function SetupPage() {
  const { t: tUi } = useTranslation('ui');
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [info, setInfo] = useState<HackIni | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);

  useEffect(() => {
    api.getHackIni().then(setInfo).catch(() => {});
    api.getStorageInfo().then(setStorage).catch(() => {});
  }, []);

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

  const rows = [
    { icon: Camera, label: tUi('auth.deviceModel'), value: info?.PRODUCT_MODEL ?? '-' },
    { icon: Network, label: tUi('auth.deviceMac'), value: info?.HWADDR ?? '-' },
    { icon: HardDrive, label: tUi('auth.deviceSd'), value: formatGb(storage?.df?.totalKb) },
  ];

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex max-w-xl flex-col gap-6 p-6 pt-12">
        {/* ログイン前でも言語とテーマを選べるようにする(ナビが無いページのため) */}
        <div className="flex items-center justify-end gap-1">
          <LangSwitch placement="down" />
          <ThemeToggle />
        </div>

        <div>
          <h1 className="flex items-center gap-2 text-title-xl">
            <ShieldAlert aria-hidden="true" className="size-6 shrink-0 text-warning" />
            {tUi('auth.gateTitle')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{tUi('auth.gateBody')}</p>
        </div>

        {/* カメラの識別情報(複数台あってもどの個体か分かるように) */}
        <div className="divide-y divide-border rounded-card border border-border bg-card shadow-l100">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="flex items-center gap-2 text-title-s">
                <r.icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                {r.label}
              </span>
              <code className="font-mono text-sm text-muted-foreground">{r.value}</code>
            </div>
          ))}
        </div>

        {checked && <WebUiAuthSection />}
      </div>
    </div>
  );
}
