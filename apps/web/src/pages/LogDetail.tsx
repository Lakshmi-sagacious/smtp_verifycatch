import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { MessageDetail } from '@smtp/shared';
import { api, ApiError } from '../lib/api';
import { formatBytes, formatRelative } from '../lib/format';
import { useOrgId } from '../lib/useOrgId';

// Detail view reused for the org-wide logs page. Sandbox messages use the InboxDetail
// version — that one has HTML rendering + attachments. This is optimized for the delivery
// event timeline that matters for relay messages.
export function LogDetailPage() {
  const orgId = useOrgId();
  const { id } = useParams<{ id: string }>();
  const [msg, setMsg] = useState<MessageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId || !id) return;
    (async () => {
      try {
        setMsg(await api<MessageDetail>(`/orgs/${orgId}/messages/${id}`));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load');
      }
    })();
  }, [orgId, id]);

  if (error) return <div className="error">{error}</div>;
  if (!msg) return <p className="muted">Loading…</p>;

  return (
    <div className="stack">
      <div>
        <Link to="/logs" className="muted" style={{ fontSize: '0.9rem' }}>← All logs</Link>
        <h1 style={{ margin: '0.5rem 0 0.25rem', fontSize: '1.25rem' }}>
          {msg.subject ?? '(no subject)'}
        </h1>
        <div className="muted" style={{ fontSize: '0.9rem' }}>
          {msg.fromAddress ?? msg.mailFrom} → {msg.toAddresses.join(', ') || msg.rcptTo.join(', ')} ·{' '}
          {formatBytes(msg.sizeBytes)} · {msg.kind.replace('_', ' ').toLowerCase()} · <strong>{msg.status}</strong>
        </div>
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Timeline</h2>
        {msg.events && msg.events.length > 0 ? (
          <div className="msg-list">
            {msg.events.map((e) => (
              <div key={e.id} className="msg-row" style={{ gridTemplateColumns: '160px 1fr auto' }}>
                <div className="from" style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.9rem' }}>
                  {e.type}
                </div>
                <div className="subject muted" style={{ fontSize: '0.85rem' }}>
                  {formatDetail(e.detail)}
                </div>
                <div className="time">{formatRelative(e.occurredAt)}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>No events yet.</p>
        )}
      </div>

      {msg.textBody && (
        <div className="card">
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Text body</h2>
          <pre>{msg.textBody}</pre>
        </div>
      )}
    </div>
  );
}

function formatDetail(detail: unknown): string {
  if (!detail || typeof detail !== 'object') return '';
  const d = detail as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof d.recipient === 'string') parts.push(d.recipient);
  if (typeof d.host === 'string') parts.push(`via ${d.host}`);
  if (typeof d.category === 'string') parts.push(d.category as string);
  if (typeof d.response === 'string') parts.push((d.response as string).slice(0, 120));
  if (typeof d.reason === 'string') parts.push(d.reason as string);
  return parts.join(' · ');
}
