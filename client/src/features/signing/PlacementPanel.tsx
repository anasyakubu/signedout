import { useEffect, useRef, useState, PointerEvent } from 'react';
import { drawPanel, ensureFontsLoaded, PANEL_RATIO } from '../../three/drawPanel';
import { BaseAsset, SignatureData } from '../../lib/types';

export interface Placement {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

interface Props {
  shirtColor: string;
  assets: BaseAsset[];
  signatures: SignatureData[];
  side: 'front' | 'back';
  placement: Placement;
  onChange: (p: Placement) => void;
  /** Live preview of the item being placed. */
  preview:
  | { kind: 'text'; text: string; fontFamily: string; color: string; fontSize: number }
  | { kind: 'image'; url: string };
}

/**
 * The flat-panel placement editor: a template outline of one shirt side where
 * the signer drags their signature into place — the standard shirt-customizer
 * technique, far more reliable than clicking on a rotating 3D surface.
 */
export default function PlacementPanel({
  shirtColor,
  assets,
  signatures,
  side,
  placement,
  onChange,
  preview,
}: Props) {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const canvas = bgRef.current;
    if (!canvas) return;
    canvas.width = 600;
    canvas.height = Math.round(600 * PANEL_RATIO);
    ensureFontsLoaded().then(() =>
      drawPanel(canvas, { shirtColor, assets, signatures, side })
    );
  }, [shirtColor, assets, signatures, side]);

  function pointFromEvent(e: PointerEvent): { x: number; y: number } | null {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  function onPointerDown(e: PointerEvent) {
    dragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = pointFromEvent(e);
    if (p) onChange({ ...placement, ...p });
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging.current) return;
    const p = pointFromEvent(e);
    if (p) onChange({ ...placement, ...p });
  }
  function onPointerUp() {
    dragging.current = false;
  }

  const widthPct = placement.scale * 100;

  return (
    <div>
      <div
        ref={boxRef}
        className="relative w-full cursor-crosshair touch-none select-none border border-line"
        style={{ aspectRatio: `1 / ${PANEL_RATIO}` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <canvas ref={bgRef} className="absolute inset-0 h-full w-full" />
        <div
          className="pointer-events-none absolute border-2 border-dashed border-laurel"
          style={{
            left: `${placement.x * 100}%`,
            top: `${placement.y * 100}%`,
            width: `${widthPct}%`,
            transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
          }}
        >
          {preview.kind === 'text' ? (
            <div
              className="whitespace-nowrap text-center"
              style={{
                fontFamily: `"${preview.fontFamily}"`,
                color: preview.color,
                // fontSize is a fraction of panel width; approximate with cqw-free math
                fontSize: `${preview.fontSize * 600 * 0.5}px`,
                lineHeight: 1.1,
              }}
            >
              {preview.text || 'Your name'}
            </div>
          ) : (
            <img src={preview.url} alt="" className="block w-full" draggable={false} />
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-semibold text-ink">Size</span>
          <input
            type="range"
            min={0.05}
            max={0.8}
            step={0.01}
            value={placement.scale}
            onChange={(e) => onChange({ ...placement, scale: Number(e.target.value) })}
            className="mt-2 w-full accent-laurel"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-ink">Rotation</span>
          <input
            type="range"
            min={-45}
            max={45}
            step={1}
            value={placement.rotation}
            onChange={(e) => onChange({ ...placement, rotation: Number(e.target.value) })}
            className="mt-2 w-full accent-laurel"
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-stone">
        Tap or drag on the shirt panel to position your signature.
      </p>
    </div>
  );
}
