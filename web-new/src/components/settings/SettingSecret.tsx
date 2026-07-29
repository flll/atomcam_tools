import { useTranslation } from 'react-i18next';
import { KeyRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

// 秘密値の末尾4文字だけ見せるマスク表示
export function maskSecret(v: string): string {
  if (v.length <= 4) return '••••';
  return `••••${v.slice(-4)}`;
}

// パスワード・auth key 等の秘密値専用の設定行。
// 保存済みの生値を編集用 input に注入しない(マスク表示+「変更」で空欄から再入力)。
// 表示モードは state ではなく「draft 値 == 保存値」から導出する — state で持つと
// 「変更 → 破棄」で draft が保存値に戻っても入力モードが残り、保存済みの生値が
// input の value に復活する(実際に踏んだ脆弱性)。
export function SettingSecret({
  i18nKey,
  value,
  saved,
  onChange,
  icon: Icon = KeyRound,
}: {
  i18nKey: string;
  /** draft 上の現在値 */
  value: string;
  /** サーバ保存済みの値(config 由来)。破棄で value がこれに戻るとマスク表示に復帰する */
  saved: string;
  onChange: (v: string) => void;
  icon?: LucideIcon;
}) {
  const { t } = useTranslation('translation');
  const { t: tUi } = useTranslation('ui');
  const desc = t(`${i18nKey}.tooltip`, { defaultValue: '' });
  const placeholder = t(`${i18nKey}.placeholder`, { defaultValue: '' });
  const masked = saved !== '' && value === saved;

  if (masked) {
    return (
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-title-s">
            <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            {t(`${i18nKey}.title`)}
          </span>
          <code className="mt-1 block truncate font-mono text-body-xs text-muted-foreground">{maskSecret(saved)}</code>
        </span>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => onChange('')}>
          {tUi('common.change')}
        </Button>
      </div>
    );
  }

  return (
    <label className="block px-4 py-3">
      <span className="flex items-center gap-2 text-title-s">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        {t(`${i18nKey}.title`)}
      </span>
      {desc && <span className="mt-0.5 block text-body-xs text-muted-foreground">{desc}</span>}
      <input
        type="password"
        autoComplete="new-password"
        // 保存済みの生値は決して注入しない(空欄から入力し直す)
        value={value === saved ? '' : value}
        placeholder={placeholder || undefined}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-control border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground/50"
      />
    </label>
  );
}
