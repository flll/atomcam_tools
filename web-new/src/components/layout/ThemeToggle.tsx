import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme-provider';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const { t } = useTranslation();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={t('common.theme')} title={t('common.theme')}>
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}
