import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import '@fontsource-variable/inter/index.css';
import '@fontsource-variable/noto-sans-jp/index.css';
import App from './App';
import { ThemeProvider } from './components/theme-provider';
import './i18n';
import './index.css';

// dev は常にモック、build では demo モードのみモックを有効化する。
// HashRouter: GitHub Pages のサブパス配信とカメラ実機の双方で動かしやすい。
async function bootstrap() {
  if (import.meta.env.DEV || __DEMO__) {
    const { startMocks } = await import('../mocks/browser');
    await startMocks();
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </ThemeProvider>
    </StrictMode>,
  );
}

bootstrap().catch((e: unknown) => {
  console.error('bootstrap failed', e);
});
