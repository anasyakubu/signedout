import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { CeremonyData, SignatureData, PaymentRequiredInfo } from '../lib/types';
import { Wordmark, Button, FormError } from '../components/ui';
import ShirtViewer from '../three/ShirtScene';
import CheckoutPanel from '../features/payments/CheckoutPanel';
import { exportPng, exportPdf } from '../lib/exportShirt';

interface StudioData {
  ceremony: CeremonyData;
  signatures: SignatureData[];
  canEdit: boolean;
}

export default function CeremonyStudio() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<StudioData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [uploadSide, setUploadSide] = useState<'front' | 'back'>('front');
  const [uploading, setUploading] = useState(false);
  const [exportGate, setExportGate] = useState<PaymentRequiredInfo | null>(null);
  const [exportWatermark, setExportWatermark] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setData(await api<StudioData>(`/api/ceremonies/${id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this ceremony.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Signatures land while the owner watches — poll lightly.
  useEffect(() => {
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  if (error) {
    return (
      <Shell>
        <FormError message={error} />
        <Link to="/dashboard" className="mt-4 inline-block text-sm font-semibold text-laurel">
          Back to dashboard
        </Link>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell>
        <p className="text-stone">Loading the studio</p>
      </Shell>
    );
  }

  const { ceremony, signatures, canEdit } = data;
  const shareUrl = `${window.location.origin}/sign/${ceremony.slug}`;

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('side', uploadSide);
      form.append('x', '0.5');
      form.append('y', '0.35');
      form.append('scale', '0.45');
      form.append('rotation', '0');
      await api(`/api/ceremonies/${id}/assets`, { method: 'POST', body: form });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeAsset(assetId?: string) {
    if (!assetId || !id) return;
    await api(`/api/ceremonies/${id}/assets/${assetId}`, { method: 'DELETE' });
    await load();
  }

  async function removeSignature(sigId: string) {
    if (!id) return;
    await api(`/api/ceremonies/${id}/signatures/${sigId}`, { method: 'DELETE' });
    await load();
  }

  async function toggleLock() {
    if (!id) return;
    await api(`/api/ceremonies/${id}/lock`, {
      method: 'POST',
      body: JSON.stringify({ locked: !ceremony.isLocked }),
    });
    await load();
  }

  async function changeColor(color: string) {
    if (!id) return;
    await api(`/api/ceremonies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ shirtColor: color }),
    });
    await load();
  }

  async function runExport(kind: 'png-front' | 'png-back' | 'pdf') {
    if (!id) return;
    setExporting(kind);
    setError(null);
    try {
      // Server is the authority on whether the watermark applies.
      const access = await api<{
        watermark: boolean;
        paymentRequired: PaymentRequiredInfo | null;
      }>(`/api/ceremonies/${id}/export/access`);
      setExportWatermark(access.watermark);
      if (access.watermark && access.paymentRequired) setExportGate(access.paymentRequired);
      const input = {
        title: ceremony.title,
        shirtColor: ceremony.shirtColor,
        assets: ceremony.baseAssets,
        signatures,
        watermark: access.watermark,
      };
      if (kind === 'pdf') await exportPdf(input);
      else await exportPng(input, kind === 'png-front' ? 'front' : 'back');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The export failed.');
    } finally {
      setExporting(null);
    }
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">{ceremony.title}</h1>
          <p className="mt-1 text-sm text-stone">
            {new Date(ceremony.date).toLocaleDateString()} — {signatures.length}{' '}
            {signatures.length === 1 ? 'signature' : 'signatures'}
            {ceremony.isLocked ? ' — closed to new signatures' : ''}
          </p>
          <span className="signature-line mt-3" />
        </div>
        {canEdit && (
          <Button variant={ceremony.isLocked ? 'secondary' : 'primary'} onClick={toggleLock}>
            {ceremony.isLocked ? 'Reopen signing' : 'Close signing'}
          </Button>
        )}
      </div>

      <FormError message={error} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <ShirtViewer
          shirtColor={ceremony.shirtColor}
          assets={ceremony.baseAssets}
          signatures={signatures}
        />

        <div className="space-y-8">
          <section className="border border-line bg-white p-5">
            <h2 className="font-display text-lg text-ink">Share the signing link</h2>
            <p className="mt-2 text-sm text-stone">
              Anyone with this link can sign — no account needed.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.target.select()}
                className="w-full border border-line bg-paper px-3 py-2 text-sm"
              />
              <Button type="button" onClick={copyLink}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </section>

          {canEdit && (
            <section className="border border-line bg-white p-5">
              <h2 className="font-display text-lg text-ink">Base design</h2>
              <p className="mt-2 text-sm text-stone">
                School crest, class year, artwork — placed under everyone's signatures.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <select
                  value={uploadSide}
                  onChange={(e) => setUploadSide(e.target.value as 'front' | 'back')}
                  className="border border-line bg-white px-3 py-2 text-sm"
                  aria-label="Which side to place the artwork on"
                >
                  <option value="front">Front</option>
                  <option value="back">Back</option>
                </select>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={onUpload}
                  disabled={uploading}
                  className="text-sm"
                />
              </div>
              {ceremony.baseAssets.length > 0 && (
                <ul className="mt-4 divide-y divide-line border-t border-line pt-1">
                  {ceremony.baseAssets.map((a) => (
                    <li key={a._id} className="flex items-center justify-between gap-3 py-2">
                      <div className="flex items-center gap-3">
                        <img src={a.url} alt="" className="h-10 w-10 border border-line object-contain" />
                        <span className="text-sm text-stone">{a.side} panel</span>
                      </div>
                      <button
                        onClick={() => removeAsset(a._id)}
                        className="text-sm font-semibold text-danger hover:underline"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4">
                <p className="mb-1.5 text-sm font-semibold text-ink">Shirt color</p>
                <input
                  type="color"
                  value={ceremony.shirtColor}
                  onChange={(e) => changeColor(e.target.value.toUpperCase())}
                  className="h-9 w-16 cursor-pointer border border-line"
                  aria-label="Shirt color"
                />
              </div>
            </section>
          )}

          {canEdit && (
            <section className="border border-line bg-white p-5">
              <h2 className="font-display text-lg text-ink">Download for print</h2>
              <p className="mt-2 text-sm text-stone">
                High-resolution panels (3000 x 3600) plus a print-ready PDF with crop marks.
              </p>
              {exportWatermark && (
                <p className="mt-2 text-sm font-semibold text-laurel">
                  Downloads carry a preview watermark until the design is unlocked.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  onClick={() => runExport('png-front')}
                  disabled={exporting !== null}
                >
                  {exporting === 'png-front' ? 'Rendering' : 'Front PNG'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => runExport('png-back')}
                  disabled={exporting !== null}
                >
                  {exporting === 'png-back' ? 'Rendering' : 'Back PNG'}
                </Button>
                <Button onClick={() => runExport('pdf')} disabled={exporting !== null}>
                  {exporting === 'pdf' ? 'Rendering' : 'Print-ready PDF'}
                </Button>
              </div>
              {exportGate && (
                <div className="mt-4">
                  <CheckoutPanel
                    info={exportGate}
                    ceremonyId={ceremony._id}
                    heading="Unlock the watermark-free download"
                    onFreeSuccess={() => {
                      setExportGate(null);
                      setExportWatermark(false);
                      load();
                    }}
                    onCancel={() => setExportGate(null)}
                  />
                </div>
              )}
            </section>
          )}

          {canEdit && (
            <section className="border border-line bg-white p-5">
              <h2 className="font-display text-lg text-ink">Signatures</h2>
              {signatures.length === 0 ? (
                <p className="mt-2 text-sm text-stone">
                  None yet. Share the link above and they will appear here live.
                </p>
              ) : (
                <ul className="mt-3 max-h-80 divide-y divide-line overflow-y-auto">
                  {signatures.map((s) => (
                    <li key={s._id} className="flex items-center justify-between gap-3 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {s.guestName ?? 'Signed-in member'}
                        </p>
                        <p className="text-xs text-stone">
                          {s.type} — {s.side} — {new Date(s.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => removeSignature(s._id)}
                        className="text-sm font-semibold text-danger hover:underline"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Wordmark to="/dashboard" />
        <Link to="/dashboard" className="text-sm font-semibold text-ink hover:text-laurel">
          Dashboard
        </Link>
      </header>
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-4">{children}</main>
    </div>
  );
}
