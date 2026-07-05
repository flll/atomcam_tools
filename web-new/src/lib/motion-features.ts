// LazyMotion 用の feature バンドル遅延ロード。
// domMax(layout アニメーション込み)は重いので初回チャンクから外す。
// 静的 import してよいのは LazyMotion / m / AnimatePresence 等の軽量 API のみ。
export const loadMotionFeatures = () => import('motion/react').then((mod) => mod.domMax);
