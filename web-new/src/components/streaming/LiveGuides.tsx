import { useTranslation } from 'react-i18next';
import { ExternalLink, Link2, Radio, TimerReset } from 'lucide-react';
import {
  Section,
  SettingInput,
  SettingInputNumber,
  SettingSwitch,
  SubSettings,
} from '@/components/settings';
import { Button } from '@/components/ui/button';
import { SnippetBlock } from '@/components/ui/snippet';
import { cn } from '@/lib/utils';
import type { HackIni } from '@/api';

// RTMP URL の雛形に入れるキー部分(全言語共通の目印)
const KEY = 'YOUR_STREAM_KEY';

// 主要ライブ配信サイト。手順は共通の3ステップで、サイト固有の事情だけ note に出す。
// tmpl が null のサイト(ニコ生)は放送ごとに URL が変わるため雛形を持たない。
// mark は本家ロゴではなくブランド色+頭文字(商標を同梱しないための代替表現)。
const PROVIDERS: {
  key: string;
  name: string;
  initial: string;
  color: string;
  host: string;
  keyUrl: string;
  tmpl: string | null;
}[] = [
  {
    key: 'youtube',
    name: 'YouTube Live',
    initial: 'YT',
    color: '#FF0033',
    host: 'rtmp.youtube.com',
    keyUrl: 'https://studio.youtube.com/',
    tmpl: `rtmp://a.rtmp.youtube.com/live2/${KEY}`,
  },
  {
    key: 'twitch',
    name: 'Twitch',
    initial: 'TW',
    color: '#9146FF',
    host: 'live.twitch.tv',
    keyUrl: 'https://dashboard.twitch.tv/settings/stream',
    tmpl: `rtmp://live.twitch.tv/app/${KEY}`,
  },
  {
    key: 'niconico',
    name: 'ニコニコ生放送',
    initial: 'NL',
    color: '#252525',
    host: 'nicovideo.jp',
    keyUrl: 'https://live.nicovideo.jp/create',
    tmpl: null,
  },
  {
    key: 'facebook',
    name: 'Facebook Live',
    initial: 'FB',
    color: '#0866FF',
    host: 'facebook.com',
    keyUrl: 'https://www.facebook.com/live/producer',
    tmpl: `rtmps://live-api-s.facebook.com:443/rtmp/${KEY}`,
  },
];

// 保存済みの RTMP URL から配信先を推定する(選択状態を state で持たずに復元できる)
function detectProvider(url: string) {
  return PROVIDERS.find((p) => url.includes(p.host)) ?? null;
}

// ライブ配信(RTMP)の設定と接続ガイドを1か所に統合したセクション。
// 以前は「連携カードの RTMP」と「配信ガイド」に分かれていて同じ話が二重に見えていた。
export function LiveGuides({
  draft,
  patch,
  config,
}: {
  draft: HackIni;
  patch: (v: Partial<HackIni>) => void;
  /** サーバ保存済みの設定。「配信中」バッジは未保存の編集ではなく実際の状態で出す */
  config?: HackIni;
}) {
  const { t: tUi } = useTranslation('ui');
  const url = draft.RTMP_URL ?? '';
  const enabled = draft.RTMP_ENABLE === 'on';
  const live = config?.RTMP_ENABLE === 'on' && (config.RTMP_URL ?? '') !== '';
  const selected = detectProvider(url);

  const choose = (p: (typeof PROVIDERS)[number]) => {
    // 雛形を持つ配信先はURLごと差し替える。ニコ生は放送ごとにURLが変わるので空にして促す
    patch({ RTMP_URL: p.tmpl ?? '', RTMP_ENABLE: 'on' });
  };

  return (
    <Section
      title={tUi('hub.live.title')}
      description={tUi('hub.live.desc')}
      action={
        live ? (
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
            {tUi('hub.live.onAir')}
          </span>
        ) : null
      }
    >
      {/* 配信先を選ぶ(選択でURL雛形が入る) */}
      <div className="px-4 py-3">
        <p className="text-title-s">{tUi('hub.live.choose')}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PROVIDERS.map((p) => {
            const active = selected?.key === p.key;
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={active}
                onClick={() => choose(p)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-card border p-3 text-xs font-medium transition-[background-color,border-color,transform] duration-short-2 active:scale-[0.97]',
                  active
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-foreground/5',
                )}
              >
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                  style={{ backgroundColor: p.color }}
                >
                  {p.initial}
                </span>
                <span className="text-center leading-tight">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 選択した配信先の手順 */}
      {selected && (
        <div className="space-y-3 px-4 py-3">
          <p className="text-title-s">{tUi('hub.live.howto', { name: selected.name })}</p>
          <ol className="list-decimal space-y-2 pl-5 text-xs leading-relaxed text-muted-foreground">
            <li>{tUi('hub.guide.step1')}</li>
            <li>{selected.tmpl ? tUi('hub.guide.step2b') : tUi(`hub.guide.${selected.key}.step2`)}</li>
            <li>{tUi('hub.guide.step3')}</li>
          </ol>
          {selected.tmpl && <SnippetBlock text={selected.tmpl} />}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {tUi(`hub.guide.${selected.key}.note`)}
          </p>
          <a href={selected.keyUrl} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm">
              {tUi('hub.guide.getKey')}
              <ExternalLink className="size-3.5" />
            </Button>
          </a>
        </div>
      )}

      {/* 配信設定そのもの */}
      <SettingSwitch
        icon={Radio}
        i18nKey="RTMP"
        value={draft.RTMP_ENABLE ?? 'off'}
        onChange={(v) => patch({ RTMP_ENABLE: v })}
      />
      {enabled && (
        <SubSettings>
          <SettingInput
            icon={Link2}
            i18nKey="RTMP.URL"
            value={url}
            onChange={(v) => patch({ RTMP_URL: v })}
          />
          <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            {tUi('hub.youtube.autoNote')}
          </p>
          <SettingInputNumber
            icon={TimerReset}
            i18nKey="RTMP.IntervalRestart"
            value={Math.abs(Number(draft.RTMP_RESTART ?? 240))}
            min={20}
            max={2880}
            onChange={(v) => patch({ RTMP_RESTART: String(-v) })}
          />
        </SubSettings>
      )}
    </Section>
  );
}
