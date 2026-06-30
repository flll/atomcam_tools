import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LangSwitch } from './LangSwitch';
import { ThemeToggle } from './ThemeToggle';
import { NAV, type NavItem } from './nav';
import { useHackIni } from '@/hooks/useHackIni';

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

export function AppLayout() {
  const { t } = useTranslation();
  const { config } = useHackIni();
  const nav = filterNav(NAV, config?.PRODUCT_MODEL);

  return (
    <div className="flex min-h-dvh flex-col bg-background md:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card/40 md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
          <span className="text-base font-semibold tracking-tight">{t('app.title')}</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClass}>
              <item.icon className="size-4" />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
          <span className="text-sm font-medium text-muted-foreground md:hidden">{t('app.title')}</span>
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

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-card/95 backdrop-blur md:hidden">
        {nav.filter((i) => i.primary).map((item) => (
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
      </nav>
    </div>
  );
}
