import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

// locale JSON は public/locales/{lng}/translation.json から遅延ロードする。
// 言語は localStorage > navigator.language の順で検出（現行 LOCALE 互換は
// hack.ini 取得後に i18n.changeLanguage で上書きする）。
i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // 欠けたキーは en → ja の順で補完する(ja が正、en が国際共通)
    fallbackLng: ['en', 'ja'],
    // ja-JP 等の地域付きロケールで存在しない /locales/ja-JP/*.json を
    // 要求して 404 になるのを防ぐ(言語部分のみでロードする)
    load: 'languageOnly',
    supportedLngs: ['ja', 'en', 'zh', 'ko', 'es', 'fr', 'de', 'pt'],
    nonExplicitSupportedLngs: true,
    // translation: 旧 YAML 由来（自動生成）/ ui: 新 UI 文言（手書き）
    ns: ['ui', 'translation'],
    defaultNS: 'ui',
    fallbackNS: 'translation',
    interpolation: { escapeValue: false },
    backend: { loadPath: `${import.meta.env.BASE_URL}locales/{{lng}}/{{ns}}.json` },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'locale',
      caches: ['localStorage'],
    },
  })
  .catch((e: unknown) => {
    console.error('i18n init failed', e);
  });

export default i18n;
