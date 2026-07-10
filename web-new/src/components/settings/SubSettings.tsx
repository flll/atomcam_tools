import type { ReactNode } from 'react';

// 親スイッチ ON で現れる子設定のグループ。左のアクセント線+淡い地色で
// 「この設定は上の項目に属する」ことを示す。カード内の行として馴染むよう
// 子(Setting* 行)は区切り線で仕切る。
export function SubSettings({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-border/40 border-l-2 border-primary/50 bg-foreground/[0.02]">
      {children}
    </div>
  );
}
