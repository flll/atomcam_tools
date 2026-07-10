import { useEffect, useRef, useState } from 'react';
import { SettingComment } from '@/components/settings';
import { useWatermark } from '@/hooks/useWatermark';
import { runCmd } from '@/lib/runCmd';

export function WatermarkEditor() {
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

  async function drawAndSave(dataUrl: string) {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    if (img.width > 500 || img.height > 200) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d')?.drawImage(img, 0, 0);
    await saveCanvas(canvas);
  }

  function onDrop(file: File) {
    const reader = new FileReader();
    reader.onload = () => runCmd(drawAndSave(reader.result as string));
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
        {/* 透過 PNG が白ロゴでも黒ロゴでも見えるよう、背景は CSS の市松模様にする
            (canvas 自体には描かない: ピクセルデータはそのままカメラへ送るため) */}
        <canvas
          ref={canvasRef}
          className="max-w-full rounded"
          style={{
            backgroundImage:
              'repeating-conic-gradient(rgba(128,128,128,0.35) 0% 25%, rgba(128,128,128,0.12) 0% 50%)',
            backgroundSize: '16px 16px',
          }}
        />
      </div>
    </SettingComment>
  );
}
