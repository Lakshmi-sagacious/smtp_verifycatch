import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DomainView, MessageDetail, SendTestResponse } from '@smtp/shared';
import { api, ApiError } from '../lib/api';
import { formatRelative } from '../lib/format';
import { useOrgId } from '../lib/useOrgId';

type BodyMode = 'text' | 'html';
type SendState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; result: SendTestResponse }
  | { kind: 'error'; message: string };

const TERMINAL_STATUSES = new Set(['DELIVERED', 'BOUNCED', 'REJECTED', 'COMPLAINED', 'STORED']);
const POLL_MS = 2000;

export function SendTestPage() {
  const orgId = useOrgId();
  const [domains, setDomains] = useState<DomainView[] | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('Test from my SMTP platform');
  const [bodyMode, setBodyMode] = useState<BodyMode>('text');
  const [text, setText] = useState('If you see this in your inbox, the pipeline works end-to-end.');
  const [html, setHtml] = useState('<h1>It works</h1><p>Sent through my own SMTP platform.</p>');
  const [state, setState] = useState<SendState>({ kind: 'idle' });
  const [message, setMessage] = useState<MessageDetail | null>(null);
  const pollRef = useRef<number | null>(null);

  // Load domains to pick the default From, and show helpful hint if none are verified.
  useEffect(() => {
    if (!orgId) return;
    void api<DomainView[]>(`/orgs/${orgId}/domains`)
      .then((list) => {
        setDomains(list);
        const firstVerified = list.find((d) => d.verificationStatus === 'VERIFIED');
        if (firstVerified && !from) setFrom(`noreply@${firstVerified.name}`);
      })
      .catch(() => setDomains([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  // Poll the message detail while the status is not terminal.
  useEffect(() => {
    if (state.kind !== 'sent' || !orgId) return;
    const msgId = state.result.messageId;
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      try {
        const detail = await api<MessageDetail>(`/orgs/${orgId}/messages/${msgId}`);
        if (cancelled) return;
        setMessage(detail);
        if (!TERMINAL_STATUSES.has(detail.status)) {
          pollRef.current = window.setTimeout(tick, POLL_MS);
        }
      } catch {
        if (!cancelled) pollRef.current = window.setTimeout(tick, POLL_MS * 2);
      }
    }
    void tick();
    return () => {
      cancelled = true;
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [state, orgId]);

  const verifiedDomains = domains?.filter((d) => d.verificationStatus === 'VERIFIED') ?? [];
  const canSend = orgId && to.trim().length > 0 && subject.trim().length > 0 &&
    (bodyMode === 'text' ? text.length > 0 : html.length > 0);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setState({ kind: 'sending' });
    setMessage(null);
    try {
      const body: Record<string, string> = { to, subject };
      if (from.trim()) body.from = from.trim();
      if (bodyMode === 'text') body.text = text;
      else body.html = html;

      const result = await api<SendTestResponse>(`/orgs/${orgId}/send-test`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setState({ kind: 'sent', result });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof ApiError ? err.message : 'Send failed',
      });
    }
  }

  function reset() {
    setState({ kind: 'idle' });
    setMessage(null);
  }

  return (
    <div className="stack">
      <div>
        <h1 style={{ margin: 0 }}>Send test</h1>
        <p className="muted" style={{ marginTop: '0.35rem' }}>
          Compose a real message and watch it flow through the pipeline.
        </p>
      </div>

      {domains && verifiedDomains.length === 0 && (
        <div className="error" style={{ color: 'var(--text-dim)', borderColor: 'var(--border)', background: 'var(--panel)' }}>
          You have no verified sending domains yet.{' '}
          <Link to="/domains">Add one</Link> and click <span className="kbd">Verify now</span> —
          otherwise the send will fail because your From address must be on a verified domain.
        </div>
      )}

      <div className="card">
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="from">
              From <span className="muted" style={{ fontSize: '0.8rem' }}>(auto-fills to first verified domain)</span>
            </label>
            <input
              id="from"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="noreply@yourverifieddomain.com"
              disabled={state.kind === 'sending'}
            />
          </div>
          <div className="field">
            <label htmlFor="to">To</label>
            <input
              id="to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="you@gmail.com"
              required
              disabled={state.kind === 'sending'}
            />
          </div>
          <div className="field">
            <label htmlFor="subj">Subject</label>
            <input
              id="subj"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              disabled={state.kind === 'sending'}
            />
          </div>

          <div className="field">
            <label>Body</label>
            <div className="tabs" style={{ marginTop: 0 }}>
              <button
                type="button"
                className={`tab ${bodyMode === 'text' ? 'active' : ''}`}
                onClick={() => setBodyMode('text')}
              >
                Text
              </button>
              <button
                type="button"
                className={`tab ${bodyMode === 'html' ? 'active' : ''}`}
                onClick={() => setBodyMode('html')}
              >
                HTML
              </button>
            </div>
            {bodyMode === 'text' ? (
              <textarea
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={state.kind === 'sending'}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            ) : (
              <textarea
                rows={8}
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                disabled={state.kind === 'sending'}
                style={{ resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }}
              />
            )}
          </div>

          <div className="row" style={{ justifyContent: 'flex-end' }}>
            {state.kind === 'sent' && <button type="button" onClick={reset}>New test</button>}
            <button type="submit" className="primary" disabled={!canSend || state.kind === 'sending'}>
              {state.kind === 'sending' ? 'Sending…' : 'Send test'}
            </button>
          </div>
        </form>
      </div>

      {state.kind === 'error' && <div className="error">{state.message}</div>}

      {state.kind === 'sent' && (
        <div className="card">
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Result</h2>
          <div className="creds-box">
            <div className="creds-row"><span>Message ID</span><span style={{ userSelect: 'all' }}>{state.result.messageId}</span></div>
            <div className="creds-row"><span>Status</span><span>{message?.status ?? state.result.status}</span></div>
            <div className="creds-row"><span>From</span><span>{state.result.from}</span></div>
            <div className="creds-row"><span>To</span><span>{to}</span></div>
            {state.result.reason && <div className="creds-row"><span>Reason</span><span>{state.result.reason}</span></div>}
          </div>

          <h3 style={{ margin: '1.25rem 0 0.5rem', fontSize: '0.9rem' }}>
            Timeline{' '}
            <span className="muted" style={{ fontSize: '0.8rem' }}>
              {message && !TERMINAL_STATUSES.has(message.status) ? '(refreshing every 2s)' : ''}
            </span>
          </h3>
          {message?.events && message.events.length > 0 ? (
            <div className="msg-list">
              {message.events.map((e) => (
                <div key={e.id} className="msg-row" style={{ gridTemplateColumns: '140px 1fr auto' }}>
                  <div className="from" style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }}>{e.type}</div>
                  <div className="subject muted" style={{ fontSize: '0.85rem' }}>{formatDetail(e.detail)}</div>
                  <div className="time">{formatRelative(e.occurredAt)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Waiting for events…</p>
          )}

          {message && message.status === 'DELIVERED' && (
            <p className="muted" style={{ marginTop: '1rem' }}>
              ✓ Delivered. Check <span className="kbd">{to}</span>.{' '}
              {isGoogleAddress(to) && "If it's not in the primary inbox, try Spam or Promotions."}
            </p>
          )}
          {message && message.status === 'BOUNCED' && (
            <p style={{ marginTop: '1rem', color: 'var(--error)' }}>
              ✗ Bounced. The recipient's mail server rejected it. Check the timeline for the specific error.
            </p>
          )}
          {message && message.status === 'REJECTED' && (
            <p style={{ marginTop: '1rem', color: 'var(--error)' }}>
              ✗ Rejected before send (usually a suppression list hit). See{' '}
              <Link to={`/logs/${state.result.messageId}`}>the full log entry</Link>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function formatDetail(detail: unknown): string {
  if (!detail || typeof detail !== 'object') return '';
  const d = detail as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof d.recipient === 'string') parts.push(String(d.recipient));
  if (typeof d.host === 'string') parts.push(`via ${d.host}`);
  if (typeof d.category === 'string') parts.push(String(d.category));
  if (typeof d.response === 'string') parts.push(String(d.response).slice(0, 120));
  if (typeof d.reason === 'string') parts.push(String(d.reason));
  return parts.join(' · ');
}

function isGoogleAddress(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return domain === 'gmail.com' || domain === 'googlemail.com';
}
