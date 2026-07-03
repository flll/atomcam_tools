import { Suspense, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LangSwitch } from './LangSwitch';
import { ThemeToggle } from './ThemeToggle';
import { NAV, type NavGroup, type NavItem } from './nav';
import { useHackIni } from '@/hooks/useHackIni';
import { Toaster } from '@/components/ui/toaster';

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
  );
}

function filterNav(items: NavItem[], model?: string): NavItem[] {
  const isSwing = model === 'ATOM_CAKP1JZJP';
  const isAtom = model?.startsWith('ATOM') && !isSwing;
  return items.filter((item) => {
    if (item.to === '/settings/camera') return isAtom;
    if (item.to === '/settings/cruise') return isSwing;
    return true;
  });
}

const GROUPS: { key: NavGroup; labelKey?: string }[] = [
  { key: 'live' },
  { key: 'settings', labelKey: 'nav.settings' },
  { key: 'tools', labelKey: 'nav.tools' },
];

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
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card/40 md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
          <span className="text-base font-semibold tracking-tight">{t('app.title')}</span>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {GROUPS.map(({ key, labelKey }) => {
            const items = nav.filter((i) => i.group === key);
            if (items.length === 0) return null;
            return (
              <div key={key} className="space-y-1">
                {labelKey && (
                  <div className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {t(labelKey)}
                  </div>
                )}
                {items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClass}>
                    <item.icon className="size-4" />
                    {t(item.labelKey)}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
          <span className="text-sm font-medium text-muted-foreground md:hidden">
            {current ? t(current.labelKey) : t('app.title')}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <LangSwitch />
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">
          <Suspense fallback={<div className="p-8 text-muted-foreground">{t('common.loading')}</div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <Toaster />

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-card/95 backdrop-blur md:hidden">
        {primary.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn('flex flex-1 flex-col items-center gap-1 py-2 text-[11px]', isActive ? 'text-primary' : 'text-muted-foreground')
            }
          >
            <item.icon className="size-5" />
            {t(item.labelKey)}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={cn(
            'flex flex-1 flex-col items-center gap-1 py-2 text-[11px]',
            moreActive ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <LayoutGrid className="size-5" />
          {t('nav.more')}
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-30 md:hidden" role="dialog" aria-modal="true" aria-label={t('nav.more')}>
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label={t('common.close')}
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-card p-4 pb-8 shadow-2xl">
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
                      'flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs',
                      isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )
                  }
                >
                  <item.icon className="size-5" />
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
