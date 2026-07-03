import { lazy, useEffect, useRef, useState } from 'react';

function parseRectProperty(raw: string | undefined): { x: number; y: number; w: number; h: number } | null {
  if (!raw || raw === 'all' || raw === 'rect') return null;
  const parts = raw.split(/\s+/);
  if (parts.length < 5) return null;
  return { x: Number(parts[1]), y: Number(parts[2]), w: Number(parts[3]), h: Number(parts[4]) };
}
import type { CameraProperty } from '@/api';

const Stage = lazy(() => import('react-konva').then((m) => ({ default: m.Stage })));
const Layer = lazy(() => import('react-konva').then((m) => ({ default: m.Layer })));
const Rect = lazy(() => import('react-konva').then((m) => ({ default: m.Rect })));

export default function MotionAreaOverlay({
  property,
  onRectChange,
}: {
  property: CameraProperty;
  onRectChange: (cmd: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 480 });
  // 編集差分 ?? property からの導出(effect での同期を持たない)
  const [rectEdit, setRectEdit] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const rect = rectEdit ?? parseRectProperty(property.motionArea) ?? { x: 80, y: 60, w: 200, h: 150 };

  useEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function commit(next: typeof rect) {
    setRectEdit(next);
    onRectChange(`rect ${next.x} ${next.y} ${next.w} ${next.h}`);
  }

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0">
      <Stage width={size.w} height={size.h} className="pointer-events-auto">
        <Layer>
          <Rect
            x={rect.x}
            y={rect.y}
            width={rect.w}
            height={rect.h}
            stroke="#22c55e"
            strokeWidth={2}
            draggable
            onDragEnd={(e) => commit({ ...rect, x: e.target.x(), y: e.target.y() })}
          />
        </Layer>
      </Stage>
    </div>
  );
}
