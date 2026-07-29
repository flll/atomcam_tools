import { useTranslation } from 'react-i18next';
import { ExternalLink, Radio } from 'lucide-react';
import { Section } from '@/components/settings';
import { Disclosure } from '@/components/ui/disclosure';
import { Button } from '@/components/ui/button';
import { SnippetBlock } from '@/components/ui/snippet';
import { toast } from '@/lib/toast';
import type { HackIni } from '@/api';

// RTMP URL に入れる雛形のキー部分(全言語共通の目印)
const KEY = 'YOUR_STREAM_KEY';

// 主要ライブ配信サイトの接続ガイド。手順は全サイト共通の3ステップ
// (キー取得 → 雛形をURLへ → 保存)で、サイト固有の注意だけ note に出す。
// tmpl が null のサイト(ニコ生)は放送ごとに URL が変わるため雛形ボタンを出さない。
const PROVIDERS: { key: string; name: string; keyUrl: string; tmpl: string | null }[] = [
  { key: 'youtube', name: 'YouTube Live', keyUrl: 'https://studio.youtube.com/', tmpl: `rtmp://a.rtmp.youtube.com/live2/${KEY}` },
  { key: 'twitch', name: 'Twitch', keyUrl: 'https://dashboard.twitch.tv/settings/stream', tmpl: `rtmp://live.twitch.tv/app/${KEY}` },
  { key: 'niconico', name: 'ニコニコ生放送', keyUrl: 'https://live.nicovideo.jp/create', tmpl: null },
  { key: 'facebook', name: 'Facebook Live', keyUrl: 'https://www.facebook.com/live/producer', tmpl: `rtmps://live-api-s.facebook.com:443/rtmp/${KEY}` },
];

export function LiveGuides({ patch }: { patch: (v: Partial<HackIni>) => void }) {
  const { t: tUi } = useTranslation('ui');

  const applyProvider = (tmpl: string) => {
    patch({ RTMP_ENABLE: 'on', RTMP_URL: tmpl });
    toast.success(tUi('hub.guide.applied'));
  };

  return (
    <Section card={false} title={tUi('hub.guide.title')} description={tUi('hub.guide.desc')}>
      <div className="grid gap-3 sm:grid-cols-2">
        {PROVIDERS.map((p) => (
          <div key={p.key} className="space-y-3 rounded-card border border-border bg-card p-4 shadow-l100">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-control bg-secondary-container text-on-secondary-container">
                <Radio aria-hidden="true" className="size-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">{p.name}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{tUi(`hub.guide.${p.key}.desc`)}</p>
              </div>
            </div>
            <Disclosure summary={tUi('hub.guide.open')}>
              <ol className="list-decimal space-y-2 pl-5 text-xs leading-relaxed text-muted-foreground">
                <li>{tUi('hub.guide.step1')}</li>
                <li>{p.tmpl ? tUi('hub.guide.step2') : tUi(`hub.guide.${p.key}.step2`)}</li>
                <li>{tUi('hub.guide.step3')}</li>
              </ol>
              {p.tmpl && <SnippetBlock text={p.tmpl} />}
              <p className="text-xs leading-relaxed text-muted-foreground">{tUi(`hub.guide.${p.key}.note`)}</p>
              <div className="flex flex-wrap gap-2">
                <a href={p.keyUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    {tUi('hub.guide.getKey')}
                    <ExternalLink className="size-3.5" />
                  </Button>
                </a>
                {p.tmpl && (
                  <Button variant="secondary" size="sm" onClick={() => applyProvider(p.tmpl as string)}>
                    {tUi('hub.guide.useThis')}
                  </Button>
                )}
              </div>
            </Disclosure>
          </div>
        ))}
      </div>
    </Section>
  );
}
