import { useEffect, useRef, useState, PointerEvent } from 'react';
import { Button } from '../../components/ui';

// A small purpose-built signature pad (~70 lines) instead of pulling in
// react-signature-canvas: pointer events, stroke smoothing via quadratic
// midpoints, transparent-PNG export.

interface Props {
  onCapture: (blob: Blob, previewUrl: string) => void;
}

export default function DrawPad({ onCapture }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#161D18';
  }, []);

  function pos(e: PointerEvent): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function down(e: PointerEvent) {
    drawing.current = true;
    last.current = pos(e);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function move(e: PointerEvent) {
    if (!drawing.current || !last.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = pos(e);
    const mid = { x: (last.current.x + p.x) / 2, y: (last.current.y + p.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.quadraticCurveTo(last.current.x, last.current.y, mid.x, mid.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setHasInk(true);
  }

  function up() {
    drawing.current = false;
    last.current = null;
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  function capture() {
    canvasRef.current!.toBlob((blob) => {
      if (blob) onCapture(blob, URL.createObjectURL(blob));
    }, 'image/png');
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="h-48 w-full touch-none border border-line bg-white"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
      />
      <div className="mt-3 flex gap-3">
        <Button type="button" onClick={capture} disabled={!hasInk}>
          Use this signature
        </Button>
        <Button type="button" variant="secondary" onClick={clear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
