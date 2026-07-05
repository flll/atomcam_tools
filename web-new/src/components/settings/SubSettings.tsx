import type { ReactNode } from 'react';

// 親スイッチ ON で現れる子設定のグループ。インデント+接続線で
// 「この設定は上の項目に属する」ことを視覚的に示す。
export function SubSettings({ children }: { children: ReactNode }) {
  return <div className="ml-4 space-y-2 border-l-2 border-primary/40 pl-3">{children}</div>;
}
