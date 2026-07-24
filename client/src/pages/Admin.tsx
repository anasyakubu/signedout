import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { Wordmark, Button, Field, FormError } from '../components/ui';

type Tab = 'users' | 'ceremonies' | 'groups' | 'settings' | 'promos' | 'revenue';

const TABS: Array<[Tab, string]> = [
  ['users', 'Users'],
  ['ceremonies', 'Ceremonies'],
  ['groups', 'Groups'],
  ['settings', 'Monetization'],
  ['promos', 'Promo codes'],
  ['revenue', 'Revenue'],
];

export default function Admin() {
  const [tab, setTab] = useState<Tab>('users');

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Wordmark to="/dashboard" />
        <Link to="/dashboard" className="text-sm font-semibold text-ink hover:text-laurel">
          Dashboard
        </Link>
      </header>
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-4">
        <h1 className="font-display text-3xl text-ink">Admin</h1>
        <span className="signature-line mt-4" />
        <div className="mt-6 flex flex-wrap border border-line bg-white">
          {TABS.map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold ${
                tab === t ? 'bg-laurel text-white' : 'text-ink hover:text-laurel'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-8">
          {tab === 'users' && <UsersTab />}
          {tab === 'ceremonies' && <CeremoniesTab />}
          {tab === 'groups' && <GroupsTab />}
          {tab === 'settings' && <SettingsTab />}
          {tab === 'promos' && <PromosTab />}
          {tab === 'revenue' && <RevenueTab />}
        </div>
      </main>
    </div>
  );
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isSuspended: boolean;
  ceremonyCount: number;
}

function UsersTab() {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    try {
      const d = await api<{ users: AdminUser[] }>(
        `/api/admin/users?q=${encodeURIComponent(query)}`
      );
      setUsers(d.users);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load users.');
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  async function toggleSuspend(u: AdminUser) {
    try {
      await api(`/api/admin/users/${u.id}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ suspended: !u.isSuspended }),
      });
      await load(q);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suspension failed.');
    }
  }

  return (
    <div>
      <FormError message={error} />
      <Field
        label="Search by name or email"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="aisha@school.edu"
      />
      <table className="mt-5 w-full border border-line bg-white text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-stone">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Ceremonies</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3 font-semibold text-ink">{u.name}</td>
              <td className="px-4 py-3 text-stone">{u.email}</td>
              <td className="px-4 py-3">{u.role}</td>
              <td className="px-4 py-3">{u.ceremonyCount}</td>
              <td className="px-4 py-3">{u.isSuspended ? 'Suspended' : 'Active'}</td>
              <td className="px-4 py-3 text-right">
                {u.role !== 'admin' && (
                  <button
                    onClick={() => toggleSuspend(u)}
                    className={`text-sm font-semibold hover:underline ${
                      u.isSuspended ? 'text-laurel' : 'text-danger'
                    }`}
                  >
                    {u.isSuspended ? 'Reinstate' : 'Suspend'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CeremoniesTab() {
  const [rows, setRows] = useState<
    Array<{ _id: string; title: string; slug: string; isLocked: boolean; createdAt: string; ownerId?: { name?: string; email?: string } }>
  >([]);
  useEffect(() => {
    api<{ ceremonies: typeof rows }>('/api/admin/ceremonies').then((d) => setRows(d.ceremonies)).catch(() => undefined);
  }, []);
  return (
    <table className="w-full border border-line bg-white text-left text-sm">
      <thead>
        <tr className="border-b border-line text-xs uppercase tracking-wide text-stone">
          <th className="px-4 py-3">Title</th>
          <th className="px-4 py-3">Owner</th>
          <th className="px-4 py-3">Slug</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Created</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c._id} className="border-b border-line last:border-0">
            <td className="px-4 py-3 font-semibold text-ink">{c.title}</td>
            <td className="px-4 py-3 text-stone">{c.ownerId?.email ?? ''}</td>
            <td className="px-4 py-3 text-stone">{c.slug}</td>
            <td className="px-4 py-3">{c.isLocked ? 'Closed' : 'Open'}</td>
            <td className="px-4 py-3 text-stone">{new Date(c.createdAt).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GroupsTab() {
  const [rows, setRows] = useState<
    Array<{ _id: string; name: string; members: unknown[]; upgraded: boolean; ownerId?: { email?: string } }>
  >([]);
  useEffect(() => {
    api<{ groups: typeof rows }>('/api/admin/groups').then((d) => setRows(d.groups)).catch(() => undefined);
  }, []);
  return (
    <table className="w-full border border-line bg-white text-left text-sm">
      <thead>
        <tr className="border-b border-line text-xs uppercase tracking-wide text-stone">
          <th className="px-4 py-3">Name</th>
          <th className="px-4 py-3">Owner</th>
          <th className="px-4 py-3">Members</th>
          <th className="px-4 py-3">Upgraded</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((g) => (
          <tr key={g._id} className="border-b border-line last:border-0">
            <td className="px-4 py-3 font-semibold text-ink">{g.name}</td>
            <td className="px-4 py-3 text-stone">{g.ownerId?.email ?? ''}</td>
            <td className="px-4 py-3">{g.members.length}</td>
            <td className="px-4 py-3">{g.upgraded ? 'Yes' : 'No'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface Settings {
  monetizationEnabled: boolean;
  featureGates: {
    ceremonyCreation: { enabled: boolean; freeLimit: number };
    designDownload: { enabled: boolean };
    groupMembers: { enabled: boolean; freeLimit: number };
  };
  pricing: Record<'ceremonyCreation' | 'designDownload' | 'groupUpgrade', { NGN: number; USD: number }>;
  gateways: { paystack: { enabled: boolean }; flutterwave: { enabled: boolean } };
  currencyRouting: { NGN: string; USD: string };
}

function SettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ settings: Settings }>('/api/admin/settings')
      .then((d) => setSettings(d.settings))
      .catch(() => setError('Could not load settings.'));
  }, []);

  if (!settings) return <p className="text-stone">{error ?? 'Loading settings'}</p>;

  function patch(update: (s: Settings) => void) {
    setSettings((s) => {
      if (!s) return s;
      const copy = JSON.parse(JSON.stringify(s)) as Settings;
      update(copy);
      return copy;
    });
  }

  async function save() {
    setError(null);
    setSaved(false);
    try {
      const d = await api<{ settings: Settings }>('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      });
      setSettings(d.settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Saving failed.');
    }
  }

  const Toggle = ({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) => (
    <label className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className={`h-7 w-14 border ${on ? 'border-laurel bg-laurel' : 'border-line bg-paper'}`}
      >
        <span
          className={`block h-5 w-5 bg-white transition-transform ${on ? 'translate-x-8' : 'translate-x-1'}`}
        />
      </button>
    </label>
  );

  const PriceRow = ({
    label,
    keyName,
  }: {
    label: string;
    keyName: 'ceremonyCreation' | 'designDownload' | 'groupUpgrade';
  }) => (
    <div className="grid grid-cols-3 items-center gap-3 py-2">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {(['NGN', 'USD'] as const).map((cur) => (
        <label key={cur} className="text-sm">
          <span className="text-xs text-stone">{cur}</span>
          <input
            type="number"
            min={0}
            value={settings.pricing[keyName][cur]}
            onChange={(e) =>
              patch((s) => {
                s.pricing[keyName][cur] = Number(e.target.value);
              })
            }
            className="mt-1 w-full border border-line bg-white px-2 py-1.5"
          />
        </label>
      ))}
    </div>
  );

  return (
    <div className="max-w-2xl space-y-8">
      <FormError message={error} />
      {saved && (
        <p className="border border-laurel bg-laurel-pale p-3 text-sm text-laurel-dark">
          Settings saved — live immediately, no redeploy.
        </p>
      )}

      <section className="border border-line bg-white p-5">
        <h2 className="font-display text-lg text-ink">Master switch</h2>
        <Toggle
          on={settings.monetizationEnabled}
          onToggle={() => patch((s) => (s.monetizationEnabled = !s.monetizationEnabled))}
          label="Monetization enabled (off = everything free)"
        />
      </section>

      <section className="border border-line bg-white p-5">
        <h2 className="font-display text-lg text-ink">Feature gates</h2>
        <Toggle
          on={settings.featureGates.ceremonyCreation.enabled}
          onToggle={() =>
            patch((s) => (s.featureGates.ceremonyCreation.enabled = !s.featureGates.ceremonyCreation.enabled))
          }
          label="Charge for ceremonies beyond the free limit"
        />
        <label className="block py-2 text-sm">
          <span className="font-semibold text-ink">Free ceremonies per user</span>
          <input
            type="number"
            min={0}
            value={settings.featureGates.ceremonyCreation.freeLimit}
            onChange={(e) =>
              patch((s) => (s.featureGates.ceremonyCreation.freeLimit = Number(e.target.value)))
            }
            className="mt-1 w-28 border border-line bg-white px-2 py-1.5"
          />
        </label>
        <Toggle
          on={settings.featureGates.designDownload.enabled}
          onToggle={() =>
            patch((s) => (s.featureGates.designDownload.enabled = !s.featureGates.designDownload.enabled))
          }
          label="Charge for watermark-free downloads"
        />
        <Toggle
          on={settings.featureGates.groupMembers.enabled}
          onToggle={() =>
            patch((s) => (s.featureGates.groupMembers.enabled = !s.featureGates.groupMembers.enabled))
          }
          label="Cap free group size"
        />
        <label className="block py-2 text-sm">
          <span className="font-semibold text-ink">Free members per group</span>
          <input
            type="number"
            min={1}
            value={settings.featureGates.groupMembers.freeLimit}
            onChange={(e) =>
              patch((s) => (s.featureGates.groupMembers.freeLimit = Number(e.target.value)))
            }
            className="mt-1 w-28 border border-line bg-white px-2 py-1.5"
          />
        </label>
      </section>

      <section className="border border-line bg-white p-5">
        <h2 className="font-display text-lg text-ink">Pricing</h2>
        <PriceRow label="Extra ceremony" keyName="ceremonyCreation" />
        <PriceRow label="Download unlock" keyName="designDownload" />
        <PriceRow label="Group upgrade" keyName="groupUpgrade" />
      </section>

      <section className="border border-line bg-white p-5">
        <h2 className="font-display text-lg text-ink">Gateways and routing</h2>
        <Toggle
          on={settings.gateways.paystack.enabled}
          onToggle={() => patch((s) => (s.gateways.paystack.enabled = !s.gateways.paystack.enabled))}
          label="Paystack enabled"
        />
        <Toggle
          on={settings.gateways.flutterwave.enabled}
          onToggle={() =>
            patch((s) => (s.gateways.flutterwave.enabled = !s.gateways.flutterwave.enabled))
          }
          label="Flutterwave enabled"
        />
        {(['NGN', 'USD'] as const).map((cur) => (
          <label key={cur} className="block py-2 text-sm">
            <span className="font-semibold text-ink">{cur} payments route to</span>
            <select
              value={settings.currencyRouting[cur]}
              onChange={(e) => patch((s) => (s.currencyRouting[cur] = e.target.value))}
              className="mt-1 block w-48 border border-line bg-white px-2 py-1.5"
            >
              <option value="paystack">Paystack</option>
              <option value="flutterwave">Flutterwave</option>
            </select>
          </label>
        ))}
      </section>

      <Button onClick={save}>Save settings</Button>
    </div>
  );
}

interface Promo {
  _id: string;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  currency?: string;
  maxUses?: number;
  usedCount: number;
  expiresAt?: string;
  applicablePurposes: string[];
  isActive: boolean;
}

const PURPOSES = [
  ['ceremony_creation', 'Extra ceremony'],
  ['download_unlock', 'Download unlock'],
  ['group_upgrade', 'Group upgrade'],
] as const;

function PromosTab() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('10');
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [purposes, setPurposes] = useState<string[]>([]);

  async function load() {
    try {
      const d = await api<{ promoCodes: Promo[] }>('/api/admin/promo-codes');
      setPromos(d.promoCodes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load promo codes.');
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/api/admin/promo-codes', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim() || undefined,
          discountType,
          discountValue: Number(discountValue),
          currency: discountType === 'fixed' ? currency : undefined,
          maxUses: maxUses ? Number(maxUses) : undefined,
          expiresAt: expiresAt || undefined,
          applicablePurposes: purposes,
        }),
      });
      setCode('');
      setDiscountValue('10');
      setMaxUses('');
      setExpiresAt('');
      setPurposes([]);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Creating the code failed.');
    }
  }

  async function deactivate(p: Promo) {
    await api(`/api/admin/promo-codes/${p._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    await load();
  }

  return (
    <div className="space-y-8">
      <FormError message={error} />
      <form onSubmit={create} className="max-w-2xl border border-line bg-white p-5">
        <h2 className="font-display text-lg text-ink">New promo code</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Code (blank = auto-generate)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CLASSOF26"
          />
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold text-ink">Discount type</span>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
              className="w-full border border-line bg-white px-3.5 py-2.5"
            >
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed amount off</option>
            </select>
          </label>
          <Field
            label={discountType === 'percent' ? 'Percent (0-100)' : 'Amount off'}
            type="number"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            required
          />
          {discountType === 'fixed' && (
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold text-ink">Currency</span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'NGN' | 'USD')}
                className="w-full border border-line bg-white px-3.5 py-2.5"
              >
                <option value="NGN">NGN</option>
                <option value="USD">USD</option>
              </select>
            </label>
          )}
          <Field
            label="Max uses (blank = unlimited)"
            type="number"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
          />
          <Field
            label="Expires (blank = never)"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
        <div className="mt-4">
          <p className="mb-1.5 text-sm font-semibold text-ink">
            Applies to (none selected = everything)
          </p>
          <div className="flex flex-wrap gap-4">
            {PURPOSES.map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={purposes.includes(value)}
                  onChange={(e) =>
                    setPurposes((p) =>
                      e.target.checked ? [...p, value] : p.filter((x) => x !== value)
                    )
                  }
                  className="accent-laurel"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-5">
          <Button type="submit">Create code</Button>
        </div>
      </form>

      <table className="w-full border border-line bg-white text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-stone">
            <th className="px-4 py-3">Code</th>
            <th className="px-4 py-3">Discount</th>
            <th className="px-4 py-3">Uses</th>
            <th className="px-4 py-3">Expires</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {promos.map((p) => (
            <tr key={p._id} className="border-b border-line last:border-0">
              <td className="px-4 py-3 font-semibold text-ink">{p.code}</td>
              <td className="px-4 py-3">
                {p.discountType === 'percent'
                  ? `${p.discountValue}%`
                  : `${p.currency} ${p.discountValue}`}
              </td>
              <td className="px-4 py-3">
                {p.usedCount}
                {p.maxUses ? ` / ${p.maxUses}` : ''}
              </td>
              <td className="px-4 py-3 text-stone">
                {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : 'Never'}
              </td>
              <td className="px-4 py-3">{p.isActive ? 'Active' : 'Off'}</td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => deactivate(p)}
                  className={`text-sm font-semibold hover:underline ${
                    p.isActive ? 'text-danger' : 'text-laurel'
                  }`}
                >
                  {p.isActive ? 'Deactivate' : 'Reactivate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RevenueTab() {
  const [data, setData] = useState<{
    byCurrencyGateway: Array<{ _id: { currency: string; gateway: string }; total: number; count: number }>;
    recent: Array<{
      _id: string;
      purpose: string;
      amount: number;
      currency: string;
      gateway: string;
      status: string;
      createdAt: string;
      userId?: { email?: string };
    }>;
  } | null>(null);

  useEffect(() => {
    api<NonNullable<typeof data>>('/api/admin/analytics/revenue')
      .then(setData)
      .catch(() => undefined);
  }, []);

  if (!data) return <p className="text-stone">Loading revenue</p>;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.byCurrencyGateway.map((row) => (
          <div key={`${row._id.currency}-${row._id.gateway}`} className="border border-line bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-stone">
              {row._id.currency} via {row._id.gateway}
            </p>
            <p className="mt-2 font-display text-2xl text-ink">
              {row._id.currency} {row.total.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-stone">
              {row.count} {row.count === 1 ? 'payment' : 'payments'}
            </p>
          </div>
        ))}
        {data.byCurrencyGateway.length === 0 && (
          <p className="text-stone">No successful payments yet.</p>
        )}
      </div>

      <table className="w-full border border-line bg-white text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-stone">
            <th className="px-4 py-3">When</th>
            <th className="px-4 py-3">Who</th>
            <th className="px-4 py-3">Purpose</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Gateway</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.recent.map((t) => (
            <tr key={t._id} className="border-b border-line last:border-0">
              <td className="px-4 py-3 text-stone">{new Date(t.createdAt).toLocaleString()}</td>
              <td className="px-4 py-3">{t.userId?.email ?? ''}</td>
              <td className="px-4 py-3">{t.purpose.replace(/_/g, ' ')}</td>
              <td className="px-4 py-3 font-semibold text-ink">
                {t.currency} {t.amount.toLocaleString()}
              </td>
              <td className="px-4 py-3">{t.gateway}</td>
              <td className="px-4 py-3">{t.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
