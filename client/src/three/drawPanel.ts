import { BaseAsset, SignatureData } from '../lib/types';

// One renderer for every surface a shirt panel appears on: the live 3D
// texture, the placement-editor preview, and the high-res print export.
// Everything is stored resolution-independent (positions 0..1, sizes as
// fractions of panel width), so the same data draws identically at 512px
// and at 3000px.

export const PANEL_RATIO = 6 / 5; // height / width

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(url: string): Promise<HTMLImageElement> {
  let cached = imageCache.get(url);
  if (!cached) {
    cached = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
    imageCache.set(url, cached);
  }
  return cached;
}

interface DrawOptions {
  shirtColor: string;
  assets: BaseAsset[];
  signatures: SignatureData[];
  side: 'front' | 'back';
  watermark?: boolean;
  highlightId?: string | null;
}

export async function drawPanel(canvas: HTMLCanvasElement, opts: DrawOptions): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = opts.shirtColor;
  ctx.fillRect(0, 0, W, H);

  const drawPlaced = async (
    item: { x: number; y: number; rotation: number },
    draw: () => Promise<void> | void
  ) => {
    ctx.save();
    ctx.translate(item.x * W, item.y * H);
    ctx.rotate((item.rotation * Math.PI) / 180);
    await draw();
    ctx.restore();
  };

  for (const asset of opts.assets.filter((a) => a.side === opts.side)) {
    try {
      const img = await loadImage(asset.url);
      const drawW = asset.scale * W;
      const drawH = drawW * (img.height / img.width);
      await drawPlaced(asset, () => {
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      });
    } catch {
      // Missing asset: skip rather than fail the whole panel.
    }
  }

  for (const sig of opts.signatures.filter((s) => s.side === opts.side)) {
    if (sig.type === 'text') {
      await drawPlaced(sig, () => {
        const px = (sig.fontSize ?? 0.05) * W;
        ctx.font = `${px}px "${sig.fontFamily ?? 'Caveat'}"`;
        ctx.fillStyle = sig.color ?? '#161D18';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sig.content, 0, 0);
      });
    } else {
      try {
        const img = await loadImage(sig.content);
        const drawW = sig.scale * W;
        const drawH = drawW * (img.height / img.width);
        await drawPlaced(sig, () => {
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        });
      } catch {
        // Skip unloadable signature image.
      }
    }
    if (opts.highlightId && sig._id === opts.highlightId) {
      ctx.save();
      ctx.strokeStyle = '#1C5A3F';
      ctx.lineWidth = Math.max(2, W * 0.004);
      const boxW = sig.scale * W;
      ctx.strokeRect(sig.x * W - boxW / 2, sig.y * H - boxW / 2, boxW, boxW);
      ctx.restore();
    }
  }

  if (opts.watermark) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.font = `700 ${W * 0.07}px "Public Sans"`;
    ctx.fillStyle = 'rgba(22, 29, 24, 0.18)';
    ctx.textAlign = 'center';
    for (let i = -2; i <= 2; i++) {
      ctx.fillText('SIGNEDOUT PREVIEW', 0, i * H * 0.28);
    }
    ctx.restore();
  }
}

/** Wait for the curated signature fonts so canvas text matches the browser. */
export async function ensureFontsLoaded(): Promise<void> {
  const families = [
    'Caveat',
    'Dancing Script',
    'Homemade Apple',
    'Shadows Into Light',
    'Public Sans',
    'Young Serif',
  ];
  await Promise.all(families.map((f) => document.fonts.load(`24px "${f}"`))).catch(() => undefined);
}
