import { PDFDocument, rgb } from 'pdf-lib';
import { drawPanel, ensureFontsLoaded, PANEL_RATIO } from '../three/drawPanel';
import { BaseAsset, SignatureData } from './types';

// Print export renders client-side with the exact same drawPanel code as the
// live 3D texture — what you see on screen is byte-for-byte what prints.
// 3000px wide at the 5:6 panel ratio = 3000x3600, comfortably print-grade.

const EXPORT_W = 3000;
const EXPORT_H = Math.round(EXPORT_W * PANEL_RATIO);

interface ExportInput {
  title: string;
  shirtColor: string;
  assets: BaseAsset[];
  signatures: SignatureData[];
  watermark: boolean;
}

async function renderSide(input: ExportInput, side: 'front' | 'back'): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_W;
  canvas.height = EXPORT_H;
  await ensureFontsLoaded();
  await drawPanel(canvas, {
    shirtColor: input.shirtColor,
    assets: input.assets,
    signatures: input.signatures,
    side,
    watermark: input.watermark,
  });
  return canvas.toDataURL('image/png');
}

function download(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export async function exportPng(input: ExportInput, side: 'front' | 'back'): Promise<void> {
  const dataUrl = await renderSide(input, side);
  download(dataUrl, `${slugify(input.title)}-${side}.png`);
}

export async function exportPdf(input: ExportInput): Promise<void> {
  const [front, back] = await Promise.all([
    renderSide(input, 'front'),
    renderSide(input, 'back'),
  ]);
  const pdf = await PDFDocument.create();

  for (const [label, dataUrl] of [
    ['FRONT', front],
    ['BACK', back],
  ] as const) {
    // A3 portrait in points, panel centered with crop/bleed guides.
    const page = pdf.addPage([841.89, 1190.55]);
    const png = await pdf.embedPng(dataUrl);
    const margin = 90;
    const maxW = page.getWidth() - margin * 2;
    const maxH = page.getHeight() - margin * 2 - 40;
    const ratio = Math.min(maxW / png.width, maxH / png.height);
    const w = png.width * ratio;
    const h = png.height * ratio;
    const x = (page.getWidth() - w) / 2;
    const y = (page.getHeight() - h) / 2 - 10;
    page.drawImage(png, { x, y, width: w, height: h });

    // Crop marks at each corner of the print area.
    const mark = 24;
    const line = { color: rgb(0.09, 0.11, 0.09), thickness: 1 };
    const corners: Array<[number, number, number, number]> = [
      [x, y, -1, -1],
      [x + w, y, 1, -1],
      [x, y + h, -1, 1],
      [x + w, y + h, 1, 1],
    ];
    for (const [cx, cy, dx, dy] of corners) {
      page.drawLine({ start: { x: cx, y: cy + dy * 6 }, end: { x: cx, y: cy + dy * (6 + mark) }, ...line });
      page.drawLine({ start: { x: cx + dx * 6, y: cy }, end: { x: cx + dx * (6 + mark), y: cy }, ...line });
    }
    page.drawText(`SignedOut  |  ${input.title}  |  ${label} PANEL  |  print at 100% scale`, {
      x: margin,
      y: 40,
      size: 11,
      color: rgb(0.36, 0.4, 0.38),
    });
  }

  const bytes = await pdf.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  download(url, `${slugify(input.title)}-print-ready.pdf`);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'signedout';
}
