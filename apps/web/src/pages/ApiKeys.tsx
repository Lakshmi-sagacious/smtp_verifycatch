import { FormEvent, useEffect, useState } from 'react';
import type { ApiKeyView, ApiKeyWithSecret } from '@smtp/shared';
import { api, ApiError } from '../lib/api';
import { formatRelative } from '../lib/format';
import { useOrgId } from '../lib/useOrgId';

export function ApiKeysPage() {
  const orgId = useOrgId();
  const [keys, setKeys] = useState<ApiKeyView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<ApiKeyWithSecret | null>(null);

  async function load() {
    if (!orgId) return;
    try {
      setKeys(await api<ApiKeyView[]>(`/orgs/${orgId}/api-keys`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    }
  }

  async function revoke(id: string) {
    if (!orgId) return;
    if (!confirm('Revoke this key? Any app using it will start getting 401 immediately.')) return;
    try {
      await api(`/orgs/${orgId}/api-keys/${id}`, { method: 'DELETE' });
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
          <h1 style={{ margin: 0 }}>API keys</h1>
          <p className="muted" style={{ marginTop: '0.35rem' }}>
            Use in the <span className="kbd">X-API-Key</span> header when calling{' '}
            <span className="kbd">/api/send</span>.
          </p>
        </div>
        <button className="primary" onClick={() => setShowCreate(true)}>New API key</button>
      </div>

      {error && <div className="error">{error}</div>}

      {newKey && <NewKeyBanner value={newKey} onDismiss={() => setNewKey(null)} />}

      {keys === null ? (
        <p className="muted">Loading…</p>
      ) : keys.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>No API keys yet.</p>
        </div>
      ) : (
        <div className="msg-list">
          {keys.map((k) => (
            <div key={k.id} className="msg-row" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
              <div className="from">
                {k.name}
                {k.revokedAt && <span className="muted" style={{ marginLeft: 8 }}>(revoked)</span>}
              </div>
              <div className="subject">
                <span className="kbd">{k.keyPrefix}…</span>
                <span className="muted" style={{ marginLeft: 12, fontSize: '0.85rem' }}>
                  {k.lastUsedAt ? `used ${formatRelative(k.lastUsedAt)}` : 'never used'}
                </span>
              </div>
              <div>
                {!k.revokedAt && (
                  <button onClick={() => void revoke(k.id)}>Revoke</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateKeyModal
          onClose={() => setShowCreate(false)}
          onCreated={(k) => {
            setShowCreate(false);
            setNewKey(k);
            void load();
          }}
        />
      )}
    </div>
  );
}

function NewKeyBanner({ value, onDismiss }: { value: ApiKeyWithSecret; onDismiss: () => void }) {
  return (
    <div className="card">
      <div className="error" style={{ color: 'var(--success)', borderColor: 'rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.05)' }}>
        Save this key now — it will not be shown again.
      </div>
      <div className="creds-box">
        <div className="creds-row">
          <span>Name</span>
          <span>{value.name}</span>
        </div>
        <div className="creds-row">
          <span>Key</span>
          <span style={{ userSelect: 'all', wordBreak: 'break-all' }}>{value.key}</span>
        </div>
      </div>
      <div style={{ marginTop: '0.75rem' }}>
        <button onClick={onDismiss}>Done, I saved it</button>
      </div>
    </div>
  );
}

function CreateKeyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (k: ApiKeyWithSecret) => void;
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
      const k = await api<ApiKeyWithSecret>(`/orgs/${orgId}/api-keys`, {
        method: 'POST',
        body: JSON.stringify({ name, scopes: ['send'] }),
      });
      onCreated(k);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New API key</h2>
        {error && <div className="error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="kn">Name</label>
            <input
              id="kn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production backend"
              autoFocus
              required
            />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
