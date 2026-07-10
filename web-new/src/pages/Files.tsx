import { useEffect, useState } from 'react';
import { ChevronRight, Download, File, Folder, HardDrive, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCameraStatus } from '@/hooks/useCameraStatus';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/format';

interface Entry {
  name: string;
  href: string;
  dir: boolean;
}

// lighttpd の dir-listing HTML から <a> を抜き出す。
// ソートリンク(?C=...)・親ディレクトリ(../)・絶対パスは除外する。
function parseListing(html: string): Entry[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.querySelectorAll('a'))
    .map((a) => ({ name: (a.textContent ?? '').trim(), href: a.getAttribute('href') ?? '' }))
    .filter(({ href }) => href && !href.startsWith('?') && href !== '../' && !href.startsWith('/') && !href.startsWith('http'))
    .map(({ name, href }) => ({ name: name.replace(/\/$/, ''), href, dir: href.endsWith('/') }));
}

// SD カード内のファイルブラウザ。
// iframe 埋め込みだと SPA フォールバック環境で index.html が返り
// アプリ自身が再帰表示される(合わせ鏡)ため、fetch+自前描画にした。
// 実機では lighttpd の一覧、モックでは MSW の /sdcard ハンドラが応答する。
export default function FilesPage() {
  const { t } = useTranslation('translation');
  const { media } = useCameraStatus();
  const [path, setPath] = useState('');
  // 取得結果は path とセットで保持し、現在の path と一致するものだけ表示する
  // (effect 内で同期 setState によるリセットをしないため)
  const [data, setData] = useState<{ path: string; entries: Entry[] } | null>(null);
  const [errorPath, setErrorPath] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/sdcard/${path}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      })
      .then((html) => {
        if (!cancelled) setData({ path, entries: parseListing(html) });
      })
      .catch(() => {
        if (!cancelled) setErrorPath(path);
      });
    return () => {
      cancelled = true;
    };
  }, [path, reloadKey]);

  const entries = data != null && data.path === path ? data.entries : null;
  const error = entries == null && errorPath === path;

  const crumbs = path.split('/').filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-title-xl">{t('SDCard.tab')}</h1>
      {media && (
        <p className="text-sm text-muted-foreground">
          {t('SDCard.remainingCapacity')}:{' '}
          <span className="font-mono tabular-nums">
            {formatBytes(media.available)} / {formatBytes(media.total)}
          </span>
        </p>
      )}

      {/* パンくず */}
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <button
          type="button"
          onClick={() => setPath('')}
          className="flex items-center gap-2 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <HardDrive className="size-4" /> SD
        </button>
        {crumbs.map((seg, i) => (
          <span key={`${seg}-${i}`} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 text-muted-foreground/60" />
            <button
              type="button"
              onClick={() => setPath(`${crumbs.slice(0, i + 1).join('/')}/`)}
              className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {seg}
            </button>
          </span>
        ))}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-8"
          aria-label={t('ui:common.loading')}
          onClick={() => setReloadKey((k) => k + 1)}
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <div className="overflow-hidden rounded-card border border-border">
        {entries == null && !error && (
          <div className="p-8 text-center text-sm text-muted-foreground">{t('ui:common.loading')}</div>
        )}
        {error && (
          <div className="p-8 text-center text-sm text-muted-foreground">{t('ui:common.offline')}</div>
        )}
        {entries != null && entries.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">–</div>
        )}
        {entries?.map((e) =>
          e.dir ? (
            <button
              key={e.href}
              type="button"
              onClick={() => setPath(`${path}${e.href}`)}
              className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-accent"
            >
              <Folder className="size-4 shrink-0 text-primary" />
              <span className="truncate">{e.name}</span>
            </button>
          ) : (
            <a
              key={e.href}
              href={`/sdcard/${path}${e.href}`}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-accent"
            >
              <File className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{e.name}</span>
              <Download className="ml-auto size-3.5 shrink-0 text-muted-foreground/60" />
            </a>
          ),
        )}
      </div>
    </div>
  );
}
