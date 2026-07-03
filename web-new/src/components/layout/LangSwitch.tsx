import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { runCmd } from '@/lib/runCmd';

// ja <-> en のトグル。選択は localStorage(locale) に永続化される。
export function LangSwitch() {
  const { i18n, t } = useTranslation();
  const current = i18n.resolvedLanguage === 'en' ? 'en' : 'ja';
  const next = current === 'ja' ? 'en' : 'ja';
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5"
      onClick={() => runCmd(i18n.changeLanguage(next), { quiet: true })}
      aria-label={t('common.language')}
      title={t('common.language')}
    >
      <Languages />
      <span className="uppercase">{current}</span>
    </Button>
  );
}
