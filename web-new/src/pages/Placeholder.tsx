import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

// 未実装ルート用の 404 フォールバック表示。
export default function Placeholder({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-2xl space-y-4 py-10 text-center">
      <h1 className="text-title-xl">{t(titleKey)}</h1>
      <p className="text-muted-foreground">{t('placeholder.comingSoon')}</p>
      <Button asChild variant="outline">
        <Link to="/">{t('placeholder.backToLive')}</Link>
      </Button>
    </div>
  );
}
