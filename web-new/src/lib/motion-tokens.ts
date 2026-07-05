// motion/react 用のスプリングプリセット。
// CSS 側のモーショントークン(index.css の --motion-*)と世界観を揃える:
// 操作応答は速く、シートやパネルの出入りはぬるっと微オーバーシュート。
import type { Transition } from 'motion/react';

/** 押下・ホバー等の即応(オーバーシュートほぼなし) */
export const springSnappy: Transition = { type: 'spring', stiffness: 700, damping: 40 };

/** コントロールバーの出入り等(なめらか・控えめな余韻) */
export const springGentle: Transition = { type: 'spring', stiffness: 350, damping: 32 };

/** シート・パネルの出入り(バネ感・微オーバーシュート) */
export const springBouncy: Transition = { type: 'spring', stiffness: 400, damping: 26 };

/** opacity 等スケールしない属性向けの短いトゥイーン */
export const fadeShort: Transition = { duration: 0.2, ease: [0.2, 0, 0, 1] };
