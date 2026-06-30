import useSWR from 'swr';
import { api, parseWatermarkDimensions } from '@/api';

export function useWatermark() {
  const { data, error, isLoading, mutate } = useSWR('watermark', () => api.getWatermark(), {
    revalidateOnFocus: false,
  });

  const dims = data ? parseWatermarkDimensions(data) : null;

  async function saveCanvas(canvas: HTMLCanvasElement) {
    await api.saveWatermarkFromCanvas(canvas);
    await mutate(undefined, { revalidate: true });
  }

  return { blob: data, dims, isLoading, error, saveCanvas, mutate };
}
