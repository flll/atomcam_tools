import { lazy, useEffect, useRef, useState } from 'react';
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
  const [rect, setRect] = useState({ x: 80, y: 60, w: 200, h: 150 });

  useEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const raw = property.motionArea;
    if (!raw || raw === 'all' || raw === 'rect') return;
    const parts = raw.split(/\s+/);
    if (parts.length >= 5) {
      const sx = Number(parts[1]);
      const sy = Number(parts[2]);
      const w = Number(parts[3]);
      const h = Number(parts[4]);
      setRect({ x: sx, y: sy, w, h });
    }
  }, [property.motionArea]);

  function commit(next: typeof rect) {
    setRect(next);
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
