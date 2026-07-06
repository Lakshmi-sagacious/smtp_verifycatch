import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  CredentialView,
  CredentialWithSecret,
  InboxView,
  MessageListResponse,
  MessageSummary,
} from '@smtp/shared';
import { api, ApiError } from '../lib/api';
import { formatBytes, formatRelative } from '../lib/format';
import { useOrgId } from '../lib/useOrgId';

const POLL_MS = 3000;

export function InboxDetailPage() {
  const orgId = useOrgId();
  const { inboxId } = useParams<{ inboxId: string }>();
  const [inbox, setInbox] = useState<InboxView | null>(null);
  const [credentials, setCredentials] = useState<CredentialView[]>([]);
  const [messages, setMessages] = useState<MessageSummary[] | null>(null);
  const [newSecret, setNewSecret] = useState<CredentialWithSecret | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<number | null>(null);

  async function loadAll() {
    if (!orgId || !inboxId) return;
    try {
      const [i, creds, msgs] = await Promise.all([
        api<InboxView>(`/orgs/${orgId}/inboxes/${inboxId}`),
        api<CredentialView[]>(`/orgs/${orgId}/inboxes/${inboxId}/credentials`),
        api<MessageListResponse>(`/orgs/${orgId}/inboxes/${inboxId}/messages`),
      ]);
      setInbox(i);
      setCredentials(creds);
      setMessages(msgs.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    }
  }

  async function pollMessages() {
    if (!orgId || !inboxId) return;
    try {
      const msgs = await api<MessageListResponse>(`/orgs/${orgId}/inboxes/${inboxId}/messages`);
      setMessages(msgs.items);
    } catch {
      // silent — next tick will retry
    }
  }

  async function createCredential() {
    if (!orgId || !inboxId) return;
    try {
      const cred = await api<CredentialWithSecret>(
        `/orgs/${orgId}/inboxes/${inboxId}/credentials`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      setNewSecret(cred);
      setCredentials((prev) => [
        {
          id: cred.id,
          username: cred.username,
          label: cred.label,
          lastUsedAt: cred.lastUsedAt,
          revokedAt: cred.revokedAt,
          createdAt: cred.createdAt,
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create credential');
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, inboxId]);

  useEffect(() => {
    pollRef.current = window.setInterval(() => void pollMessages(), POLL_MS);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, inboxId]);

  if (!inbox) return <p className="muted">Loading…</p>;

  const activeCred = credentials.find((c) => !c.revokedAt);

  return (
    <div className="stack">
      <div>
        <Link to="/inboxes" className="muted" style={{ fontSize: '0.9rem' }}>
          ← All inboxes
        </Link>
        <h1 style={{ margin: '0.5rem 0 0' }}>{inbox.name}</h1>
        {inbox.description && <p className="muted">{inbox.description}</p>}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="between" style={{ marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>Connect</h2>
          <button onClick={() => void createCredential()}>New credential</button>
        </div>
        {activeCred && !newSecret && (
          <div className="creds-box">
            <div className="creds-row">
              <span>Host</span>
              <span>localhost</span>
            </div>
            <div className="creds-row">
              <span>Port</span>
              <span>2525</span>
            </div>
            <div className="creds-row">
              <span>Username</span>
              <span>{activeCred.username}</span>
            </div>
            <div className="creds-row">
              <span>Password</span>
              <span className="muted">
                (hidden — click "New credential" to generate a fresh one)
              </span>
            </div>
          </div>
        )}
        {!activeCred && !newSecret && (
          <p className="muted">
            No active credentials. Click <span className="kbd">New credential</span> to create one.
          </p>
        )}
        {newSecret && (
          <div className="stack">
            <div className="error" style={{ color: 'var(--success)', borderColor: 'rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.05)' }}>
              Save this password now — it will not be shown again.
            </div>
            <div className="creds-box">
              <div className="creds-row">
                <span>Host</span>
                <span>{newSecret.smtp.host}</span>
              </div>
              <div className="creds-row">
                <span>Port</span>
                <span>{newSecret.smtp.port}</span>
              </div>
              <div className="creds-row">
                <span>Username</span>
                <span>{newSecret.username}</span>
              </div>
              <div className="creds-row">
                <span>Password</span>
                <span>{newSecret.password}</span>
              </div>
            </div>
            <button onClick={() => setNewSecret(null)}>Done, I saved it</button>
          </div>
        )}
      </div>

      <div>
        <h2 style={{ margin: '1rem 0 0.5rem', fontSize: '1rem' }}>
          Messages{' '}
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            (auto-refreshes every 3s)
          </span>
        </h2>
        {messages === null ? (
          <p className="muted">Loading…</p>
        ) : messages.length === 0 ? (
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>
              No messages yet. Send one to <span className="kbd">localhost:2525</span> using the
              credential above.
            </p>
          </div>
        ) : (
          <div className="msg-list">
            {messages.map((m) => (
              <Link
                key={m.id}
                to={`/inboxes/${inboxId}/messages/${m.id}`}
                className="msg-row"
                style={{ color: 'var(--text)' }}
              >
                <div className="from">{m.fromAddress ?? '(no from)'}</div>
                <div className="subject">{m.subject ?? '(no subject)'}</div>
                <div className="time">
                  {formatRelative(m.createdAt)} · {formatBytes(m.sizeBytes)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
