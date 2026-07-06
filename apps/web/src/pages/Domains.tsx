import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DomainView } from '@smtp/shared';
import { api, ApiError } from '../lib/api';
import { useOrgId } from '../lib/useOrgId';

export function DomainsPage() {
  const orgId = useOrgId();
  const [domains, setDomains] = useState<DomainView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    if (!orgId) return;
    try {
      setDomains(await api<DomainView[]>(`/orgs/${orgId}/domains`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  if (!orgId) return <p className="muted">No workspace selected.</p>;

  return (
    <div className="stack">
      <div className="between">
        <div>
          <h1 style={{ margin: 0 }}>Sending domains</h1>
          <p className="muted" style={{ marginTop: '0.35rem' }}>
            Add a domain, publish the DNS records, and start sending real transactional mail.
          </p>
        </div>
        <button className="primary" onClick={() => setShowAdd(true)}>Add domain</button>
      </div>

      {error && <div className="error">{error}</div>}

      {domains === null ? (
        <p className="muted">Loading…</p>
      ) : domains.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            No domains yet. Add one to get DKIM records to publish.
          </p>
        </div>
      ) : (
        <div className="grid">
          {domains.map((d) => (
            <Link key={d.id} to={`/domains/${d.id}`} className="inbox-card">
              <h3>{d.name}</h3>
              <div className="count">
                <StatusBadge status={d.verificationStatus} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {showAdd && (
        <AddDomainModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { text: string; color: string }> = {
    VERIFIED: { text: 'Verified', color: 'var(--success)' },
    PENDING: { text: 'Pending DNS', color: 'var(--text-dim)' },
    FAILED: { text: 'Not verified', color: 'var(--error)' },
    DISABLED: { text: 'Disabled', color: 'var(--text-dim)' },
    RECOMMENDED: { text: 'Recommended', color: 'var(--text-dim)' },
  };
  const { text, color } = map[status] ?? { text: status, color: 'var(--text-dim)' };
  return <span style={{ color, fontSize: '0.85rem' }}>{text}</span>;
}

function AddDomainModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const orgId = useOrgId();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/orgs/${orgId}/domains`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add sending domain</h2>
        <p className="muted" style={{ fontSize: '0.85rem', marginTop: 0 }}>
          Use a subdomain like <span className="kbd">mail.yourcompany.com</span> so your root
          domain's regular email keeps working.
        </p>
        {error && <div className="error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="dn">Domain name</label>
            <input
              id="dn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mail.acme.com"
              autoFocus
              required
            />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Adding…' : 'Add domain'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
