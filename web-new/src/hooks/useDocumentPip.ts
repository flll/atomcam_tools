import { useCallback, useEffect, useState } from 'react';

// Document Picture-in-Picture(Chrome 系限定)。非対応ブラウザでは supported=false
// になり、呼び出し側でボタンごと出さない。
interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

export function useDocumentPip() {
  const supported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  const toggle = useCallback(async () => {
    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
      return;
    }
    const win = await window.documentPictureInPicture!.requestWindow({ width: 480, height: 270 });
    // 親ページのスタイルを複製して Tailwind クラスを PiP 窓でも効かせる
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const style = win.document.createElement('style');
        style.textContent = Array.from(sheet.cssRules)
          .map((r) => r.cssText)
          .join('\n');
        win.document.head.appendChild(style);
      } catch {
        // クロスオリジンのシートは読めないので無視(自前アセットのみで足りる)
      }
    }
    win.document.body.style.margin = '0';
    win.document.body.style.background = '#000';
    win.addEventListener('pagehide', () => setPipWindow(null));
    setPipWindow(win);
  }, [pipWindow]);

  useEffect(
    () => () => {
      pipWindow?.close();
    },
    [pipWindow],
  );

  return { supported, pipWindow, toggle } as const;
}
