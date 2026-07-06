import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { InboxView } from '@smtp/shared';
import { api, ApiError } from '../lib/api';
import { useOrgId } from '../lib/useOrgId';

export function InboxesPage() {
  const orgId = useOrgId();
  const [inboxes, setInboxes] = useState<InboxView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    if (!orgId) return;
    try {
      const list = await api<InboxView[]>(`/orgs/${orgId}/inboxes`);
      setInboxes(list);
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
          <h1 style={{ margin: 0 }}>Sandbox inboxes</h1>
          <p className="muted" style={{ marginTop: '0.35rem' }}>
            Send test emails from any app — we catch them here without delivering.
          </p>
        </div>
        <button className="primary" onClick={() => setShowCreate(true)}>
          New inbox
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {inboxes === null ? (
        <p className="muted">Loading…</p>
      ) : inboxes.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            No inboxes yet — create one to get an SMTP endpoint.
          </p>
        </div>
      ) : (
        <div className="grid">
          {inboxes.map((i) => (
            <Link key={i.id} to={`/inboxes/${i.id}`} className="inbox-card">
              <h3>{i.name}</h3>
              <div className="count">
                {i.messageCount} {i.messageCount === 1 ? 'message' : 'messages'}
              </div>
              {i.description && (
                <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
                  {i.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateInboxModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function CreateInboxModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const orgId = useOrgId();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/orgs/${orgId}/inboxes`, {
        method: 'POST',
        body: JSON.stringify({ name, description: description || undefined }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New inbox</h2>
        {error && <div className="error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="inbox-name">Name</label>
            <input
              id="inbox-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Staging QA"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="inbox-desc">Description (optional)</label>
            <input
              id="inbox-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create inbox'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
