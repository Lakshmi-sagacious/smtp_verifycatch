import { FormEvent, useEffect, useState } from 'react';
import type { WebhookView, WebhookWithSecret, WebhookEventType } from '@smtp/shared';
import { WebhookEventTypes } from '@smtp/shared';
import { api, ApiError } from '../lib/api';
import { formatRelative } from '../lib/format';
import { useOrgId } from '../lib/useOrgId';

const DEFAULT_EVENTS: WebhookEventType[] = ['DELIVERED', 'BOUNCED', 'DEFERRED', 'COMPLAINED', 'REJECTED'];

export function WebhooksPage() {
  const orgId = useOrgId();
  const [hooks, setHooks] = useState<WebhookView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newHook, setNewHook] = useState<WebhookWithSecret | null>(null);

  async function load() {
    if (!orgId) return;
    try {
      setHooks(await api<WebhookView[]>(`/orgs/${orgId}/webhooks`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    }
  }

  async function toggle(hook: WebhookView) {
    if (!orgId) return;
    try {
      await api(`/orgs/${orgId}/webhooks/${hook.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !hook.active }),
      });
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed');
    }
  }

  async function remove(id: string) {
    if (!orgId) return;
    if (!confirm('Delete this webhook subscription?')) return;
    try {
      await api(`/orgs/${orgId}/webhooks/${id}`, { method: 'DELETE' });
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
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
          <h1 style={{ margin: 0 }}>Webhooks</h1>
          <p className="muted" style={{ marginTop: '0.35rem' }}>
            Get message events POST'd to your URL. Payload signed with{' '}
            <span className="kbd">X-Webhook-Signature</span>.
          </p>
        </div>
        <button className="primary" onClick={() => setShowCreate(true)}>New webhook</button>
      </div>

      {error && <div className="error">{error}</div>}

      {newHook && <NewHookBanner value={newHook} onDismiss={() => setNewHook(null)} />}

      {hooks === null ? (
        <p className="muted">Loading…</p>
      ) : hooks.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>No webhook subscriptions yet.</p>
        </div>
      ) : (
        <div className="msg-list">
          {hooks.map((h) => (
            <div key={h.id} className="msg-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
              <div>
                <div className="from" style={{ marginBottom: 4 }}>
                  <span className="kbd" style={{ wordBreak: 'break-all' }}>{h.url}</span>
                </div>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {h.events.join(', ')} · {h.active ? 'active' : 'paused'} · updated {formatRelative(h.updatedAt)}
                </div>
              </div>
              <div>
                <button onClick={() => void toggle(h)}>
                  {h.active ? 'Pause' : 'Resume'}
                </button>
              </div>
              <div>
                <button onClick={() => void remove(h.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={(h) => {
            setShowCreate(false);
            setNewHook(h);
            void load();
          }}
        />
      )}
    </div>
  );
}

function NewHookBanner({ value, onDismiss }: { value: WebhookWithSecret; onDismiss: () => void }) {
  return (
    <div className="card">
      <div className="error" style={{ color: 'var(--success)', borderColor: 'rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.05)' }}>
        Save this signing secret — you'll need it to verify HMACs. It won't be shown again.
      </div>
      <div className="creds-box">
        <div className="creds-row"><span>URL</span><span>{value.url}</span></div>
        <div className="creds-row"><span>Events</span><span>{value.events.join(', ')}</span></div>
        <div className="creds-row"><span>Secret</span><span style={{ userSelect: 'all', wordBreak: 'break-all' }}>{value.secret}</span></div>
      </div>
      <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>
        Verify: compute <span className="kbd">HMAC-SHA256(secret, `${'{'}timestamp{'}'}.${'{'}rawBody{'}'}`)</span> and
        compare against the <span className="kbd">X-Webhook-Signature</span> header
        (format: <span className="kbd">sha256=&lt;hex&gt;</span>).
      </p>
      <div>
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
  onCreated: (h: WebhookWithSecret) => void;
}) {
  const orgId = useOrgId();
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<Set<WebhookEventType>>(new Set(DEFAULT_EVENTS));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggle(e: WebhookEventType) {
    setEvents((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    if (events.size === 0) {
      setError('Pick at least one event');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const h = await api<WebhookWithSecret>(`/orgs/${orgId}/webhooks`, {
        method: 'POST',
        body: JSON.stringify({ url, events: Array.from(events) }),
      });
      onCreated(h);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h2>New webhook</h2>
        {error && <div className="error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="wurl">Endpoint URL</label>
            <input
              id="wurl"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourapp.com/hooks/smtp"
              autoFocus
              required
            />
          </div>
          <div className="field">
            <label>Events</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
              {WebhookEventTypes.map((e) => (
                <label key={e} style={{ fontSize: '0.9rem', color: 'var(--text)' }}>
                  <input
                    type="checkbox"
                    checked={events.has(e)}
                    onChange={() => toggle(e)}
                    style={{ width: 'auto', marginRight: 6 }}
                  />
                  {e}
                </label>
              ))}
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create webhook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
