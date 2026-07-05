import { useEffect, useRef, useState } from 'react';
import { Check, Languages } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { springGentle } from '@/lib/motion-tokens';
import { Button } from '@/components/ui/button';
import { runCmd } from '@/lib/runCmd';

// 表示名は各言語の自称(ネイティブ名)で固定する。
// 追加時は src/i18n.ts の supportedLngs / scripts/convert-i18n.mjs も揃えること。
const LANGUAGES = [
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '简体中文' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
] as const;

// 言語選択メニュー。選択は localStorage(locale) に永続化される。
// placement: レール下部では上へ、モバイルヘッダーでは下へ開く。
export function LangSwitch({ placement = 'up' }: { placement?: 'up' | 'down' }) {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => i18n.resolvedLanguage === l.code) ?? LANGUAGES[0];

  // メニュー外クリック/Escape で閉じる
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('common.language')}
        title={t('common.language')}
        onClick={() => setOpen((v) => !v)}
      >
        <Languages />
        <span className="uppercase">{current.code}</span>
      </Button>
      <AnimatePresence>
        {open && (
          <m.div
            role="menu"
            aria-label={t('common.language')}
            initial={{ opacity: 0, scale: 0.95, y: placement === 'up' ? 6 : -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: placement === 'up' ? 4 : -4 }}
            transition={springGentle}
            className={cn(
              'absolute z-50 min-w-36 rounded-xl border border-border bg-surface-container-high p-1 shadow-elevation-2',
              placement === 'up' ? 'bottom-full left-0 mb-2' : 'right-0 top-full mt-2',
            )}
          >
            {LANGUAGES.map((lang) => {
              const active = lang.code === current.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  lang={lang.code}
                  onClick={() => {
                    setOpen(false);
                    runCmd(i18n.changeLanguage(lang.code), { quiet: true });
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
                    active
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'text-on-surface-variant hover:bg-foreground/10 hover:text-foreground',
                  )}
                >
                  <Check className={cn('size-3.5 shrink-0', active ? 'opacity-100' : 'opacity-0')} />
                  {lang.label}
                </button>
              );
            })}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
