import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MessageListResponse, MessageSummary } from '@smtp/shared';
import { api, ApiError } from '../lib/api';
import { formatBytes, formatRelative } from '../lib/format';
import { useOrgId } from '../lib/useOrgId';

type Kind = '' | 'RELAY_OUTBOUND' | 'SANDBOX_INBOUND';
type Status = '' | 'RECEIVED' | 'QUEUED' | 'SENDING' | 'DELIVERED' | 'DEFERRED' | 'BOUNCED' | 'REJECTED' | 'STORED';

export function LogsPage() {
  const orgId = useOrgId();
  const [items, setItems] = useState<MessageSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>('');
  const [status, setStatus] = useState<Status>('');
  const [q, setQ] = useState('');

  async function load(reset = true) {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (!reset && nextCursor) params.set('cursor', nextCursor);
      if (kind) params.set('kind', kind);
      if (status) params.set('status', status);
      if (q.trim()) params.set('q', q.trim());
      const res = await api<MessageListResponse>(`/orgs/${orgId}/messages?${params.toString()}`);
      setItems(reset ? res.items : [...items, ...res.items]);
      setNextCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, kind, status]);

  if (!orgId) return <p className="muted">No workspace selected.</p>;

  return (
    <div className="stack">
      <div>
        <h1 style={{ margin: 0 }}>Message logs</h1>
        <p className="muted" style={{ marginTop: '0.35rem' }}>
          Every message caught or sent across this workspace.
        </p>
      </div>

      <div className="card">
        <div className="row" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ minWidth: 160 }}>
            <label>Kind</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              <option value="">All</option>
              <option value="RELAY_OUTBOUND">Relay (outbound)</option>
              <option value="SANDBOX_INBOUND">Sandbox (caught)</option>
            </select>
          </div>
          <div style={{ minWidth: 160 }}>
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              <option value="">All</option>
              <option value="DELIVERED">Delivered</option>
              <option value="QUEUED">Queued</option>
              <option value="SENDING">Sending</option>
              <option value="DEFERRED">Deferred</option>
              <option value="BOUNCED">Bounced</option>
              <option value="REJECTED">Rejected</option>
              <option value="STORED">Stored (sandbox)</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label>Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void load(true)}
              placeholder="subject, from, or recipient"
            />
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button onClick={() => void load(true)}>Refresh</button>
          </div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {items.length === 0 && !loading ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>No messages match those filters.</p>
        </div>
      ) : (
        <div className="msg-list">
          {items.map((m) => (
            <Link
              key={m.id}
              to={`/logs/${m.id}`}
              className="msg-row"
              style={{ color: 'var(--text)' }}
            >
              <div className="from">{m.fromAddress ?? '(no from)'}</div>
              <div className="subject">
                <span style={{ marginRight: 12 }}>{m.subject ?? '(no subject)'}</span>
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  → {m.toAddresses.slice(0, 2).join(', ')}
                  {m.toAddresses.length > 2 ? ` +${m.toAddresses.length - 2}` : ''}
                </span>
              </div>
              <div className="time">
                {formatRelative(m.createdAt)} · {formatBytes(m.sizeBytes)}
              </div>
            </Link>
          ))}
        </div>
      )}

      {nextCursor && (
        <div className="row" style={{ justifyContent: 'center' }}>
          <button onClick={() => void load(false)} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
