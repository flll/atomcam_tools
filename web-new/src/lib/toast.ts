export type ToastVariant = 'success' | 'error';

export interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

type Listener = (items: ToastItem[]) => void;

// React コンテキスト不要のモジュールレベル・バス。
// フックやイベントハンドラからも toast.success()/error() を直接呼べる。
let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(items);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts(): ToastItem[] {
  return items;
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function push(variant: ToastVariant, message: string) {
  const id = ++seq;
  items = [...items, { id, variant, message }];
  emit();
  setTimeout(() => dismissToast(id), variant === 'error' ? 6000 : 3000);
}

export const toast = {
  success: (message: string) => push('success', message),
  error: (message: string) => push('error', message),
};
