import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { MessageDetail } from '@smtp/shared';
import { api, ApiError, getAccessToken } from '../lib/api';
import { formatBytes } from '../lib/format';
import { useOrgId } from '../lib/useOrgId';

type Tab = 'html' | 'text' | 'raw' | 'headers' | 'attachments';

export function MessageViewPage() {
  const orgId = useOrgId();
  const { inboxId, messageId } = useParams<{ inboxId: string; messageId: string }>();
  const [msg, setMsg] = useState<MessageDetail | null>(null);
  const [tab, setTab] = useState<Tab>('html');
  const [rawText, setRawText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId || !messageId) return;
    (async () => {
      try {
        const m = await api<MessageDetail>(`/orgs/${orgId}/messages/${messageId}`);
        setMsg(m);
        if (!m.htmlBody && m.textBody) setTab('text');
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load');
      }
    })();
  }, [orgId, messageId]);

  useEffect(() => {
    if (tab !== 'raw' || rawText !== null || !orgId || !messageId) return;
    (async () => {
      const token = getAccessToken();
      const res = await fetch(`/api/orgs/${orgId}/messages/${messageId}/raw`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setRawText(await res.text());
    })();
  }, [tab, rawText, orgId, messageId]);

  if (error) return <div className="error">{error}</div>;
  if (!msg) return <p className="muted">Loading…</p>;

  return (
    <div className="stack">
      <div>
        <Link to={`/inboxes/${inboxId}`} className="muted" style={{ fontSize: '0.9rem' }}>
          ← Back to inbox
        </Link>
        <h1 style={{ margin: '0.5rem 0 0.25rem', fontSize: '1.25rem' }}>
          {msg.subject ?? '(no subject)'}
        </h1>
        <div className="muted" style={{ fontSize: '0.9rem' }}>
          {msg.fromAddress ?? msg.mailFrom} → {msg.toAddresses.join(', ') || msg.rcptTo.join(', ')} ·{' '}
          {formatBytes(msg.sizeBytes)}
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${tab === 'html' ? 'active' : ''}`}
          onClick={() => setTab('html')}
          disabled={!msg.htmlBody}
        >
          HTML
        </button>
        <button
          className={`tab ${tab === 'text' ? 'active' : ''}`}
          onClick={() => setTab('text')}
          disabled={!msg.textBody}
        >
          Text
        </button>
        <button
          className={`tab ${tab === 'headers' ? 'active' : ''}`}
          onClick={() => setTab('headers')}
        >
          Headers ({msg.headers.length})
        </button>
        <button
          className={`tab ${tab === 'attachments' ? 'active' : ''}`}
          onClick={() => setTab('attachments')}
          disabled={msg.attachments.length === 0}
        >
          Attachments ({msg.attachments.length})
        </button>
        <button className={`tab ${tab === 'raw' ? 'active' : ''}`} onClick={() => setTab('raw')}>
          Raw
        </button>
      </div>

      {tab === 'html' && msg.htmlBody && (
        <iframe
          className="html-preview"
          sandbox=""
          srcDoc={msg.htmlBody}
          title="HTML preview"
        />
      )}
      {tab === 'text' && <pre>{msg.textBody ?? '(no text body)'}</pre>}
      {tab === 'headers' && (
        <table className="headers">
          <tbody>
            {msg.headers.map((h, i) => (
              <tr key={i}>
                <td>{h.name}</td>
                <td>{h.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tab === 'attachments' && (
        <div className="stack">
          {msg.attachments.map((a) => (
            <div key={a.id} className="card between">
              <div>
                <div>{a.filename}</div>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {a.contentType} · {formatBytes(a.sizeBytes)}
                </div>
              </div>
              <AttachmentDownload messageId={msg.id} attachmentId={a.id} filename={a.filename} />
            </div>
          ))}
        </div>
      )}
      {tab === 'raw' && (
        <pre>{rawText ?? 'Loading raw MIME…'}</pre>
      )}
    </div>
  );
}

function AttachmentDownload({
  messageId,
  attachmentId,
  filename,
}: {
  messageId: string;
  attachmentId: string;
  filename: string;
}) {
  const orgId = useOrgId();
  async function download() {
    if (!orgId) return;
    const token = getAccessToken();
    const res = await fetch(`/api/orgs/${orgId}/messages/${messageId}/attachments/${attachmentId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  return <button onClick={() => void download()}>Download</button>;
}
