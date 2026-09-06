import * as THREE from 'three';
import { GarmentDef, UVRect } from './garments';

// Two jobs live here:
//   1. composeAtlas — paint the flat 5:6 panel canvases into the garment's UV
//      atlas, so drawPanel() never has to know 3D exists.
//   2. fabricNormalMap — generate a cotton-weave normal map in code. This is
//      where a surprising share of "that looks real" actually comes from: flat
//      lambert cloth reads as plastic no matter how good the mesh is.

/**
 * Paint the base colour across the whole atlas, then drop each panel canvas
 * into its UV rectangle. Because drawPanel already fills its canvas with the
 * same shirtColor, the rectangle edges disappear into the surrounding fabric.
 */
export function composeAtlas(
  atlas: HTMLCanvasElement,
  def: GarmentDef,
  panels: { front: HTMLCanvasElement; back: HTMLCanvasElement },
  shirtColor: string,
  debugRects = false
): void {
  const ctx = atlas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = shirtColor;
  ctx.fillRect(0, 0, atlas.width, atlas.height);

  (['front', 'back'] as const).forEach((side) => {
    const r: UVRect = def.panels[side];
    const dx = r.x * atlas.width;
    const dy = r.y * atlas.height;
    const dw = r.w * atlas.width;
    const dh = r.h * atlas.height;

    ctx.save();
    if (r.flipX) {
      ctx.translate(dx + dw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(panels[side], 0, 0, dw, dh);
    } else {
      ctx.drawImage(panels[side], dx, dy, dw, dh);
    }
    ctx.restore();

    if (debugRects) drawCalibrationGrid(ctx, dx, dy, dw, dh, side);
  });
}

/**
 * Calibration overlay for dialling in a new model's panel rects. Enable with
 * ?uvdebug=1. Nudge the numbers in garments.ts until the grid sits square and
 * centred on the chest, with the edges landing at the seams.
 */
function drawCalibrationGrid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string
): void {
  ctx.save();
  ctx.strokeStyle = '#1C5A3F';
  ctx.lineWidth = Math.max(2, w * 0.006);
  ctx.strokeRect(x, y, w, h);

  ctx.strokeStyle = 'rgba(28, 90, 63, 0.4)';
  ctx.lineWidth = Math.max(1, w * 0.002);
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (w * i) / 5, y);
    ctx.lineTo(x + (w * i) / 5, y + h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + (h * i) / 5);
    ctx.lineTo(x + w, y + (h * i) / 5);
    ctx.stroke();
  }

  ctx.fillStyle = '#1C5A3F';
  ctx.font = `700 ${w * 0.09}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.toUpperCase(), x + w / 2, y + h / 2);
  ctx.restore();
}

let cachedNormal: THREE.DataTexture | null = null;

/**
 * A woven-cotton normal map, generated once and shared by every garment.
 * Height field = an over/under weave plus fine fibre noise; normals come from
 * the central difference of that field.
 */
export function fabricNormalMap(size = 512): THREE.DataTexture {
  if (cachedNormal) return cachedNormal;

  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const weave = Math.sin(x * 0.85) * 0.5 + Math.sin(y * 0.85) * 0.5;
      const slub = Math.sin(x * 0.11 + y * 0.07) * 0.15;
      const fibre = (Math.random() - 0.5) * 0.4;
      height[y * size + x] = weave * 0.5 + slub + fibre;
    }
  }

  const at = (x: number, y: number) =>
    height[((y + size) % size) * size + ((x + size) % size)];

  const data = new Uint8Array(size * size * 4);
  const strength = 2.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      // Normalise (-dx, -dy, 1) into 0..255 tangent space.
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      data[i + 2] = (1 / len) * 0.5 * 255 + 127.5;
      data[i + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  tex.needsUpdate = true;
  cachedNormal = tex;
  return tex;
}
