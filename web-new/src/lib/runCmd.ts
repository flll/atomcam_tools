import i18n from '@/i18n';
import { toast } from '@/lib/toast';

export interface RunCmdOptions {
  /** 成功時に表示するトースト文言(省略時は表示しない) */
  success?: string;
  /** 失敗時のトースト文言(省略時は共通文言+詳細) */
  error?: string;
  /** 失敗を通知しない(高頻度なライブプレビュー等) */
  quiet?: boolean;
  onFinally?: () => void;
}

// fire-and-forget な非同期操作の唯一の入口。
// 返り値を void にすることで no-floating-promises と両立させる。
export function runCmd(promise: Promise<unknown>, opts: RunCmdOptions = {}): void {
  promise
    .then(() => {
      if (opts.success) toast.success(opts.success);
    })
    .catch((e: unknown) => {
      if (opts.quiet) return;
      const detail = e instanceof Error ? e.message : String(e);
      toast.error(opts.error ?? `${i18n.t('ui:common.execFailed')} (${detail})`);
    })
    .finally(() => opts.onFinally?.());
}
