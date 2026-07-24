import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import {
  BaseAsset,
  CeremonyData,
  PaymentRequiredInfo,
  SignatureData,
  SIGNATURE_FONTS,
} from '../lib/types';
import { Wordmark, Button, Field, FormError } from '../components/ui';
import { useAuth } from '../store/auth';
import ShirtViewer from '../three/ShirtScene';
import PlacementPanel, { Placement } from '../features/signing/PlacementPanel';
import DrawPad from '../features/signing/DrawPad';

interface PublicCeremony {
  id: string;
  title: string;
  description?: string;
  date: string;
  shirtColor: string;
  baseAssets: BaseAsset[];
  isLocked: boolean;
  slug: string;
}

type Step = 'viewing' | 'editing' | 'placing' | 'done';
type SigType = 'text' | 'draw' | 'image';

export default function SignPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [ceremony, setCeremony] = useState<PublicCeremony | null>(null);
  const [signatures, setSignatures] = useState<SignatureData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('viewing');

  const [sigType, setSigType] = useState<SigType>('text');
  const [guestName, setGuestName] = useState('');
  const [text, setText] = useState('');
  const [fontFamily, setFontFamily] = useState(SIGNATURE_FONTS[0]);
  const [color, setColor] = useState('#161D18');
  const [file, setFile] = useState<Blob | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [placement, setPlacement] = useState<Placement>({ x: 0.5, y: 0.6, scale: 0.28, rotation: 0 });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const data = await api<{ ceremony: PublicCeremony; signatures: SignatureData[] }>(
        `/api/ceremonies/public/${slug}`
      );
      setCeremony(data.ceremony);
      setSignatures(data.signatures);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'This signing link could not be opened.');
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => {
      if (step === 'viewing' || step === 'done') load();
    }, 8000);
    return () => clearInterval(t);
  }, [load, step]);

  if (error && !ceremony) {
    return (
      <Shell>
        <FormError message={error} />
      </Shell>
    );
  }
  if (!ceremony) {
    return (
      <Shell>
        <p className="text-stone">Opening the ceremony</p>
      </Shell>
    );
  }

  function onImagePick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setFilePreview(URL.createObjectURL(f));
    setStep('placing');
  }

  const readyToPlace =
    sigType === 'text' ? text.trim().length > 0 : file !== null && filePreview !== null;

  async function submit() {
    if (!ceremony) return;
    setSubmitting(true);
    setError(null);
    try {
      const common = {
        side,
        x: placement.x,
        y: placement.y,
        scale: placement.scale,
        rotation: placement.rotation,
        guestName: user ? undefined : guestName.trim(),
      };
      if (sigType === 'text') {
        await api(`/api/ceremonies/${ceremony.id}/signatures`, {
          method: 'POST',
          body: JSON.stringify({
            ...common,
            type: 'text',
            content: text.trim(),
            fontFamily,
            color,
            // Text size rides the scale slider: fontSize as fraction of width.
            fontSize: Math.min(0.3, placement.scale * 0.35),
          }),
        });
      } else {
        const form = new FormData();
        form.append('type', sigType);
        form.append('file', file!, 'signature.png');
        for (const [k, v] of Object.entries(common)) {
          if (v !== undefined) form.append(k, String(v));
        }
        await api(`/api/ceremonies/${ceremony.id}/signatures`, { method: 'POST', body: form });
      }
      setStep('done');
      setText('');
      setFile(null);
      setFilePreview(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Your signature could not be added.');
    } finally {
      setSubmitting(false);
    }
  }

  const preview =
    sigType === 'text'
      ? ({
          kind: 'text',
          text,
          fontFamily,
          color,
          fontSize: Math.min(0.3, placement.scale * 0.35),
        } as const)
      : ({ kind: 'image', url: filePreview ?? '' } as const);

  return (
    <Shell>
      <div className="text-center">
        <h1 className="font-display text-3xl text-ink">{ceremony.title}</h1>
        {ceremony.description && (
          <p className="mx-auto mt-2 max-w-lg text-[15px] text-stone">{ceremony.description}</p>
        )}
        <p className="mt-1 text-sm text-stone">
          {new Date(ceremony.date).toLocaleDateString()} — {signatures.length}{' '}
          {signatures.length === 1 ? 'signature' : 'signatures'} so far
        </p>
        <span className="signature-line mx-auto mt-4" />
      </div>

      <FormError message={error} />

      {step === 'viewing' || step === 'done' ? (
        <div className="mx-auto mt-8 max-w-lg">
          <ShirtViewer
            shirtColor={ceremony.shirtColor}
            assets={ceremony.baseAssets}
            signatures={signatures}
          />
          {step === 'done' && (
            <div className="mt-6 border border-laurel bg-laurel-pale p-4 text-center">
              <p className="font-semibold text-laurel-dark">Your signature is on the shirt.</p>
              <p className="mt-1 text-sm text-stone">Rotate it above to find yourself.</p>
            </div>
          )}
          <div className="mt-6 text-center">
            {ceremony.isLocked ? (
              <p className="border border-line bg-white p-4 text-sm text-stone">
                This ceremony is closed — the shirt has gone to print.
              </p>
            ) : (
              <Button onClick={() => setStep('editing')}>
                {step === 'done' ? 'Sign again' : 'Add your signature'}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="mx-auto mt-8 max-w-lg space-y-6">
          {!user && (
            <Field
              label="Your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="How should the class remember you?"
              maxLength={60}
              required
            />
          )}

          <div>
            <p className="mb-1.5 text-sm font-semibold text-ink">Signature style</p>
            <div className="flex border border-line bg-white">
              {(
                [
                  ['text', 'Type it'],
                  ['draw', 'Draw it'],
                  ['image', 'Upload it'],
                ] as const
              ).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setSigType(t);
                    setFile(null);
                    setFilePreview(null);
                    if (step === 'placing') setStep('editing');
                  }}
                  className={`flex-1 px-3 py-2.5 text-sm font-semibold ${
                    sigType === t ? 'bg-laurel text-white' : 'text-ink hover:text-laurel'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {sigType === 'text' && (
            <div className="space-y-4">
              <Field
                label="Your message"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Aisha B. — we made it"
                maxLength={60}
              />
              <div>
                <p className="mb-1.5 text-sm font-semibold text-ink">Handwriting</p>
                <div className="grid grid-cols-2 gap-2">
                  {SIGNATURE_FONTS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFontFamily(f)}
                      className={`border px-3 py-2 text-left text-lg ${
                        fontFamily === f ? 'border-laurel bg-laurel-pale' : 'border-line bg-white'
                      }`}
                      style={{ fontFamily: `"${f}"` }}
                    >
                      {text.trim() || 'Your name'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-semibold text-ink">Ink color</p>
                <div className="flex gap-2">
                  {['#161D18', '#1C5A3F', '#8A1F2D', '#1F3A5F', '#FFFFFF'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Ink color ${c}`}
                      onClick={() => setColor(c)}
                      className={`h-8 w-8 border-2 ${color === c ? 'border-laurel' : 'border-line'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {sigType === 'draw' && step === 'editing' && (
            <DrawPad
              onCapture={(blob, url) => {
                setFile(blob);
                setFilePreview(url);
                setStep('placing');
              }}
            />
          )}

          {sigType === 'image' && step === 'editing' && (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-ink">
                Upload a signature image (PNG with transparency works best)
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onImagePick}
                className="text-sm"
              />
            </div>
          )}

          {(sigType === 'text' || step === 'placing') && readyToPlace && (
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-sm font-semibold text-ink">Which side of the shirt</p>
                <div className="flex border border-line bg-white">
                  {(['front', 'back'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSide(s)}
                      className={`flex-1 px-3 py-2 text-sm font-semibold ${
                        side === s ? 'bg-laurel text-white' : 'text-ink hover:text-laurel'
                      }`}
                    >
                      {s === 'front' ? 'Front' : 'Back'}
                    </button>
                  ))}
                </div>
              </div>
              <PlacementPanel
                shirtColor={ceremony.shirtColor}
                assets={ceremony.baseAssets}
                signatures={signatures}
                side={side}
                placement={placement}
                onChange={setPlacement}
                preview={preview}
              />
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={submit}
              disabled={submitting || !readyToPlace || (!user && !guestName.trim())}
            >
              {submitting ? 'Adding your signature' : 'Put it on the shirt'}
            </Button>
            <Button variant="secondary" onClick={() => setStep('viewing')}>
              Back
            </Button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-center px-6 py-6">
        <Wordmark />
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-2">{children}</main>
    </div>
  );
}
