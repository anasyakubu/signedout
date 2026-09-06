// The garment catalogue. Each entry says three things: what mesh to load,
// where on that mesh's UV atlas the printable front/back panels sit, and how
// to frame it in the camera.
//
// Why the UV rects matter: drawPanel() paints a flat 5:6 canvas, and the print
// export renders that exact same canvas at 3000x3600. That WYSIWYG guarantee
// is the thing we must not break. So instead of teaching drawPanel about 3D,
// we composite its output into a rectangle of the garment's texture atlas.
// drawPanel stays untouched; the export stays pixel-identical; the shirt gets
// real geometry.

export interface UVRect {
  /** 0..1 from the LEFT of the atlas. */
  x: number;
  /** 0..1 from the TOP of the atlas (canvas convention — three's flipY handles the rest). */
  y: number;
  /** Width as a fraction of atlas width. */
  w: number;
  /** Height as a fraction of atlas height. */
  h: number;
  /** Set when the model's back UV island is mirrored (most exported garments are). */
  flipX?: boolean;
}

export type GarmentId =
  | 'classic-tee'
  | 'oversized-tee'
  | 'boxy-tee'
  | 'long-sleeve'
  | 'crewneck'
  | 'hoodie'
  | 'polo';

export interface GarmentDef {
  id: GarmentId;
  label: string;
  /** Blurb for the picker. One line, plain language. */
  hint: string;
  /**
   * Path to the .glb under client/public/models/. Null means no model is
   * installed yet and the procedural fallback mesh is used instead.
   */
  model: string | null;
  /** Texture atlas resolution. 2048 is plenty; 4096 costs ~64MB of VRAM. */
  atlas: number;
  panels: { front: UVRect; back: UVRect };
  camera: { position: [number, number, number]; fov: number; target: [number, number, number] };
  /** Uniform scale applied after load, to normalise wildly different model units. */
  fit: number;
}

// The panel rects below are STARTING GUESSES for a typical front/back-split
// garment UV layout (front island on the left half, back island on the right).
// They will not be correct for your specific models. Run the viewer with
// ?uvdebug=1 to overlay the rects on the garment and nudge these numbers until
// the grid sits square on the chest. Takes about two minutes per garment.
const DEFAULT_PANELS: { front: UVRect; back: UVRect } = {
  front: { x: 0.06, y: 0.1, w: 0.4, h: 0.55 },
  back: { x: 0.54, y: 0.1, w: 0.4, h: 0.55, flipX: true },
};

export const GARMENTS: GarmentDef[] = [
  {
    id: 'classic-tee',
    label: 'Classic tee',
    hint: 'Standard fit, set-in sleeves',
    model: '/models/classic-tee.glb',
    atlas: 2048,
    panels: DEFAULT_PANELS,
    camera: { position: [0, 0.05, 2.6], fov: 35, target: [0, 0, 0] },
    fit: 1,
  },
  {
    id: 'oversized-tee',
    label: 'Oversized tee',
    hint: 'Dropped shoulder, boxy body',
    model: '/models/oversized-tee.glb',
    atlas: 2048,
    panels: DEFAULT_PANELS,
    camera: { position: [0, 0.05, 2.8], fov: 35, target: [0, 0, 0] },
    fit: 1,
  },
  {
    id: 'boxy-tee',
    label: 'Cropped tee',
    hint: 'Short body, wide cut',
    model: '/models/boxy-tee.glb',
    atlas: 2048,
    // Cropped body: less vertical room, so the panel is shorter.
    panels: {
      front: { x: 0.06, y: 0.14, w: 0.4, h: 0.42 },
      back: { x: 0.54, y: 0.14, w: 0.4, h: 0.42, flipX: true },
    },
    camera: { position: [0, 0.05, 2.5], fov: 35, target: [0, 0, 0] },
    fit: 1,
  },
  {
    id: 'long-sleeve',
    label: 'Long sleeve',
    hint: 'Full sleeve, ribbed cuffs',
    model: '/models/long-sleeve.glb',
    atlas: 2048,
    panels: DEFAULT_PANELS,
    camera: { position: [0, 0.05, 2.8], fov: 35, target: [0, 0, 0] },
    fit: 1,
  },
  {
    id: 'crewneck',
    label: 'Crewneck',
    hint: 'Heavyweight sweatshirt',
    model: '/models/crewneck.glb',
    atlas: 2048,
    panels: DEFAULT_PANELS,
    camera: { position: [0, 0.05, 2.9], fov: 35, target: [0, 0, 0] },
    fit: 1,
  },
  {
    id: 'hoodie',
    label: 'Hoodie',
    hint: 'Hood and kangaroo pocket',
    model: '/models/hoodie.glb',
    atlas: 2048,
    // The pocket eats the lower chest, so the usable panel sits higher.
    panels: {
      front: { x: 0.06, y: 0.08, w: 0.38, h: 0.44 },
      back: { x: 0.54, y: 0.08, w: 0.38, h: 0.52, flipX: true },
    },
    camera: { position: [0, 0.05, 3.0], fov: 35, target: [0, 0, 0] },
    fit: 1,
  },
  {
    id: 'polo',
    label: 'Polo',
    hint: 'Collar and button placket',
    model: '/models/polo.glb',
    atlas: 2048,
    panels: {
      front: { x: 0.06, y: 0.14, w: 0.38, h: 0.5 },
      back: { x: 0.54, y: 0.1, w: 0.38, h: 0.54, flipX: true },
    },
    camera: { position: [0, 0.05, 2.6], fov: 35, target: [0, 0, 0] },
    fit: 1,
  },
];

export const DEFAULT_GARMENT: GarmentId = 'classic-tee';

export function getGarment(id: string | undefined | null): GarmentDef {
  return GARMENTS.find((g) => g.id === id) ?? GARMENTS[0];
}
