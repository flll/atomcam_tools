import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';

// クリップボードにコピーするアイコンボタン(成功で一瞬チェック表示)。
export function CopyButton({ text }: { text: string }) {
  const { t: tUi } = useTranslation('ui');
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 shrink-0"
      aria-label={tUi('hub.copy')}
      title={tUi('hub.copy')}
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
            toast.success(tUi('hub.copied'));
          })
          .catch(() => toast.error(tUi('common.execFailed', { defaultValue: 'copy failed' })));
      }}
    >
      {done ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

// コード/設定例のブロック(右上にコピー)。
export function SnippetBlock({ text }: { text: string }) {
  return (
    <div className="relative">
      <pre className="max-h-72 overflow-auto rounded-control border border-border bg-surface-container-low p-3 pr-10 font-mono text-[11px] leading-relaxed">{text}</pre>
      <div className="absolute right-1.5 top-1.5">
        <CopyButton text={text} />
      </div>
    </div>
  );
}
