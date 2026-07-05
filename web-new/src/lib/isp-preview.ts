// ISP 値(0-255、128=標準)を CSS フィルタで近似するためのヘルパ。
// JPEG は 800ms ポーリング+カメラ側適用遅延で実映像への反映が 1〜2 秒遅れるため、
// スライダー操作中はこの近似で「触った瞬間に画が動く」体感を作り、
// 実フレームが追いついたらフィルタを解いて引き継ぐ。あくまで方向感の近似であり
// 実機の ISP カーブとは一致しない(sharp は CSS 等価がなく対象外)。
import type { IspSettings } from '@/api';

export type IspFilterKey = 'cont' | 'bri' | 'sat';

export const ISP_FILTER_KEYS: readonly IspFilterKey[] = ['cont', 'bri', 'sat'];

const CSS_FN: Record<IspFilterKey, string> = {
  cont: 'contrast',
  bri: 'brightness',
  sat: 'saturate',
};

// 128→1.0。0 で完全消失(真っ黒/白黒)まではいかない実機の効き方に寄せて
// 下限を 0.35 に留める(255→約1.65)。
export function ispToFactor(value: number): number {
  const v = Math.min(255, Math.max(0, value));
  return 0.35 + (v / 128) * 0.65;
}

// 実映像が from の状態のときに to の見え方を近似する filter 文字列を返す。
// 差が実質ないキーは含めず、全キー同値なら空文字。
export function ispDeltaFilter(from: Partial<IspSettings>, to: Partial<IspSettings>): string {
  const parts: string[] = [];
  for (const key of ISP_FILTER_KEYS) {
    const f = from[key];
    const t = to[key];
    if (typeof f !== 'number' || typeof t !== 'number') continue;
    const ratio = ispToFactor(t) / ispToFactor(f);
    if (Math.abs(ratio - 1) < 0.005) continue;
    parts.push(`${CSS_FN[key]}(${ratio.toFixed(3)})`);
  }
  return parts.join(' ');
}
