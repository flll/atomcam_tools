import { Suspense, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { springBouncy, springGentle } from '@/lib/motion-tokens';
import { Brand } from './Brand';
import { LangSwitch } from './LangSwitch';
import { ThemeToggle } from './ThemeToggle';
import { NAV, type NavGroup, type NavItem } from './nav';
import { useHackIni } from '@/hooks/useHackIni';
import { Toaster } from '@/components/ui/toaster';

function filterNav(items: NavItem[], model?: string): NavItem[] {
  const isSwing = model === 'ATOM_CAKP1JZJP';
  const isAtom = model?.startsWith('ATOM') && !isSwing;
  return items.filter((item) => {
    if (item.to === '/settings/camera') return isAtom;
    if (item.to === '/settings/cruise') return isSwing;
    return true;
  });
}

const GROUPS: NavGroup[] = ['live', 'settings', 'tools'];

// M3 ナビゲーションレールの1項目。アクティブピルは layoutId で項目間を
// スプリング移動する(このシェル全体の「触り心地」の要)。
function RailItem({ item, label }: { item: NavItem; label: string }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className="group flex w-full flex-col items-center gap-0.5 py-1 text-center text-[11px] font-medium leading-tight outline-none break-keep"
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'relative flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-short-4 ease-standard',
              'group-focus-visible:ring-2 group-focus-visible:ring-ring',
              isActive ? 'text-on-secondary-container' : 'text-on-surface-variant group-hover:bg-foreground/10',
            )}
          >
            {isActive && (
              <m.span
                layoutId="rail-pill"
                transition={springGentle}
                className="absolute inset-0 rounded-full bg-secondary-container"
              />
            )}
            <item.icon className="relative size-5" />
          </span>
          <span className={cn('transition-colors', isActive ? 'text-foreground' : 'text-on-surface-variant')}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function AppLayout() {
  const { t } = useTranslation();
  const { config } = useHackIni();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const nav = filterNav(NAV, config?.PRODUCT_MODEL);
  const primary = nav.filter((i) => i.primary);

  const current = nav.find((i) =>
    i.to === '/' ? location.pathname === '/' : location.pathname.startsWith(i.to),
  );
  // 現在地が primary にない場合は「その他」をアクティブ表示する
  const moreActive = current != null && !current.primary;

  return (
    <div className="flex min-h-dvh flex-col bg-background md:flex-row">
      {/* デスクトップ: M3 ナビゲーションレール(schedule.spec が aside 内のリンク名に依存) */}
      <aside className="sticky top-0 hidden h-dvh w-[88px] shrink-0 flex-col items-center bg-surface-container-low/60 md:flex">
        <div className="flex h-14 items-center" title={t('app.title')}>
          <Brand />
        </div>
        <nav className="flex w-full flex-1 flex-col items-center gap-0.5 overflow-y-auto px-2 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {GROUPS.map((key, gi) => {
            const items = nav.filter((i) => i.group === key);
            if (items.length === 0) return null;
            return (
              <div key={key} className="flex w-full flex-col items-center gap-0.5">
                {gi > 0 && <div className="my-2 h-px w-8 bg-border" />}
                {items.map((item) => (
                  <RailItem key={item.to} item={item} label={t(item.labelKey)} />
                ))}
              </div>
            );
          })}
        </nav>
        <div className="flex flex-col items-center gap-1 pb-3">
          <LangSwitch />
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ヘッダーはモバイルのみ(デスクトップは言語/テーマをレール下部に集約) */}
        <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-border/50 bg-background/80 px-4 backdrop-blur md:hidden">
          <span className="flex items-center gap-2.5">
            <Brand withName />
            {current && (
              <span className="border-l border-border pl-2.5 text-sm font-medium text-muted-foreground">
                {t(current.labelKey)}
              </span>
            )}
          </span>
          <div className="flex items-center gap-1">
            <LangSwitch />
            <ThemeToggle />
          </div>
        </header>

        <main
          className={cn(
            'flex-1',
            // Live(ルート)は没入型: ステージをエッジ to エッジにする
            location.pathname === '/' ? 'p-0 pb-20 md:pb-0' : 'p-4 pb-24 md:p-8 md:pb-8',
          )}
        >
          <Suspense fallback={<div className="p-8 text-muted-foreground">{t('common.loading')}</div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <Toaster />

      {/* モバイル: M3 ナビゲーションバー */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex bg-surface-container pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_0_hsl(var(--border))] md:hidden">
        {primary.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className="group flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium"
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'relative flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-short-4 ease-standard',
                    isActive ? 'text-on-secondary-container' : 'text-on-surface-variant',
                  )}
                >
                  {isActive && (
                    <m.span
                      layoutId="bottomnav-pill"
                      transition={springGentle}
                      className="absolute inset-0 rounded-full bg-secondary-container"
                    />
                  )}
                  <item.icon className="relative size-5" />
                </span>
                <span className={isActive ? 'text-foreground' : 'text-on-surface-variant'}>
                  {t(item.labelKey)}
                </span>
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className="group flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium"
        >
          <span
            className={cn(
              'flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-short-4 ease-standard',
              moreActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant',
            )}
          >
            <LayoutGrid className="size-5" />
          </span>
          <span className={moreActive ? 'text-foreground' : 'text-on-surface-variant'}>{t('nav.more')}</span>
        </button>
      </nav>

      {/* モバイル「その他」シート(スプリング出入り) */}
      <AnimatePresence>
        {moreOpen && (
          <div className="fixed inset-0 z-30 md:hidden" role="dialog" aria-modal="true" aria-label={t('nav.more')}>
            <m.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-scrim/60"
              aria-label={t('common.close')}
              onClick={() => setMoreOpen(false)}
            />
            <m.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={springBouncy}
              className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface-container-high p-4 pb-8 shadow-elevation-3"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />
              <div className="grid grid-cols-3 gap-2">
                {nav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex flex-col items-center gap-1.5 rounded-2xl p-3 text-xs transition-colors duration-short-4 ease-standard active:scale-[0.97]',
                        isActive
                          ? 'bg-secondary-container text-on-secondary-container'
                          : 'text-on-surface-variant hover:bg-foreground/10 hover:text-foreground',
                      )
                    }
                  >
                    <item.icon className="size-5" />
                    {t(item.labelKey)}
                  </NavLink>
                ))}
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
