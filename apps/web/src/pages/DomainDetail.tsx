import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { DomainView } from '@smtp/shared';
import { api, ApiError } from '../lib/api';
import { useOrgId } from '../lib/useOrgId';
import { StatusBadge } from './Domains';

export function DomainDetailPage() {
  const orgId = useOrgId();
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [domain, setDomain] = useState<DomainView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function load() {
    if (!orgId || !id) return;
    try {
      setDomain(await api<DomainView>(`/orgs/${orgId}/domains/${id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    }
  }

  async function verify() {
    if (!orgId || !id) return;
    setVerifying(true);
    setError(null);
    try {
      setDomain(await api<DomainView>(`/orgs/${orgId}/domains/${id}/verify`, { method: 'POST' }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  }

  async function remove() {
    if (!orgId || !id) return;
    if (!confirm(`Delete ${domain?.name}? This cannot be undone.`)) return;
    try {
      await api(`/orgs/${orgId}/domains/${id}`, { method: 'DELETE' });
      nav('/domains');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, id]);

  if (error) return <div className="error">{error}</div>;
  if (!domain) return <p className="muted">Loading…</p>;

  return (
    <div className="stack">
      <div>
        <Link to="/domains" className="muted" style={{ fontSize: '0.9rem' }}>← All domains</Link>
        <div className="between" style={{ marginTop: '0.5rem' }}>
          <div>
            <h1 style={{ margin: 0 }}>{domain.name}</h1>
            <StatusBadge status={domain.verificationStatus} />
          </div>
          <div className="row">
            <button onClick={() => void verify()} disabled={verifying}>
              {verifying ? 'Checking DNS…' : 'Verify now'}
            </button>
            <button onClick={() => void remove()}>Delete</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>DNS records to publish</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
          Add each record to your DNS provider. DKIM is required for delivery. SPF and DMARC are
          strongly recommended for inbox placement.
        </p>
        <div className="stack">
          {domain.dnsRecords.map((r, i) => (
            <div key={i} className="creds-box">
              <div className="between" style={{ marginBottom: '0.5rem' }}>
                <span style={{ fontFamily: 'system-ui' }}>
                  <strong>{r.purpose}</strong>{' '}
                  <span className="muted">({r.type})</span>
                </span>
                <StatusBadge status={r.status} />
              </div>
              <div className="creds-row">
                <span>Host</span>
                <span style={{ userSelect: 'all', wordBreak: 'break-all' }}>{r.host}</span>
              </div>
              <div className="creds-row">
                <span>Value</span>
                <span style={{ userSelect: 'all', wordBreak: 'break-all' }}>{r.value}</span>
              </div>
              {r.detail && (
                <div className="creds-row">
                  <span>Detail</span>
                  <span style={{ color: 'var(--text-dim)' }}>{r.detail}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {domain.verificationStatus === 'VERIFIED' && (
        <div className="card">
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Ready to send</h2>
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            Create an API key from the <Link to="/api-keys">API keys page</Link>, then POST to{' '}
            <span className="kbd">/api/send</span> with a From address on this domain.
          </p>
        </div>
      )}
    </div>
  );
}
