import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingComment } from '@/components/settings';
import { useWatermark } from '@/hooks/useWatermark';

export function WatermarkEditor() {
  const { t } = useTranslation('translation');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { blob, dims, saveCanvas } = useWatermark();
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    if (!blob || !canvasRef.current || !dims) return;
    const canvas = canvasRef.current;
    canvas.width = dims.width;
    canvas.height = dims.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rgba = new Uint8ClampedArray(blob.slice(8));
    const img = ctx.createImageData(dims.width, dims.height);
    for (let i = 0; i < dims.width * dims.height; i++) {
      img.data[i * 4] = rgba[i * 4 + 2];
      img.data[i * 4 + 1] = rgba[i * 4 + 1];
      img.data[i * 4 + 2] = rgba[i * 4];
      img.data[i * 4 + 3] = rgba[i * 4 + 3];
    }
    ctx.putImageData(img, 0, 0);
  }, [blob, dims]);

  function onDrop(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const img = new Image();
      img.src = reader.result as string;
      await img.decode();
      if (img.width > 500 || img.height > 200) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      await saveCanvas(canvas);
    };
    reader.readAsDataURL(file);
  }

  return (
    <SettingComment i18nKey="watermark.image">
      <div
        className={`mt-2 rounded border border-dashed p-4 ${drag ? 'border-primary bg-primary/5' : 'border-border'}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f?.name.endsWith('.png')) onDrop(f); }}
      >
        <canvas ref={canvasRef} className="max-w-full bg-transparent" />
        <p className="mt-2 text-xs text-muted-foreground">{t('watermark.image.comment')}</p>
      </div>
    </SettingComment>
  );
}
