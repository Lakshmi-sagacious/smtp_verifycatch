import { FormEvent, useEffect, useState } from 'react';
import type { SmtpCredentialView, SmtpCredentialWithSecret } from '@smtp/shared';
import { api, ApiError } from '../lib/api';
import { formatRelative } from '../lib/format';
import { useOrgId } from '../lib/useOrgId';

export function SmtpCredentialsPage() {
  const orgId = useOrgId();
  const [creds, setCreds] = useState<SmtpCredentialView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newCred, setNewCred] = useState<SmtpCredentialWithSecret | null>(null);

  async function load() {
    if (!orgId) return;
    try {
      setCreds(await api<SmtpCredentialView[]>(`/orgs/${orgId}/smtp-credentials`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    }
  }

  async function revoke(id: string) {
    if (!orgId) return;
    if (!confirm('Revoke this SMTP credential? Any app using it will start getting 535 auth failures.')) return;
    try {
      await api(`/orgs/${orgId}/smtp-credentials/${id}`, { method: 'DELETE' });
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Revoke failed');
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
          <h1 style={{ margin: 0 }}>SMTP credentials</h1>
          <p className="muted" style={{ marginTop: '0.35rem' }}>
            For any app that speaks SMTP but not our REST API. Point it at{' '}
            <span className="kbd">localhost:587</span>.
          </p>
        </div>
        <button className="primary" onClick={() => setShowCreate(true)}>New SMTP credential</button>
      </div>

      {error && <div className="error">{error}</div>}

      {newCred && <NewCredBanner value={newCred} onDismiss={() => setNewCred(null)} />}

      {creds === null ? (
        <p className="muted">Loading…</p>
      ) : creds.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>No SMTP credentials yet.</p>
        </div>
      ) : (
        <div className="msg-list">
          {creds.map((c) => (
            <div key={c.id} className="msg-row" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
              <div className="from">
                {c.name}
                {c.revokedAt && <span className="muted" style={{ marginLeft: 8 }}>(revoked)</span>}
              </div>
              <div className="subject">
                <span className="kbd">{c.username}</span>
                <span className="muted" style={{ marginLeft: 12, fontSize: '0.85rem' }}>
                  {c.lastUsedAt ? `used ${formatRelative(c.lastUsedAt)}` : 'never used'}
                </span>
              </div>
              <div>
                {!c.revokedAt && <button onClick={() => void revoke(c.id)}>Revoke</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={(c) => {
            setShowCreate(false);
            setNewCred(c);
            void load();
          }}
        />
      )}
    </div>
  );
}

function NewCredBanner({ value, onDismiss }: { value: SmtpCredentialWithSecret; onDismiss: () => void }) {
  return (
    <div className="card">
      <div className="error" style={{ color: 'var(--success)', borderColor: 'rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.05)' }}>
        Save this password now — it will not be shown again.
      </div>
      <div className="creds-box">
        <div className="creds-row"><span>Host</span><span>{value.smtp.host}</span></div>
        <div className="creds-row"><span>Port</span><span>{value.smtp.port}</span></div>
        <div className="creds-row"><span>Username</span><span>{value.username}</span></div>
        <div className="creds-row"><span>Password</span><span style={{ userSelect: 'all' }}>{value.password}</span></div>
      </div>
      <div style={{ marginTop: '0.75rem' }}>
        <button onClick={onDismiss}>Done, I saved it</button>
      </div>
    </div>
  );
}

function CreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (c: SmtpCredentialWithSecret) => void;
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
      const c = await api<SmtpCredentialWithSecret>(`/orgs/${orgId}/smtp-credentials`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      onCreated(c);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New SMTP credential</h2>
        {error && <div className="error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="cn">Name</label>
            <input
              id="cn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="WordPress plugin"
              autoFocus
              required
            />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create credential'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
