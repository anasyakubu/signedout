import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { CeremonyData, GroupData, PaymentRequiredInfo } from '../lib/types';
import { Wordmark, Field, Button, FormError } from '../components/ui';
import CheckoutPanel from '../features/payments/CheckoutPanel';

const SHIRT_COLORS = ['#FFFFFF', '#161D18', '#1C5A3F', '#8A1F2D', '#1F3A5F', '#C9B458', '#E8E4DA'];

export default function CeremonyNew() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [shirtColor, setShirtColor] = useState('#FFFFFF');
  const [visibility, setVisibility] = useState<'public' | 'invite' | 'group'>('public');
  const [groupId, setGroupId] = useState(params.get('groupId') ?? '');
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<PaymentRequiredInfo | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ groups: GroupData[] }>('/api/groups')
      .then((d) => setGroups(d.groups))
      .catch(() => setGroups([]));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body: Record<string, unknown> = { title, description, date, shirtColor, visibility };
      if (groupId) {
        body.groupId = groupId;
        body.visibility = visibility === 'public' ? 'public' : 'group';
      }
      const data = await api<{ ceremony: CeremonyData }>('/api/ceremonies', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      navigate(`/ceremonies/${data.ceremony._id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 402 && err.body?.paymentRequired) {
        // Server said this creation is a paid action; surface the checkout.
        setGate(err.body.paymentRequired as PaymentRequiredInfo);
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not create the ceremony.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-xl px-6 py-10">
      <Wordmark to="/dashboard" />
      <main className="mt-12">
        <h1 className="font-display text-3xl text-ink">New ceremony</h1>
        <span className="signature-line mt-4" />

        {gate ? (
          <div className="mt-8">
            <p className="mb-4 text-[15px] text-stone">
              You have used your free ceremonies. Unlock one more to continue.
            </p>
            <CheckoutPanel
              info={gate}
              heading="Unlock another ceremony"
              onFreeSuccess={() => {
                setGate(null);
              }}
              onCancel={() => setGate(null)}
            />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <FormError message={error} />
            <Field
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="BUK Computing Science Class of 2026"
              required
              minLength={3}
            />
            <div>
              <label htmlFor="desc" className="mb-1.5 block text-sm font-semibold text-ink">
                Description (optional)
              </label>
              <textarea
                id="desc"
                rows={2}
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-line bg-white px-3.5 py-2.5 text-[15px] focus:border-laurel focus:outline-none"
              />
            </div>
            <Field
              label="Ceremony date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <div>
              <p className="mb-1.5 text-sm font-semibold text-ink">Shirt color</p>
              <div className="flex flex-wrap gap-2">
                {SHIRT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Shirt color ${c}`}
                    onClick={() => setShirtColor(c)}
                    className={`h-9 w-9 border-2 ${
                      shirtColor === c ? 'border-laurel' : 'border-line'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={shirtColor}
                  onChange={(e) => setShirtColor(e.target.value.toUpperCase())}
                  aria-label="Custom shirt color"
                  className="h-9 w-9 cursor-pointer border border-line"
                />
              </div>
            </div>
            <div>
              <label htmlFor="vis" className="mb-1.5 block text-sm font-semibold text-ink">
                Who can open the signing link
              </label>
              <select
                id="vis"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as typeof visibility)}
                className="w-full border border-line bg-white px-3.5 py-2.5 text-[15px] focus:border-laurel focus:outline-none"
              >
                <option value="public">Anyone with the link</option>
                <option value="invite">Anyone with the link (unlisted)</option>
                {groupId && <option value="group">Group members only</option>}
              </select>
            </div>
            {groups.length > 0 && (
              <div>
                <label htmlFor="grp" className="mb-1.5 block text-sm font-semibold text-ink">
                  Belongs to a group (optional)
                </label>
                <select
                  id="grp"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full border border-line bg-white px-3.5 py-2.5 text-[15px] focus:border-laurel focus:outline-none"
                >
                  <option value="">No group — just mine</option>
                  {groups.map((g) => (
                    <option key={g._id} value={g._id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-3">
              <Button type="submit" disabled={busy}>
                {busy ? 'Creating' : 'Create ceremony'}
              </Button>
              <Link to="/dashboard">
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
